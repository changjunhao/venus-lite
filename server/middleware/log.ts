/**
 * Server middleware 示例：对所有 API 请求打一行日志。
 * server/middleware/ 下的文件会在每个请求前执行。
 */
export default defineEventHandler((event) => {
  if (event.path.startsWith('/api/')) {
    console.log(`[api] ${event.method} ${event.path}`)
  }
})
