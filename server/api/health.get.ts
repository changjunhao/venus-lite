import type { HealthStatus } from '#shared/types/api'

/**
 * GET /api/health — 健康检查示例。
 * 演示 useRuntimeConfig(event) 读取服务端私有配置（NUXT_APP_VERSION 覆盖）。
 */
export default defineEventHandler((event): HealthStatus => {
  const config = useRuntimeConfig(event)
  return {
    status: 'ok',
    version: config.appVersion || 'dev',
    time: new Date().toISOString(),
  }
})
