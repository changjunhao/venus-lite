import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import { clearNuxtState } from '#imports'
import { THEME_STORAGE_KEY } from '#shared/theme'
import ThemeToggle from '~/components/layout/ThemeToggle.vue'

type MediaListener = (event: { matches: boolean }) => void

// 组件内部经 useTheme 使用 useState，挂载前 clearNuxtState 重置，
// 避免用例间共享同一 Nuxt 实例导致状态泄漏（同 useTheme.spec.ts）
const Host = defineComponent({
  setup() {
    clearNuxtState()
    return () => h(ThemeToggle)
  },
})

/** 可控的 matchMedia（不依赖 happy-dom 实现） */
function stubMatchMedia(prefersDark: boolean) {
  const listeners = new Set<MediaListener>()
  const query = {
    matches: prefersDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, listener: MediaListener) => listeners.add(listener),
    removeEventListener: (_: string, listener: MediaListener) => listeners.delete(listener),
  }
  vi.stubGlobal('matchMedia', () => query)
}

const root = () => document.documentElement

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
    root().removeAttribute('data-theme')
    root().classList.remove('theme-transitioning')
  })

  it('渲染 button 与两组主题态（选显交由 CSS，DOM 层两组恒在）', async () => {
    stubMatchMedia(false)
    const wrapper = await mountSuspended(Host)
    const button = wrapper.find('button')

    expect(button.attributes('type')).toBe('button')
    expect(button.classes()).toContain('theme-toggle')
    expect(button.find('.theme-state-paper').text()).toContain('纸面')
    expect(button.find('.theme-state-darkroom').text()).toContain('暗房')
  })

  it('浅色系统偏好下呈现纸面态语义', async () => {
    stubMatchMedia(false)
    const wrapper = await mountSuspended(Host)
    const button = wrapper.find('button')

    expect(button.attributes('aria-pressed')).toBe('false')
    expect(button.attributes('aria-label')).toBe('切换到暗房模式')
    expect(button.attributes('title')).toBe('当前为纸面模式')
  })

  it('深色系统偏好且无显式覆盖时，初始即为暗房态', async () => {
    stubMatchMedia(true)
    const wrapper = await mountSuspended(Host)
    const button = wrapper.find('button')

    expect(button.attributes('aria-pressed')).toBe('true')
    expect(button.attributes('aria-label')).toBe('切换到纸面模式')
    // 未显式选择：不写 data-theme，颜色由 CSS 兜底
    expect(root().hasAttribute('data-theme')).toBe(false)
  })

  it('点击切换到暗房：aria 翻转并写 data-theme 与 localStorage', async () => {
    stubMatchMedia(false)
    const wrapper = await mountSuspended(Host)
    const button = wrapper.find('button')

    await button.trigger('click')
    expect(button.attributes('aria-pressed')).toBe('true')
    expect(button.attributes('aria-label')).toBe('切换到纸面模式')
    expect(button.attributes('title')).toBe('当前为暗房模式')
    expect(root().dataset.theme).toBe('darkroom')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('darkroom')
  })

  it('再次点击回到纸面：显式 paper 也写 data-theme', async () => {
    stubMatchMedia(false)
    const wrapper = await mountSuspended(Host)
    const button = wrapper.find('button')

    await button.trigger('click')
    await button.trigger('click')
    expect(button.attributes('aria-pressed')).toBe('false')
    expect(root().dataset.theme).toBe('paper')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('paper')
  })
})
