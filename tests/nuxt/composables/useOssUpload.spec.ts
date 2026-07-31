import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, effectScope, h } from 'vue'

// ── vi.hoisted：所有 mock 必须在模块加载前定义 ──

const { mockFetch, mockHead, mockPut, mockMultipartUpload, mockSignatureUrl } = vi.hoisted(() => {
  const mockFetch = vi.fn()
  // Nuxt 的 $fetch 在模块评估时捕获 globalThis.$fetch
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).$fetch = mockFetch
  return {
    mockFetch,
    mockHead: vi.fn(),
    mockPut: vi.fn(),
    mockMultipartUpload: vi.fn(),
    mockSignatureUrl: vi.fn(() => 'https://bucket.oss-cn-beijing.aliyuncs.com/signed-url'),
  }
})

vi.mock('ali-oss', () => ({
  default: class MockOSS {
    head = mockHead
    put = mockPut
    multipartUpload = mockMultipartUpload
    signatureUrl = mockSignatureUrl
  },
}))

// eslint-disable-next-line import/first
import {
  _resetClientForTesting,
  canFallback,
  deriveObjectKey,
  fileToDataURL,
  hashFile,
  mimeToExtension,
  MULTIPART_THRESHOLD,
  useOssUpload,
} from '#imports'

// ── 工具 ──

function createMockFile(name: string, type: string, size = 1000): File {
  const buffer = new ArrayBuffer(size)
  return new File([buffer], name, { type })
}

const FAKE_STS = {
  accessKeyId: 'sts-ak-id',
  accessKeySecret: 'sts-ak-secret',
  securityToken: 'sts-token',
  expiration: '2026-12-31T23:59:59Z',
  region: 'oss-cn-beijing',
  bucket: 'test-bucket',
}

// ── 全局设置 ──

beforeEach(() => {
  vi.clearAllMocks()
  // 重置模块级 OSS 客户端单例
  _resetClientForTesting()
  mockFetch.mockResolvedValue({ ...FAKE_STS })
  mockHead.mockRejectedValue(Object.assign(new Error('NoSuchKey'), { status: 404 }))
  mockPut.mockResolvedValue({ name: 'venus-lite/test.jpg' })
  mockMultipartUpload.mockResolvedValue({ name: 'venus-lite/test.jpg' })
  mockSignatureUrl.mockReturnValue('https://bucket.oss-cn-beijing.aliyuncs.com/signed-url')
})

// ── 纯函数测试 ──

