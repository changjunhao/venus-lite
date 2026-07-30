export type Theme = 'paper' | 'darkroom'

const COOKIE_KEY = 'venus-theme'

/**
 * 首访（无 cookie）时在首帧渲染前执行的内联脚本：
 * 优先读 cookie，否则跟随系统 prefers-color-scheme，避免主题闪烁。
 */
const FIRST_VISIT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${COOKIE_KEY}=(paper|darkroom)/);var t=m?m[1]:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'darkroom':'paper');if(t==='darkroom'){document.documentElement.dataset.theme='darkroom';}}catch(e){}})();`

function normalizeTheme(value: unknown): Theme | '' {
  return value === 'paper' || value === 'darkroom' ? value : ''
}

/**
 * 双主题（纸面 / 暗房）管理 — cookie 驱动的 SSR 无闪烁方案：
 * - 有 cookie：服务端直出 html[data-theme]，无任何闪烁；
 * - 无 cookie（首访）：head 顶部内联脚本按系统偏好即时设置；
 * - 切换：更新 state + cookie + DOM，颜色过渡 180ms（DESIGN.md §9.4）。
 */
export function useTheme() {
  const cookie = useCookie<string>(COOKIE_KEY, {
    default: () => '',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  const theme = useState<Theme | ''>('venus-theme', () => normalizeTheme(cookie.value))

  // head 注册只做一次（useTheme 可能被多个组件调用）
  const headRegistered = useState('venus-theme-head', () => false)
  if (!headRegistered.value) {
    headRegistered.value = true
    // 仅服务端输出：已知主题直接写在 html 上；内联脚本兜底首访场景
    useServerHead({
      htmlAttrs: theme.value === 'darkroom' ? { 'data-theme': 'darkroom' } : {},
      script: [{ innerHTML: FIRST_VISIT_SCRIPT, tagPosition: 'head' }],
    })
  }

  if (import.meta.client) {
    // 首访：内联脚本已设置 DOM，把结果同步回 state（不写 cookie，尊重系统偏好变化）
    if (!theme.value) {
      theme.value = document.documentElement.dataset.theme === 'darkroom' ? 'darkroom' : 'paper'
    }

    watch(theme, (value) => {
      if (!value) return
      const root = document.documentElement
      const current = root.dataset.theme === 'darkroom' ? 'darkroom' : 'paper'
      if (current === value) return
      root.classList.add('theme-transitioning')
      if (value === 'darkroom') root.dataset.theme = 'darkroom'
      else root.removeAttribute('data-theme')
      window.setTimeout(() => root.classList.remove('theme-transitioning'), 180)
    })
  }

  const isDarkroom = computed(() => theme.value === 'darkroom')

  function toggle() {
    const next: Theme = isDarkroom.value ? 'paper' : 'darkroom'
    theme.value = next
    cookie.value = next
  }

  return { theme, isDarkroom, toggle }
}
