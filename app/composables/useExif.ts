/**
 * EXIF 提取 —— 逐行移植 venus upload.js#extractExif（L45-116）为 Nuxt composable。
 *
 * 职责（component-plan.md §2.5）：
 * - ExifReader computed 模式提取 8 字段（快门/ISO/光圈/焦距/机身/镜头/时间/闪光）
 * - 日期格式化（"2024:01:15 10:30:00" → "2024-01-15 10:30"）
 * - 客户端专属（SSR 守卫 + 惰性 import — §四.5）
 *
 * 消费方：
 * - SingleEvaluationFlow.vue → SinglePreview / ExifTagList（输入区）
 * - ExifPanel.vue（结果区，未来）
 */

import type { ExifData } from '#shared/types/evaluation'

// ── 模块级 ExifReader 缓存（避免重复 dynamic import）──

let exifReaderModule: typeof import('exifreader') | null = null

async function getExifReader(): Promise<typeof import('exifreader')> {
  if (!exifReaderModule) {
    exifReaderModule = await import('exifreader')
  }
  return exifReaderModule
}

// ── 纯函数区（无 Vue 依赖，可独立测试）──

/**
 * 日期格式化（对齐 upload.js L97-99）：
 * "2024:01:15 10:30:00" → "2024-01-15 10:30"
 */
function formatExifDate(raw: string): string {
  return raw
    .replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')
    .replace(/:\d{2}$/, '')
}

/**
 * 从图片 File 中提取 EXIF 元数据（对齐 upload.js L45-116）。
 *
 * 使用 ExifReader computed 模式，避免 rational 类型解析错误。
 * 提取失败或无字段时返回 null（静默，不抛异常）。
 */
export async function extractExif(file: File): Promise<ExifData | null> {
  // SSR 守卫：服务端无 File API（§四.5）
  if (import.meta.server) return null

  try {
    const buffer = await file.arrayBuffer()
    const ExifReader = await getExifReader()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tags: Record<string, any> = await ExifReader.load(buffer, { computed: true })

    const exif: ExifData = {}

    // 快门速度 — rational 类型，优先取 computed（upload.js L54-56）
    if (tags.ShutterSpeedValue?.computed != null) {
      exif.shutterSpeed = tags.ShutterSpeedValue.description || `${tags.ShutterSpeedValue.computed}`
    }

    // ISO — 整型（upload.js L59-63）
    if (tags.ISOSpeedRatings?.value != null) {
      const iso = typeof tags.ISOSpeedRatings.value === 'number'
        ? tags.ISOSpeedRatings.value
        : parseInt(String(tags.ISOSpeedRatings.value))
      if (!isNaN(iso)) exif.iso = iso
    }

    // 光圈 — rational 类型，使用 computed 避免 f/1.4 误为 f/14（upload.js L67-69）
    if (tags.FNumber?.computed != null) {
      exif.fNumber = tags.FNumber.computed
    }

    // 焦距 — rational 类型，使用 computed（upload.js L72-74）
    if (tags.FocalLength?.computed != null) {
      exif.focalLength = tags.FocalLength.computed
    }

    // 相机型号 — 字符串（upload.js L77-79）
    if (tags.Model?.description) {
      exif.cameraModel = tags.Model.description
    }

    // 镜头型号 — 字符串（upload.js L82-84）
    if (tags.LensModel?.description) {
      exif.lensModel = tags.LensModel.description
    }

    // 拍摄时间 — 多标签 fallback，优先 .description（upload.js L87-99）
    const rawDate =
      (tags.DateTimeOriginal?.description && typeof tags.DateTimeOriginal.description === 'string' && tags.DateTimeOriginal.description)
      || (tags.DateTimeDigitized?.description && typeof tags.DateTimeDigitized.description === 'string' && tags.DateTimeDigitized.description)
      || (tags.DateTime?.description && typeof tags.DateTime.description === 'string' && tags.DateTime.description)
      // .value 在 computed 模式下可能返回字符串（少数情况）
      || (tags.DateTimeOriginal?.value && typeof tags.DateTimeOriginal.value === 'string' && tags.DateTimeOriginal.value)
      || (tags.DateTimeDigitized?.value && typeof tags.DateTimeDigitized.value === 'string' && tags.DateTimeDigitized.value)
      || (tags.DateTime?.value && typeof tags.DateTime.value === 'string' && tags.DateTime.value)
    if (rawDate) {
      exif.dateTimeOriginal = formatExifDate(rawDate)
    }

    // 闪光灯 — 数值（upload.js L103-105）
    if (tags.Flash?.value != null) {
      exif.flash = tags.Flash.description || String(tags.Flash.value)
    }

    // 如果没有提取到任何字段，返回 null（upload.js L108）
    if (Object.keys(exif).length === 0) return null

    return exif
  }
  catch (err) {
    console.warn('EXIF 提取失败:', (err as Error).message)
    return null
  }
}

// ── Composable 主体 ──

/**
 * EXIF 提取状态管理。
 *
 * - shallowRef 状态（ExifData 为扁平对象，无需深度响应式）
 * - 无 onScopeDispose（无 objectURL / 事件监听等需清理的副作用）
 */
export function useExif() {
  const exif = shallowRef<ExifData | null>(null)
  const extracting = shallowRef(false)

  /**
   * 提取单文件 EXIF（选图后调用）。
   * 返回提取结果（同 exif.value），方便调用方在流程中立即使用。
   */
  async function extract(file: File): Promise<ExifData | null> {
    extracting.value = true
    try {
      exif.value = await extractExif(file)
    }
    finally {
      extracting.value = false
    }
    return exif.value
  }

  function reset(): void {
    exif.value = null
  }

  return { exif, extracting, extract, reset }
}