describe('hashFile', () => {
  it('返回 64 位十六进制 SHA-256 字符串', async () => {
    const file = createMockFile('test.jpg', 'image/jpeg', 100)
    const hash = await hashFile(file)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('相同内容产生相同哈希', async () => {
    const file1 = createMockFile('a.jpg', 'image/jpeg', 256)
    const file2 = createMockFile('b.jpg', 'image/jpeg', 256)
    // 相同大小的零填充 ArrayBuffer → 相同哈希
    expect(await hashFile(file1)).toBe(await hashFile(file2))
  })
})

describe('mimeToExtension', () => {
  it('常见 MIME 正确映射', () => {
    expect(mimeToExtension('image/jpeg')).toBe('jpg')
    expect(mimeToExtension('image/jpg')).toBe('jpg')
    expect(mimeToExtension('image/png')).toBe('png')
    expect(mimeToExtension('image/webp')).toBe('webp')
    expect(mimeToExtension('image/tiff')).toBe('tiff')
    expect(mimeToExtension('image/heic')).toBe('heic')
  })

  it('未知 MIME 回退为 jpg', () => {
    expect(mimeToExtension('image/unknown')).toBe('jpg')
    expect(mimeToExtension('')).toBe('jpg')
  })
})

describe('deriveObjectKey', () => {
  it('生成 venus-lite/ 前缀 + hash + 扩展名', () => {
    const key = deriveObjectKey('abc123', 'png')
    expect(key).toBe('venus-lite/abc123.png')
  })
})

describe('fileToDataURL', () => {
  it('成功时返回 data URL', async () => {
    const file = createMockFile('photo.jpg', 'image/jpeg', 10)
    const result = await fileToDataURL(file)
    expect(result).toMatch(/^data:image\/jpeg;base64,/)
  })
})

describe('canFallback', () => {
  it('sts-unavailable 错误可回退', () => {
    const err = Object.assign(new Error('test'), { code: 'sts-unavailable' })
    expect(canFallback(err)).toBe(true)
  })

  it('其他错误码不可回退', () => {
    expect(canFallback(Object.assign(new Error(), { code: 'sts-failed' }))).toBe(false)
    expect(canFallback(Object.assign(new Error(), { code: 'upload-failed' }))).toBe(false)
    expect(canFallback(new Error('plain'))).toBe(false)
    expect(canFallback(null)).toBe(false)
    expect(canFallback('string')).toBe(false)
  })
})

// ── Composable 测试 ──

let api: ReturnType<typeof useOssUpload>

function createHost() {
  return defineComponent({
    setup() {
      api = useOssUpload()
      return () => h('span')
    },
  })
}

describe('useOssUpload', () => {
  beforeEach(async () => {
    await mountSuspended(createHost())
  })

  it('首次 upload：获取 STS + 创建客户端 + put 上传 + 返回签名 URL', async () => {
    const file = createMockFile('photo.jpg', 'image/jpeg', 1000)
    const result = await api.upload(file)

    // STS 获取
    expect(mockFetch).toHaveBeenCalledWith('/api/oss/sts')
    // HEAD 去重（404 → 不存在）
    expect(mockHead).toHaveBeenCalledOnce()
    // 小文件 → put
    expect(mockPut).toHaveBeenCalledOnce()
    expect(mockMultipartUpload).not.toHaveBeenCalled()
    // 签名 URL
    expect(mockSignatureUrl).toHaveBeenCalledOnce()
    // 结果
    expect(result.fallback).toBe(false)
    expect(result.deduplicated).toBe(false)
    expect(result.url).toBe('https://bucket.oss-cn-beijing.aliyuncs.com/signed-url')
    expect(result.key).toMatch(/^venus-lite\/[0-9a-f]{64}\.jpg$/)
  })

  it('第二次 upload 复用客户端（$fetch 只调用一次）', async () => {
    const file1 = createMockFile('a.jpg', 'image/jpeg', 100)
    const file2 = createMockFile('b.png', 'image/png', 200)

    await api.upload(file1)
    await api.upload(file2)

    // STS 只在首次初始化时调用（客户端单例复用）
    expect(mockFetch).toHaveBeenCalledTimes(1)
    // 两次上传
    expect(mockPut).toHaveBeenCalledTimes(2)
  })

  it('HEAD 200（已存在）→ 跳过上传，直接返回签名 URL', async () => {
    mockHead.mockResolvedValue({ status: 200 })
    const file = createMockFile('existing.jpg', 'image/jpeg', 1000)

    const result = await api.upload(file)

    expect(mockHead).toHaveBeenCalledOnce()
    expect(mockPut).not.toHaveBeenCalled()
    expect(mockMultipartUpload).not.toHaveBeenCalled()
    expect(result.deduplicated).toBe(true)
    expect(result.url).toBe('https://bucket.oss-cn-beijing.aliyuncs.com/signed-url')
  })

  it('大文件（>5MB）→ multipartUpload', async () => {
    const file = createMockFile('large.jpg', 'image/jpeg', MULTIPART_THRESHOLD + 1)

    await api.upload(file)

    expect(mockMultipartUpload).toHaveBeenCalledOnce()
    expect(mockMultipartUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^venus-lite\//),
      file,
      expect.objectContaining({ partSize: 2 * 1024 * 1024 }),
    )
    expect(mockPut).not.toHaveBeenCalled()
  })

  it('STS 503 → 回退 data URL', async () => {
    mockFetch.mockRejectedValue(Object.assign(new Error('Service Unavailable'), { statusCode: 503 }))
    const file = createMockFile('photo.jpg', 'image/jpeg', 100)

    const result = await api.upload(file)

    expect(result.fallback).toBe(true)
    expect(result.url).toMatch(/^data:image\/jpeg;base64,/)
    expect(result.key).toBe('')
    expect(mockPut).not.toHaveBeenCalled()
  })

  it('STS 500 → 抛出 sts-failed，error 状态有值', async () => {
    mockFetch.mockRejectedValue(Object.assign(new Error('Internal Error'), { statusCode: 500 }))
    const file = createMockFile('photo.jpg', 'image/jpeg', 100)

    await expect(api.upload(file)).rejects.toThrow('照片准备失败')
    expect(api.error.value).toEqual({ code: 'sts-failed', fileName: 'photo.jpg' })
  })

  it('上传失败 → error 状态为 upload-failed', async () => {
    mockPut.mockRejectedValue(new Error('network error'))
    const file = createMockFile('photo.jpg', 'image/jpeg', 100)

    await expect(api.upload(file)).rejects.toThrow('network error')
    expect(api.error.value).toEqual({ code: 'upload-failed', fileName: 'photo.jpg' })
  })

  it('uploading 状态在上传前后正确变化', async () => {
    const file = createMockFile('photo.jpg', 'image/jpeg', 100)
    expect(api.uploading.value).toBe(false)

    const promise = api.upload(file)
    // 异步执行中 uploading 为 true
    expect(api.uploading.value).toBe(true)

    await promise
    expect(api.uploading.value).toBe(false)
  })

  it('reset 清除 error 和 progress', async () => {
    mockPut.mockRejectedValue(new Error('fail'))
    const file = createMockFile('photo.jpg', 'image/jpeg', 100)
    await api.upload(file).catch(() => {})

    expect(api.error.value).not.toBeNull()

    api.reset()
    expect(api.error.value).toBeNull()
    expect(api.progress.value).toEqual({ phase: 'preparing', percent: 0 })
  })

  it('uploadMultiple：串行上传，单张失败不中断批次', async () => {
    // 第一次 put 成功，第二次失败，第三次成功
    mockPut
      .mockResolvedValueOnce({ name: 'ok1' })
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({ name: 'ok3' })

    const files = [
      createMockFile('a.jpg', 'image/jpeg', 100),
      createMockFile('b.jpg', 'image/jpeg', 200),
      createMockFile('c.jpg', 'image/jpeg', 300),
    ]

    const { results, errors } = await api.uploadMultiple(files)

    expect(results).toHaveLength(3)
    expect(results[0]).not.toBeNull()
    expect(results[1]).toBeNull()
    expect(results[2]).not.toBeNull()
    expect(errors).toHaveLength(1)
    expect(errors[0]!.fileName).toBe('b.jpg')
  })

  it('scope dispose → aborted，uploadMultiple 提前终止', async () => {
    const scope = effectScope()
    let scopeApi: ReturnType<typeof useOssUpload>

    scope.run(() => {
      scopeApi = useOssUpload()
    })

    // dispose 后 aborted = true
    scope.stop()

    const files = [
      createMockFile('a.jpg', 'image/jpeg', 100),
      createMockFile('b.jpg', 'image/jpeg', 200),
    ]
    const { results } = await scopeApi!.uploadMultiple(files)

    // 因 aborted，不会处理任何文件
    expect(results).toHaveLength(0)
    expect(mockPut).not.toHaveBeenCalled()
  })
})
