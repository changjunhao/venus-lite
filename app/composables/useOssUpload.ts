/**
 * 图片上传 —— 收敛 venus upload.js 的 OSS 直传逻辑为 Nuxt composable。
 * 参考 sgave useOssUpload.ts 的客户端单例 + refreshSTSToken 模式。
 *
 * 职责（component-plan.md §2.5）：
 * - SHA-256 哈希去重（原生 crypto.subtle，替代 js-sha256 CDN — §四.6）
 * - STS 凭证获取 + ali-oss 客户端单例（惰性 import — §四.5）
 * - 凭证过期自动续期（refreshSTSToken）
 * - 分片上传（>5MB）/ 简单 put（≤5MB）
 * - data URL 回退（STS 未配置时）
 *
 * 不含：OSS 状态探测（明确排除）。
 *
 * 消费方：
 * - SingleEvaluationFlow.vue（单图 upload）
 * - JointEvaluationFlow.vue / CompareEvaluationFlow.vue（多图 uploadMultiple）
 */

import type OSS from 'ali-oss'
import type { StsCredentials } from '#shared/types/api'

// ── 常量（对齐 venus upload.js L8, L148-153, L192-193）──

export const MULTIPART_THRESHOLD = 5 * 1024 * 1024 // 5MB（upload.js L8）
const PART_SIZE = 2 * 1024 * 1024 // 2MB（upload.js L193）
const UPLOAD_PREFIX = 'venus-lite/' // 对齐 .env OSS_DIRECTORY
const SIGN_URL_EXPIRES = 600 // 签名 URL 有效期（秒）
const HEAD_TIMEOUT_MS = 3000 // HEAD 去重超时保护

/** MIME → 扩展名映射（收敛 upload.js L148-153） */
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/avif': 'avif',
}

// ── 类型 ──

export type UploadErrorCode =
  | 'sts-unavailable' // STS 端点 503（未配置）→ 可回退 data URL
  | 'sts-failed' // STS 端点 5xx
  | 'upload-failed' // OSS put/multipart 失败
  | 'file-unreadable' // File 无法读取

export interface UploadError {
  code: UploadErrorCode
  fileName: string
}

export interface UploadResult {
  /** 可访问的图片 URL（签名 URL 或 data URL） */
  url: string
  /** 对象键（OSS 路径有值，回退时为空） */
  key: string
  /** HEAD 命中已有对象 */
  deduplicated: boolean
  /** 走了 data URL 回退 */
  fallback: boolean
}

export interface UploadProgress {
  phase: 'hashing' | 'preparing' | 'uploading' | 'finalizing'
  /** 0-100（仅 uploading 阶段有中间值） */
  percent: number
}

// ── 纯函数区（无 Vue 依赖，可独立测试）──

/**
 * SHA-256 哈希（替代 venus upload.js L123-126 的 js-sha256 CDN，
 * 使用原生 crypto.subtle — component-plan.md §四.6）。
 * 返回 64 位十六进制小写字符串。
 */
export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/** MIME → 扩展名（收敛 upload.js L148-153）；未知类型回退 'jpg' */
export function mimeToExtension(mime: string): string {
  return MIME_TO_EXT[mime] ?? 'jpg'
}

/** 由 hash + ext 派生 OSS 对象键（对齐 venus/src/oss.js L101） */
export function deriveObjectKey(hash: string, ext: string): string {
  return `${UPLOAD_PREFIX}${hash}.${ext}`
}

/** File → data URL 回退（对齐 upload.js L30-37） */
export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('file-unreadable'))
    reader.readAsDataURL(file)
  })
}

/** 判断错误是否可回退到 data URL（对齐 upload.js L134-136 canFallbackFromOSS） */
export function canFallback(error: unknown): boolean {
  return error instanceof Error
    && (error as Error & { code?: string }).code === 'sts-unavailable'
}

// ── 模块级单例（跨 composable 实例共享，对齐参考 ossClient ref）──

let ossClient: OSS | null = null
let initPromise: Promise<OSS> | null = null

/** @internal 仅测试用：重置客户端单例 */
export function _resetClientForTesting(): void {
  ossClient = null
  initPromise = null
}

/**
 * 获取 STS 凭证（每次调用都请求新凭证，不做缓存）。
 * 用于 initClient 首次创建 + refreshSTSToken 续期。
 */
async function fetchStsToken(): Promise<StsCredentials> {
  try {
    return await $fetch<StsCredentials>('/api/oss/sts')
  }
  catch (err: unknown) {
    const statusCode = (err as { statusCode?: number })?.statusCode
    const error = new Error(
      statusCode === 503 ? '照片准备服务暂不可用' : '照片准备失败',
    ) as Error & { code: UploadErrorCode }
    error.code = statusCode === 503 ? 'sts-unavailable' : 'sts-failed'
    throw error
  }
}

/**
 * 初始化 OSS 客户端（单例，对齐参考 initClient L39-69）。
 * 已初始化则直接返回现有实例；凭证过期由 refreshSTSToken 自动续期。
 */
