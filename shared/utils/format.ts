/**
 * 前后端共享的纯工具函数。
 *
 * 位于 shared/utils/ 下，Nuxt 4 会同时向 app 与 server 自动导入。
 */

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
