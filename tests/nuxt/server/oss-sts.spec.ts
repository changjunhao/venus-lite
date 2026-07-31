// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Nitro server 自动导入（defineEventHandler / useRuntimeConfig）在 vitest 中不经转换，
// 仅需模块加载不报错；测试目标为 fetchStsCredentials，非 default export。
vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).defineEventHandler = (h: any) => h
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).useRuntimeConfig = () => ({})
})

// ── Mock STS SDK ──
const mockAssumeRole = vi.fn()

vi.mock('@alicloud/sts20150401', () => ({
  default: class MockStsClient {
    assumeRole = mockAssumeRole
  },
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  AssumeRoleRequest: function (map: Record<string, unknown>) { return map },
}))

vi.mock('@alicloud/openapi-core', () => ({
  $OpenApiUtil: {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    Config: function (map: Record<string, unknown>) { return map },
  },
}))

const { fetchStsCredentials } = await import('~~/server/api/oss/sts.get')

const VALID_CONFIG = {
  ossRegion: 'oss-cn-beijing',
  ossBucket: 'test-bucket',
  ossStsRoleArn: 'acs:ram::123456:role/test-role',
  ossStsAccessKeyId: 'test-ak-id',
  ossStsAccessKeySecret: 'test-ak-secret',
  ossStsSessionDurationSeconds: 900,
}

const FAKE_CREDENTIALS = {
  accessKeyId: 'sts-ak-id',
  accessKeySecret: 'sts-ak-secret',
  securityToken: 'sts-token',
  expiration: '2026-07-31T12:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchStsCredentials', () => {
  it('returns credentials with region and bucket on success', async () => {
    mockAssumeRole.mockResolvedValue({ body: { credentials: FAKE_CREDENTIALS } })

    const result = await fetchStsCredentials({ ...VALID_CONFIG })

    expect(result).toEqual({
      accessKeyId: 'sts-ak-id',
      accessKeySecret: 'sts-ak-secret',
      securityToken: 'sts-token',
      expiration: '2026-07-31T12:00:00Z',
      region: 'oss-cn-beijing',
      bucket: 'test-bucket',
    })
    expect(mockAssumeRole).toHaveBeenCalledOnce()
  })

  it('throws 503 when role ARN is missing', async () => {
    const err = await fetchStsCredentials({ ...VALID_CONFIG, ossStsRoleArn: '' }).catch(e => e)

    expect(err.statusCode).toBe(503)
    expect(err.data.code).toBe('STS_DISABLED')
    expect(mockAssumeRole).not.toHaveBeenCalled()
  })

  it('throws 503 when access key is missing', async () => {
    const err = await fetchStsCredentials({ ...VALID_CONFIG, ossStsAccessKeyId: '' }).catch(e => e)

    expect(err.statusCode).toBe(503)
    expect(err.data.code).toBe('STS_DISABLED')
  })

  it('throws 500 when assumeRole fails', async () => {
    mockAssumeRole.mockRejectedValue(new Error('network error'))

    const err = await fetchStsCredentials({ ...VALID_CONFIG }).catch(e => e)

    expect(err.statusCode).toBe(500)
    expect(err.data.code).toBe('STS_ERROR')
  })

  it('throws 500 when credentials field is absent', async () => {
    mockAssumeRole.mockResolvedValue({ body: {} })

    const err = await fetchStsCredentials({ ...VALID_CONFIG }).catch(e => e)

    expect(err.statusCode).toBe(500)
    expect(err.data.code).toBe('STS_ERROR')
  })

  it('falls back to empty string when credential fields are undefined', async () => {
    mockAssumeRole.mockResolvedValue({
      body: { credentials: { accessKeyId: 'ak', accessKeySecret: undefined, securityToken: undefined, expiration: undefined } },
    })

    const result = await fetchStsCredentials({ ...VALID_CONFIG })

    expect(result.accessKeyId).toBe('ak')
    expect(result.accessKeySecret).toBe('')
    expect(result.securityToken).toBe('')
    expect(result.expiration).toBe('')
  })
})