async function initClient(): Promise<OSS> {
  if (ossClient) return ossClient
  if (initPromise) return initPromise

  initPromise = (async () => {
    const { default: OSSClass } = await import('ali-oss')
    const sts = await fetchStsToken()

    ossClient = new OSSClass({
      region: sts.region,
      accessKeyId: sts.accessKeyId,
      accessKeySecret: sts.accessKeySecret,
      stsToken: sts.securityToken,
      bucket: sts.bucket,
      refreshSTSToken: async () => {
        const fresh = await fetchStsToken()
        return {
          accessKeyId: fresh.accessKeyId,
          accessKeySecret: fresh.accessKeySecret,
          stsToken: fresh.securityToken,
        }
      },
    })
    return ossClient
  })()

  try {
    return await initPromise
  }
  finally {
    initPromise = null
  }
}

// ── Composable 主体 ──

/**
 * 图片上传管理（DESIGN.md §9.5：上传区错误状态不暴露实现名词）。
 *
 * - 单例 OSS 客户端，首次 upload 时惰性初始化
 * - 凭证过期由 ali-oss 内部调用 refreshSTSToken 自动续期
 * - STS 未配置（503）时静默回退 data URL
 * - 状态用 shallowRef，避免深度响应式
 */
export function useOssUpload() {
  const uploading = shallowRef(false)
  const progress = shallowRef<UploadProgress>({ phase: 'preparing', percent: 0 })
  const error = shallowRef<UploadError | null>(null)

  let aborted = false

  /**
   * 上传单张图片（对齐 venus upload.js L138-215，去除 status 探测）。
   *
   * 流程：hash → initClient（单例）→ HEAD 去重 → put/multipart → signatureUrl
   * 回退：STS 未配置（503）→ fileToDataURL
   */
  async function upload(file: File): Promise<UploadResult> {
    uploading.value = true
    error.value = null

    try {
      // ① SHA-256 哈希 + 派生 key
      progress.value = { phase: 'hashing', percent: 0 }
      const hash = await hashFile(file)
      const key = deriveObjectKey(hash, mimeToExtension(file.type))

      // ② 初始化客户端（首次创建，后续复用；STS 503 → 回退）
      progress.value = { phase: 'preparing', percent: 0 }
      let client: OSS
      try {
        client = await initClient()
      }
      catch (stsErr) {
        if (canFallback(stsErr)) {
          const dataUrl = await fileToDataURL(file)
          return { url: dataUrl, key: '', deduplicated: false, fallback: true }
        }
        throw stsErr
      }

      // ③ HEAD 去重（超时保护，失败不阻塞 — 最坏情况重复上传）
      let exists = false
      try {
        await Promise.race([
          client.head(key),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), HEAD_TIMEOUT_MS)),
        ])
        exists = true
      }
      catch { /* 404 / 超时 / 权限不足 → 视为不存在，继续上传 */ }

      // ④ 上传（对齐 upload.js L191-201：分片 >5MB / 简单 put ≤5MB）
      if (!exists) {
        progress.value = { phase: 'uploading', percent: 0 }
        if (file.size > MULTIPART_THRESHOLD) {
          await client.multipartUpload(key, file, {
            partSize: PART_SIZE,
            progress: (p: number) => {
              progress.value = { phase: 'uploading', percent: Math.round(p * 100) }
            },
          })
        }
        else {
          await client.put(key, file)
        }
      }

      // ⑤ 生成签名 URL（对齐 venus/src/oss.js L178：expires 600s）
      progress.value = { phase: 'finalizing', percent: 100 }
      const url = client.signatureUrl(key, { expires: SIGN_URL_EXPIRES })

      return { url, key, deduplicated: exists, fallback: false }
    }
    catch (err: unknown) {
      const code = (err as Error & { code?: UploadErrorCode })?.code ?? 'upload-failed'
      error.value = { code, fileName: file.name }
      throw err
    }
    finally {
      uploading.value = false
    }
  }

  /**
   * 批量上传（组图场景，串行逐张 — 对齐 group.js L301-321）。
   * 单张失败不中断批次，收集错误后统一返回。
   */
  async function uploadMultiple(
    files: File[],
    onProgress?: (index: number, progress: UploadProgress) => void,
  ): Promise<{ results: (UploadResult | null)[]; errors: UploadError[] }> {
    const results: (UploadResult | null)[] = []
    const errors: UploadError[] = []

    for (let i = 0; i < files.length; i++) {
      if (aborted) break
      const file = files[i]!
      try {
        results.push(await upload(file))
      }
      catch {
        results.push(null)
        errors.push(error.value ?? { code: 'upload-failed', fileName: file.name })
      }
      onProgress?.(i, progress.value)
    }

    return { results, errors }
  }

  function reset(): void {
    error.value = null
    progress.value = { phase: 'preparing', percent: 0 }
  }

  // 对齐 useImageSelection 的 onScopeDispose 清理模式
  onScopeDispose(() => {
    aborted = true
    uploading.value = false
  })

  return { uploading, progress, error, upload, uploadMultiple, reset }
}
