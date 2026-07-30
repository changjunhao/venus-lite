/**
 * 主题契约的单一来源 —— 由 nuxt.config.ts（head 内联脚本）与 app/composables/useTheme.ts 共同引用。
 *
 * 本文件必须保持为纯常量模块（不含任何 Nuxt 自动导入），
 * 否则 nuxt.config.ts 侧的 jiti 求值会失败。
 *
 * `html[data-theme]` 三态即全部契约：
 * - 无属性：跟随系统偏好，颜色由 tokens.css 的 prefers-color-scheme 兜底，无需 JS；
 * - `paper`：用户显式选纸面；
 * - `darkroom`：用户显式选暗房。
 */

export type Theme = 'paper' | 'darkroom'

/** localStorage 键名，与 venus 保持一致 */
export const THEME_STORAGE_KEY = 'venus-theme'

/** 仅接受两个合法值；其余（含旧品牌名）一律视为未选择，回落系统偏好 */
export function normalizeTheme(value: unknown): Theme | '' {
  return value === 'paper' || value === 'darkroom' ? value : ''
}

/**
 * head 内联阻塞脚本：首绘前把 localStorage 中的显式覆盖搬到 `html[data-theme]`。
 * 系统偏好由 CSS 兜底，故此处无需读 matchMedia。
 * 隐私模式下 localStorage 访问会抛异常，静默降级为跟随系统。
 *
 * 注意：脚本体内不得出现 `&` 或 `<`，避免序列化进 head 时被转义。
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='paper'||t==='darkroom'){document.documentElement.dataset.theme=t;}}catch(e){}})();`
