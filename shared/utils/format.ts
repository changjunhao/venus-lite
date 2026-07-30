/**
 * 前后端共享的纯工具函数。
 *
 * 位于 shared/utils/ 下，Nuxt 4 会同时向 app 与 server 自动导入。
 */

/** 将 ISO 时间格式化为 "MM/DD HH:mm"（中文环境） */
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
