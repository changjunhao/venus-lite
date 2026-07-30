import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h, nextTick } from 'vue'
import { clearNuxtState, useTheme } from '#imports'
import { THEME_STORAGE_KEY } from '#shared/theme'

type MediaListener = (event: { matches: boolean }) => void

let api: ReturnType<typeof useTheme>

// composable 的初始化落在 onMounted，需真实挂载；
// 挂载前 clearNuxtState 重置 useState，避免用例间共享同一 Nuxt 实例导致状态泄漏
const ThemeHost = defineComponent({
  setup() {
    clearNuxtState()
    api = useTheme()
    return () => h('span')
  },
})

/** 可控的 matchMedia，返回手动触发 change 的句柄（不依赖 happy-dom 实现） */
function stubMatchMedia(prefersDark: boolean) {
  const listeners = new Set<MediaListener>()
  const query = {
    matches: prefersDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, listener: MediaListener) => listeners.add(listener),
    removeEventListener: (_: string, listener: MediaListener) => listeners.delete(listener),
  }
  vi.stubGlobal('matchMedia', () => query)
  return async (matches: boolean) => {
    query.matches = matches
    listeners.forEach(listener => listener({ matches }))
    await nextTick()
  }
}

const root = () => document.documentElement

describe('useTheme', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
    root().removeAttribute('data-theme')
    root().classList.remove('theme-transitioning')
  })

  it('未显式选择时跟随系统，不写 data-theme 也不写 localStorage', async () => {
    stubMatchMedia(true)
    await mountSuspended(ThemeHost)

    expect(api.theme.value).toBe('')
    expect(api.isDarkroom.value).toBe(true)
    // 颜色交由 tokens.css 的 prefers-color-scheme 兜底
    expect(root().hasAttribute('data-theme')).toBe(false)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })

  it('localStorage 中的显式偏好优先于系统偏好', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'paper')
    root().dataset.theme = 'paper' // 模拟 head 内联脚本已在首绘前写入
    stubMatchMedia(true)
    await mountSuspended(ThemeHost)

    expect(api.theme.value).toBe('paper')
    expect(api.isDarkroom.value).toBe(false)
    expect(root().dataset.theme).toBe('paper')
  })

  it('非法值视为未选择，回落系统偏好', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'binance')
    stubMatchMedia(true)
    await mountSuspended(ThemeHost)

    expect(api.theme.value).toBe('')
    expect(api.isDarkroom.value).toBe(true)
    expect(root().hasAttribute('data-theme')).toBe(false)
  })

  it('toggle 写入 data-theme 与 localStorage，显式 paper 也写属性', async () => {
    stubMatchMedia(false)
    await mountSuspended(ThemeHost)

    api.toggle()
    await nextTick()
    expect(root().dataset.theme).toBe('darkroom')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('darkroom')

    api.toggle()
    await nextTick()
    expect(root().dataset.theme).toBe('paper')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('paper')
  })

  it('切换时挂上过渡类，180ms 后移除', async () => {
    stubMatchMedia(false)
    await mountSuspended(ThemeHost)

    vi.useFakeTimers()
    try {
      api.toggle()
      await nextTick()
      expect(root().classList.contains('theme-transitioning')).toBe(true)

      vi.advanceTimersByTime(180)
      expect(root().classList.contains('theme-transitioning')).toBe(false)
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('无显式偏好时跟随系统变化，已切换过则不再跟随', async () => {
    const emitChange = stubMatchMedia(false)
    await mountSuspended(ThemeHost)
    expect(api.isDarkroom.value).toBe(false)

    await emitChange(true)
    expect(api.isDarkroom.value).toBe(true)
    expect(api.theme.value).toBe('')

    api.toggle() // 固定为纸面
    await nextTick()
    await emitChange(false)
    await emitChange(true)
    expect(api.theme.value).toBe('paper')
    expect(api.isDarkroom.value).toBe(false)
  })
})
