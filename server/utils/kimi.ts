/**
 * Venus Lite — Kimi 文件上传支持
 *
 * Kimi（Moonshot）场景下，将前端传入的 data URL / http URL 上传到
 * Moonshot 文件接口，换成 ms:// 协议地址供 venus-core engine 使用。
 *
 * 检测逻辑：全局 Provider baseURL 包含 'moonshot.cn' 时自动启用。
 */

import OpenAI from 'openai'
import type { AdapterHooks } from '@theogony/venus-core'

// ── 惰性单例 ─────────────────────────────────────────────
let kimiClient: OpenAI | null = null

/** 判断 baseURL 是否为 Kimi（Moonshot）服务端 */
export function isKimiProvider(baseURL: string): boolean {
  return baseURL.includes('moonshot.cn')
}

/**
 * 初始化 Kimi OpenAI 客户端（惰性，仅首次调用时创建）。
 * 若已初始化则直接返回。
 */
function getKimiClient(baseURL: string, apiKey: string): OpenAI {
  if (!kimiClient) {
    kimiClient = new OpenAI({ apiKey, baseURL })
  }
  return kimiClient
}

/**
 * 将图片 URL（data URL 或 http URL）上传到 Kimi，返回 ms:// 协议地址。
 *
 * - 已经是 ms:// 协议 → 直接透传
 * - data:image/... → 解析 base64 后上传
 * - http(s):// → fetch 远程图片后上传
 * - 其他格式 → 透传
 */
export async function resolveImageForKimi(
  imageUrl: string,
  baseURL: string,
  apiKey: string,
): Promise<string> {
  // 已经是 ms:// 协议，直接透传
  if (imageUrl.startsWith('ms://')) return imageUrl

  let buffer: Buffer
  let filename: string

  if (imageUrl.startsWith('data:')) {
    // 解析 data URL
    const match = imageUrl.match(/^data:image\/(\w+);base64,(.+)$/)
    if (!match) throw new Error('Invalid data URL format')
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1]
    buffer = Buffer.from(match[2]!, 'base64')
    filename = `image.${ext}`
  } else if (imageUrl.startsWith('http')) {
    // 获取远程图片
    const resp = await fetch(imageUrl)
    if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.status}`)
    buffer = Buffer.from(await resp.arrayBuffer())
    // 尝试从 Content-Type 推断扩展名
    const ct = resp.headers.get('content-type') || 'image/jpeg'
    const ext = ct.split('/')[1]?.split(';')[0] || 'jpg'
    filename = `image.${ext}`
  } else {
    // 未知格式，透传
    return imageUrl
  }

  // 通过 OpenAI SDK 上传文件
  const client = getKimiClient(baseURL, apiKey)
  const start = Date.now()
  const file = new File([buffer], filename, { type: `image/${filename.split('.').pop()}` })
  const fileObject = await client.files.create({
    file,
    // Kimi 使用 'image' purpose（OpenAI SDK 类型未涵盖，需断言）
    purpose: 'image' as never,
  })
  const elapsed = Date.now() - start
  console.log(
    `📎 Kimi file uploaded: ${fileObject.id} (${(buffer.length / 1024).toFixed(1)}KB, ${elapsed}ms)`,
  )

  return `ms://${fileObject.id}`
}

/**
 * 构建 Kimi 场景的 AdapterHooks。
 * 在 beforeEvaluate / beforeEvaluateGroup 中将图片 URL 转为 ms:// 协议。
 */
export function createKimiHooks(baseURL: string, apiKey: string): AdapterHooks {
  return {
    beforeEvaluate: async (params) => ({
      ...params,
      imageUrl: await resolveImageForKimi(params.imageUrl, baseURL, apiKey),
    }),
    beforeEvaluateGroup: async (params) => ({
      ...params,
      imageUrls: await Promise.all(
        params.imageUrls.map((url) => resolveImageForKimi(url, baseURL, apiKey)),
      ),
    }),
  }
}
