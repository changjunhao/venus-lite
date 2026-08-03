/**
 * Venus Lite — Kimi 文件上传支持
 *
 * Kimi（Moonshot）场景下，将前端传入的 data URL / http URL 上传到
 * Moonshot 文件接口，换成 ms:// 协议地址供 venus-core engine 使用。
 *
 * 检测逻辑：全局 Provider baseURL 包含 'moonshot.cn' 时自动启用。
 */

import OpenAI from 'openai'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import type { AdapterHooks } from '@theogony/venus-core'

// ── SSRF 防护 ───────────────────────────────────────────
// imageUrl 由用户请求体直接提供，fetch 前必须阻断内网/回环/链路本地/云元数据地址，
// 否则攻击者可借 POST /api/evaluate 探测内网或读取云实例元数据（CWE-918）。

/** 重定向跟随上限（手动跟随并对每跳重新校验目标，防止经 302 跳入内网） */
const MAX_REDIRECTS = 5

/** 判断 IPv4/IPv6 是否落在私有、保留、回环、链路本地或未指定地址段 */
function isBlockedIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a = 0, b = 0] = ip.split('.').map(Number)
    return (
      a === 10 // 10.0.0.0/8
      || a === 127 // 127.0.0.0/8 回环
      || a === 0 // 0.0.0.0/8
      || (a === 100 && b >= 64 && b <= 127) // 100.64.0.0/10 CGNAT
      || (a === 169 && b === 254) // 169.254.0.0/16 链路本地 + 云元数据 169.254.169.254
      || (a === 172 && b >= 16 && b <= 31) // 172.16.0.0/12
      || (a === 192 && b === 168) // 192.168.0.0/16
      || a >= 224 // 组播 / 保留段
    )
  }
  // IPv6：::1 回环、fe80::/10 链路本地、fc00::/7 ULA、:: 未指定
  const v6 = ip.toLowerCase()
  return (
    v6 === '::1'
    || v6 === '::'
    || v6.startsWith('fe8')
    || v6.startsWith('fc')
    || v6.startsWith('fd')
  )
}

/**
 * 校验目标 URL 可安全抓取：仅 https；主机为 IP 字面量时直接判段，
 * 为域名时先 DNS 解析再对全部解析结果判段（缓解 DNS 重绑定）。
 */
async function assertSafeFetchTarget(rawUrl: string): Promise<void> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('Invalid image URL')
  }
  if (url.protocol !== 'https:') throw new Error('Only https image URLs are allowed')

  const host = url.hostname.replace(/^\[|\]$/g, '')
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true })).map((r) => r.address)
  if (ips.some(isBlockedIp)) throw new Error('Image URL resolves to a blocked address')
}

/** 手动跟随重定向的 fetch：每跳均重新做 SSRF 校验 */
async function safeFetchImage(rawUrl: string): Promise<Response> {
  let currentUrl = rawUrl
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertSafeFetchTarget(currentUrl)
    const resp = await fetch(currentUrl, { redirect: 'manual' })
    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get('location')
      if (!location) throw new Error(`Redirect without location: ${resp.status}`)
      currentUrl = new URL(location, currentUrl).toString()
      continue
    }
    return resp
  }
  throw new Error('Too many redirects')
}

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
    // 获取远程图片（fetch 前做 SSRF 校验，见 assertSafeFetchTarget）
    const resp = await safeFetchImage(imageUrl)
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
