/**
 * 前后端共享的纯工具函数。
 *
 * 位于 shared/utils/ 下，Nuxt 4 会同时向 app 与 server 自动导入。
 */

/** 拆分文件名主体与扩展名，截断展示时保留扩展名（DESIGN.md §13.2）；点开头/点结尾/含点扩展名超 8 字符视为无扩展名 */
export function splitFileName(name: string): { stem: string; ext: string } {
  const value = String(name ?? '')
  const dot = value.lastIndexOf('.')
  if (dot <= 0 || dot === value.length - 1 || value.length - dot > 8) return { stem: value, ext: '' }
  return { stem: value.slice(0, dot), ext: value.slice(dot) }
}

/** 将 ISO 时间格式化为短日期时间（默认中文环境，调用方可传入当前 BCP-47 locale） */
export function formatDateTime(isoString: string, locale = 'zh-CN'): string {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 文件体积格式化（逐行移植 venus utils.js L24-28）：B / KB / MB 三档，KB 与 MB 保留一位小数 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
