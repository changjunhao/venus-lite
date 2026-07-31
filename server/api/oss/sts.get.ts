import StsClientPkg, { AssumeRoleRequest } from '@alicloud/sts20150401'
import { $OpenApiUtil } from '@alicloud/openapi-core'
import type { StsCredentials } from '#shared/types/api'

// CJS/ESM interop：Nitro 外部化 CJS 包时 default import 可能是 module.exports 整体
const StsClient: typeof StsClientPkg = typeof StsClientPkg === 'function'
  ? StsClientPkg
  : (StsClientPkg as Record<string, unknown>).default as typeof StsClientPkg

type StsClientInstance = InstanceType<typeof StsClient>

/**
 * GET /api/oss/sts — 签发 STS 临时凭证（前端直传 OSS 用）。
 */

// ── STS 客户端（惰性单例）──
let stsClient: StsClientInstance | null = null

function getStsClient(accessKeyId: string, accessKeySecret: string, regionId: string): StsClientInstance {
  if (!stsClient) {
    stsClient = new StsClient(new $OpenApiUtil.Config({
      accessKeyId,
      accessKeySecret,
      endpoint: 'sts.aliyuncs.com',
      regionId,
    }))
  }
  return stsClient
}

/** 构造带 statusCode / data 的错误对象，h3 会按 statusCode 响应 */
function apiError(statusCode: number, statusMessage: string, code: string, message: string) {
  return Object.assign(new Error(message), { statusCode, statusMessage, data: { code, message } })
}

export interface StsConfig {
  ossRegion: string
  ossBucket: string
  ossStsRoleArn: string
  ossStsAccessKeyId: string
  ossStsAccessKeySecret: string
  ossStsSessionDurationSeconds: number | string
}

/** 校验配置 + 签发 STS 凭证 —— 纯逻辑，不依赖 Nuxt 自动导入 */
export async function fetchStsCredentials(config: StsConfig): Promise<StsCredentials> {
  if (!config.ossStsRoleArn || !config.ossStsAccessKeyId || !config.ossStsAccessKeySecret) {
    throw apiError(503, 'Service Unavailable', 'STS_DISABLED', 'STS not configured')
  }

  const client = getStsClient(config.ossStsAccessKeyId, config.ossStsAccessKeySecret, config.ossRegion)

  try {
    const request = new AssumeRoleRequest({
      roleArn: config.ossStsRoleArn,
      roleSessionName: `venus-lite-upload-${Date.now()}`,
      durationSeconds: Number(config.ossStsSessionDurationSeconds) || 900,
    })
    const response = await client.assumeRole(request)
    const credentials = response.body?.credentials

    if (!credentials) {
      throw new Error('Missing credentials in STS response')
    }

    return {
      accessKeyId: credentials.accessKeyId ?? '',
      accessKeySecret: credentials.accessKeySecret ?? '',
      securityToken: credentials.securityToken ?? '',
      expiration: credentials.expiration ?? '',
      region: config.ossRegion,
      bucket: config.ossBucket,
    }
  }
  catch (err) {
    console.error('[oss/sts] assume role failed:', err instanceof Error ? err.message : err)
    throw apiError(500, 'Internal Server Error', 'STS_ERROR', 'STS assume role failed')
  }
}

export default defineEventHandler(async (event): Promise<StsCredentials> => {
  return fetchStsCredentials(useRuntimeConfig(event))
})
