import { normalizeTheme, THEME_STORAGE_KEY, type Theme } from '#shared/theme'

export type { Theme }

/** 主题切换只过渡颜色，时长与 --motion-standard 一致（DESIGN.md §9.4 / §12.3） */
const TRANSITION_MS = 180

/**
 * 双主题（纸面 / 暗房）管理 —— 三态级联，不使用 cookie：
 * - 未显式选择：html 上无 data-theme，颜色由 tokens.css 的 prefers-color-scheme 兜底，
 *   并跟随系统主题实时变化（禁用 JS 亦正确）；
 * - 显式选择：nuxt.config.ts 的 head 内联脚本在首绘前写入 data-theme，此处只负责后续切换；
 * - 切换：写 state + localStorage + DOM，颜色过渡 180ms。
 *
 * localStorage 与 matchMedia 的读取一律推迟到 onMounted：
 * setup 阶段两端渲染输入必须一致，否则触发 hydration 属性 mismatch。
 */
export function useTheme() {
  // 显式偏好；'' 表示跟随系统
  const theme = useState<Theme | ''>('venus-theme', () => '')
  // 系统偏好：服务端无从得知，恒为 paper，挂载后由 matchMedia 实测并持续跟随
  const systemTheme = useState<Theme>('venus-theme-system', () => 'paper')

  const resolvedTheme = computed<Theme>(() => theme.value || systemTheme.value)
  const isDarkroom = computed(() => resolvedTheme.value === 'darkroom')

  if (import.meta.client) {
    // useTheme 可能被多个组件调用，副作用只注册一次
    const initialized = useState('venus-theme-client', () => false)
    if (!initialized.value) {
      initialized.value = true
      onMounted(() => {
        try {
          theme.value = normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY))
        }
        catch {
          // 隐私模式读不到 localStorage：跟随系统
        }

        const query = window.matchMedia('(prefers-color-scheme: dark)')
        systemTheme.value = query.matches ? 'darkroom' : 'paper'
        query.addEventListener('change', (event) => {
          systemTheme.value = event.matches ? 'darkroom' : 'paper'
        })

        // 监听在首帧状态对齐之后注册：此时 DOM 与 state 已一致，
        // 不会为内联脚本写好的初值重复写属性或触发无谓过渡。
        watch(theme, (value) => {
          startColorTransition()
          const root = document.documentElement
          // 显式 paper 也要写属性，否则无法压过系统深色
          if (value) root.dataset.theme = value
          else root.removeAttribute('data-theme')
        })

        watch(systemTheme, () => {
          // 已有显式偏好时系统变化不影响呈现，无需过渡
          if (!theme.value) startColorTransition()
        })
      })
    }
  }

  function startColorTransition() {
    const root = document.documentElement
    root.classList.add('theme-transitioning')
    window.setTimeout(() => root.classList.remove('theme-transitioning'), TRANSITION_MS)
  }

  /** 切换并固定为显式偏好，此后不再跟随系统 */
  function toggle() {
    const next: Theme = isDarkroom.value ? 'paper' : 'darkroom'
    theme.value = next
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    }
    catch {
      // 隐私模式写不进：本次会话内仍生效
    }
  }

  return { theme, resolvedTheme, isDarkroom, toggle }
}
