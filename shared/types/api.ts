/**
 * 前后端共享的 API 类型契约。
 *
 * 位于 shared/types/ 下，Nuxt 4 会同时向 app 与 server 自动导入，
 * 也可通过 `#shared/types/api` 显式导入。
 */

/** 统一错误结构：服务端经 createError({ data }) 返回 */
export interface ApiError {
  code: string
  message: string
}

/** 健康检查响应 */
export interface HealthStatus {
  status: 'ok'
  version: string
  time: string
}

/** STS 临时凭证（OSS 直传用） */
export interface StsCredentials {
  accessKeyId: string
  accessKeySecret: string
  securityToken: string
  expiration: string
  /** OSS 所在区域，如 oss-cn-beijing */
  region: string
  /** 目标 Bucket 名称 */
  bucket: string
}

/** 备忘录条目（架构演示用） */
export interface Note {
  id: string
  title: string
  createdAt: string
}
