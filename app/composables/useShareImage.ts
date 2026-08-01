/**
 * 分享海报生成 —— 逐行移植 venus share-image.js（540 行）为 Nuxt composable。
 *
 * 职责（component-plan.md §2.5）：
 * - Canvas 2D 绘制数字接触印样海报（纸面页眉 + 暗房图片舞台 + 分数维度 + 点评全文 + 元数据页脚）
 * - 画布高度按内容动态计算，点评全文展示不截断
 * - 客户端专属（SSR 守卫 — §四.5）
 *
 * 消费方：
 * - ShareAction.vue（生成按钮 + 进度文案）
 * - SharePreviewModal.vue（预览 + 下载 + objectURL 生命周期）
 *
 * 设计约束：
 * - 海报固定使用 Paper 主题色值（物理分享物，不随 UI 主题变）
 * - 色值来源：tokens.css :root（修改时须同步）
 * - 字体来源：tokens.css --font-display/ui/data
 */

import type { ExifData, GenreMetadata, ScoreBandKey } from '#shared/types/evaluation'
import { formatGenreSceneTag, getScoreBand, resolveDimensionName } from '#shared/utils/format'

// ── 常量（对齐 venus share-image.js L10-42）──

/**
 * Canvas 调色板（来源：tokens.css :root Paper 主题，修改时须同步）。
 * Canvas 无法消费 CSS 变量，因此硬编码色值。
 */
const PALETTE = {
  paper: '#f4f1e8', // --paper
  paperRaised: '#fbf9f3', // --paper-raised
  paperRecessed: '#eae5da', // --paper-recessed
  ink: '#191714', // --ink
  body: '#45413b', // --ink-body
  muted: '#6f6960', // --ink-muted
  hairline: '#d8d2c6', // --hairline
  hairlineStrong: '#aaa297', // --hairline-strong
  darkroom: '#171512', // --darkroom
  amber: '#a9541e', // --amber
  oxide: '#9c3f32', // --oxide
  verdigris: '#2f6b60', // --verdigris
  lightInk: '#f1ede3', // darkroom 模式 --ink（用于暗色舞台上的文字）
  lightMuted: '#9e9689', // darkroom 模式 --ink-muted
} as const

/** 字体栈（来源：tokens.css --font-display/ui/data） */
const FONT_SERIF = `'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'Cormorant Garamond', Georgia, serif`
const FONT_SANS = `'Inter', 'Noto Sans SC', 'PingFang SC', -apple-system, system-ui, sans-serif`
const FONT_MONO = `'IBM Plex Mono', 'JetBrains Mono', 'SFMono-Regular', ui-monospace, monospace`

/** 画布尺寸（逻辑像素） */
const W = 1080
const DPR = 2
const PAD = 72
const CONTENT_W = W - PAD * 2

/** §5.4 区间色值：Canvas 无法套用页面的 CSS class，按 band key 映射到 token 色值 */
const BAND_CANVAS_COLOR: Record<ScoreBandKey, string> = {
  unformed: PALETTE.muted,
  basic: PALETTE.body,
  clear: PALETTE.amber,
  strong: PALETTE.verdigris,
}

/** 图片加载超时保护（ms） */
const LOAD_IMAGE_TIMEOUT = 15_000

// ── 类型 ──

export type ShareImagePhase = 'idle' | 'loading-image' | 'generating' | 'exporting'

export interface ShareImageOptions {
  photoSrc?: string | null
  totalScore: number
  genre?: string
  genreLabel?: string
  sceneLabel?: string
  dimensions?: Record<string, number>
  metadata?: Record<string, GenreMetadata> | null
  exif?: ExifData | null
  evaluatedAt?: string
  critique?: string
  suggestions?: string
  arbitrationNotes?: string
  onProgress?: (message: string) => void
}

export interface ShareImageResult {
  blob: Blob
  filename: string
}

// ── 纯函数区：绘图原语（模块私有）──

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    const timer = setTimeout(() => {
      img.src = ''
      reject(new Error('图片加载超时'))
    }, LOAD_IMAGE_TIMEOUT)

    img.onload = () => {
      clearTimeout(timer)
      resolve(img)
    }
    img.onerror = () => {
      clearTimeout(timer)
      reject(new Error('图片加载失败'))
    }
    img.src = src
  })
}

function drawNorthStarMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  const scale = size / 32
  const points: [number, number][] = [
    [16, 0],
    [18.5, 13.5],
    [32, 16],
    [18.5, 18.5],
    [16, 32],
    [13.5, 18.5],
    [0, 16],
    [13.5, 13.5],
  ]

  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.beginPath()
  ctx.moveTo(points[0]![0], points[0]![1])
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i]![0], points[i]![1])
  }
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.restore()
}

/** 取景框式裁切角（DESIGN.md §8.4），环绕图片四角 */
function drawFrameCorners(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, arm: number, gap: number, color: string): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  const corners: [number, number, number, number][] = [
    [x - gap, y - gap, 1, 1],
    [x + w + gap, y - gap, -1, 1],
    [x - gap, y + h + gap, 1, -1],
    [x + w + gap, y + h + gap, -1, -1],
  ]
  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath()
    ctx.moveTo(cx + arm * dx, cy)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx, cy + arm * dy)
    ctx.stroke()
  }
  ctx.restore()
}

/** 英文章节眉标：小号 Mono + 字距 */
function drawEyebrow(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, align: CanvasTextAlign = 'left'): void {
  ctx.save()
  ctx.font = `600 18px ${FONT_MONO}`
  try { ctx.letterSpacing = '2px' } catch { /* 旧浏览器忽略字距 */ }
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'top'
  ctx.fillText(text, x, y)
  ctx.restore()
}

function drawHairline(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, color: string = PALETTE.hairline): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x1, y + 0.5)
  ctx.lineTo(x2, y + 0.5)
  ctx.stroke()
  ctx.restore()
}

function ellipsizeText(ctx: CanvasRenderingContext2D, text: string | null | undefined, maxWidth: number): string {
  if (text == null) return ''
  const s = String(text)
  if (ctx.measureText(s).width <= maxWidth) return s
  const ellipsis = '…'
  if (ctx.measureText(ellipsis).width > maxWidth) return ''

  let lo = 0
  let hi = s.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    const candidate = s.slice(0, mid) + ellipsis
    if (ctx.measureText(candidate).width <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return s.slice(0, lo) + ellipsis
}

// ── 纯函数区：字体等待（模块级缓存）──

let fontsReadyPromise: Promise<void> | null = null

function waitForFonts(timeoutMs = 1200): Promise<void> {
  if (!fontsReadyPromise) {
    fontsReadyPromise = (async () => {
      const fontsReady = document.fonts?.ready
      if (!fontsReady) return
      await Promise.race([fontsReady, new Promise<void>(r => setTimeout(r, timeoutMs))])
    })()
  }
  return fontsReadyPromise
}

// ── 纯函数区：中文排版（模块私有）──

/** 清理 Markdown 语法但保留段落结构，供点评全文排版 */
export function prepareReviewParagraphs(text: string | undefined | null, fallback: string): string[] {
  const cleaned = String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]*>[ \t]?/gm, '')
    .replace(/^[ \t]*[-*+][ \t]+/gm, '')
    .replace(/^[ \t]*\d+[.、][ \t]+/gm, '')
    .replace(/[*_~]+/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
  if (!cleaned) return [fallback]
  return cleaned.split(/\n+/).map(p => p.trim()).filter(Boolean)
}

/** §6.3 行首禁则：这些标点不得出现在行首 */
const NO_LINE_START = new Set('。，、；：？！）】」』》〉］｝〕”’…‰%·,.;:?!)]}')
/** §6.3 行尾禁则：左引号与左括号不得孤立在行尾 */
const NO_LINE_END = new Set('（【「『《〈［｛〔“‘([{')
/** 每行最多悬挂一个标点，避免右缘参差过大 */
const HANG_LIMIT = 1

/** 按中文禁则拆行：标点优先悬挂在上一行末，悬挂额度用尽时改为连前一字一同下移 */
export function wrapTextLines(ctx: CanvasRenderingContext2D, text: string | null | undefined, maxWidth: number): string[] {
  const lines: string[] = []
  let cur: string[] = [] // 逐字符数组，避免 slice 截断代理对
  let hung = 0

  // 推出当前行，并将行末的左引号 / 左括号剥离交给次行（行尾禁则）。
  // 所有换行路径必须经过这里，否则会漏检
  const flush = (): string[] => {
    const carried: string[] = []
    while (cur.length > 1 && NO_LINE_END.has(cur[cur.length - 1]!)) {
      carried.unshift(cur.pop()!)
    }
    lines.push(cur.join(''))
    cur = []
    hung = 0
    return carried
  }

  for (const char of String(text || '')) {
    if (cur.length && ctx.measureText(cur.join('') + char).width > maxWidth) {
      if (NO_LINE_START.has(char)) {
        if (hung < HANG_LIMIT) {
          cur.push(char)
          hung += 1
          continue
        }
        // 悬挂额度用尽：连行末字符一同下移，并持续回退直到次行行首不是禁则标点
        const carry = [char]
        do {
          carry.unshift(cur.pop()!)
        } while (cur.length > 1 && NO_LINE_START.has(carry[0]!))
        if (cur.length) {
          cur = [...flush(), ...carry]
          continue
        }
        // 整行均为禁则标点，无可避让，只能留在本行
        cur = carry
        continue
      }
      cur = [...flush(), char]
      continue
    }
    cur.push(char)
  }

  if (cur.length) lines.push(cur.join(''))
  return lines
}

function drawWrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  for (const line of wrapTextLines(ctx, text, maxWidth)) {
    ctx.fillText(line, x, y)
    y += lineHeight
  }
  return y
}

/** 与绘制共用同一拆行函数，保证预测高度与实际行数一致 */
function measureWrappedTextHeight(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, lineHeight: number): number {
  return wrapTextLines(ctx, text, maxWidth).length * lineHeight
}

// ── 纯函数区：数据准备（模块私有）──

function getShareDimensions(
  dimensions: Record<string, number> | undefined,
  genre: string | undefined,
  metadata: Record<string, GenreMetadata> | null | undefined,
): Array<{ key: string, value: number, label: string }> {
  return Object.entries(dimensions || {}).map(([key, value]) => ({
    key,
    value,
    label: resolveDimensionName(key, genre, metadata),
  }))
}

export function buildExifSummaryItems(exif: ExifData | null | undefined): Array<{ label: string, value: string }> {
  if (!exif) return []
  const items: Array<{ label: string, value: string }> = []
  if (exif.shutterSpeed) items.push({ label: '快门', value: String(exif.shutterSpeed) })
  if (exif.fNumber != null) items.push({ label: '光圈', value: typeof exif.fNumber === 'number' ? `f/${exif.fNumber.toFixed(1)}` : String(exif.fNumber) })
  if (exif.iso != null) items.push({ label: 'ISO', value: `ISO ${exif.iso}` })
  if (exif.focalLength != null) items.push({ label: '焦距', value: typeof exif.focalLength === 'number' ? `${exif.focalLength}mm` : String(exif.focalLength) })
  return items.slice(0, 4)
}

export function formatPosterDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date()
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// ── 核心引擎 ──

/** 模块级测量画布单例（避免每次生成 createElement） */
let measureCtx: CanvasRenderingContext2D | null = null

function getMeasureCtx(): CanvasRenderingContext2D {
  if (!measureCtx) {
    const c = document.createElement('canvas')
    measureCtx = c.getContext('2d')!
    measureCtx.textBaseline = 'top'
    measureCtx.textAlign = 'left'
  }
  return measureCtx
}

/**
 * 生成分享海报（逐行移植 venus share-image.js L261-539）。
 *
 * 数字接触印样海报：纸面页眉 + 暗房图片舞台（裁切角与边注）+ 分数与维度评审表
 * + 完整专业点评 + 元数据页脚。画布高度按内容动态计算，不截断。
 */
export async function generateShareImage(options: ShareImageOptions): Promise<ShareImageResult> {
  const {
    photoSrc,
    totalScore,
    genre,
    genreLabel,
    sceneLabel,
    dimensions,
    metadata,
    exif,
    evaluatedAt,
    critique,
    suggestions,
    arbitrationNotes,
    onProgress,
  } = options

  onProgress?.('正在读取照片...')
  let photoImg: HTMLImageElement | null = null
  if (photoSrc) {
    try {
      photoImg = await loadImage(photoSrc)
    }
    catch (e) {
      console.warn('照片加载失败，分享图将不包含照片:', e)
    }
  }

  await waitForFonts()

  onProgress?.('正在生成分享图...')
  const score = Number(totalScore) || 0
  const band = getScoreBand(score)
  const genreText = genreLabel || genre || ''
  // 图片边注：与页面标签共用同一格式化函数
  const marginaliaText = formatGenreSceneTag(genreText, sceneLabel)
  const reviewFallback = '这张作品暂未生成点评，请结合维度评分查看构图、光影、主体、技术完成度与视觉影响力方面的表现。'
  const reviewParas = prepareReviewParagraphs(critique || arbitrationNotes || suggestions, reviewFallback)
  const dims = getShareDimensions(dimensions, genre, metadata)
  const exifItems = buildExifSummaryItems(exif)
  const dateText = formatPosterDate(evaluatedAt)

  const mCtx = getMeasureCtx()

  // ── 布局计算 ──
  const HEADER_H = 128

  // 暗房图片舞台：自然宽高比，超高时 contain 收窄
  let photoW = 0
  let photoH = 0
  let stageH = 0
  if (photoImg) {
    const maxPhotoW = CONTENT_W // 图片与正文栏共用同一条左边界
    const maxPhotoH = 1200
    const ratio = photoImg.naturalHeight / photoImg.naturalWidth
    photoW = maxPhotoW
    photoH = Math.round(maxPhotoW * ratio)
    if (photoH > maxPhotoH) {
      photoH = maxPhotoH
      photoW = Math.round(maxPhotoH / ratio)
    }
    // 上留白 + 图片 + 边注行 + 下留白
    stageH = 56 + photoH + (marginaliaText ? 34 + 20 : 0) + 48
  }

  // RESULT 区：左列分数块 / 右列维度评审表
  const leftColW = 300
  const colGap = 64
  const rightColX = PAD + leftColW + colGap
  const rightColW = W - PAD - rightColX

  const scoreText = score.toFixed(1)
  mCtx.font = `600 150px ${FONT_MONO}`
  const scoreMetrics = mCtx.measureText(scoreText)
  const scoreGlyphH = Math.ceil(scoreMetrics.actualBoundingBoxAscent + scoreMetrics.actualBoundingBoxDescent)
  // 分数 + 间距 + 标签行 + 间距 + 刻度条
  const leftScoreH = scoreGlyphH + 24 + 22 + 24 + 6

  const DIM_ROW_H = 78
  const dimsH = dims.length > 0 ? (dims.length - 1) * DIM_ROW_H + 46 : 0

  const resultTop = HEADER_H + stageH + 64
  const resultBodyTop = resultTop + 56 // 眉标 + 间距
  const resultBottom = resultBodyTop + Math.max(leftScoreH, dimsH)

  // CRITIQUE 区：全文排版，动态高度
  const critRuleY = resultBottom + 56
  const critTop = critRuleY + 56
  const critTextTop = critTop + 20 + 16 + 34 + 28 // 眉标 + 间距 + 标题 + 间距
  const CRIT_LINE_H = 52
  const CRIT_PARA_GAP = 12
  mCtx.font = `400 30px ${FONT_SERIF}`
  let critiqueH = 0
  for (const para of reviewParas) {
    critiqueH += measureWrappedTextHeight(mCtx, para, CONTENT_W, CRIT_LINE_H) + CRIT_PARA_GAP
  }
  critiqueH -= CRIT_PARA_GAP
  const critBottom = critTextTop + critiqueH

  // 页脚：EXIF 元数据 + 日期与字标
  const footerRuleY = critBottom + 48
  let footerCursor = footerRuleY + 44
  const exifBlockH = 62
  if (exifItems.length > 0) footerCursor += exifBlockH + 44
  const metaRowY = footerCursor
  const canvasHeight = Math.ceil(metaRowY + 22 + 56)

  // ── 绘制 ──
  const canvas = document.createElement('canvas')
  canvas.width = W * DPR
  canvas.height = canvasHeight * DPR
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  ctx.fillStyle = PALETTE.paper
  ctx.fillRect(0, 0, W, canvasHeight)

  // 页眉：星芒 + 字标 + 中文名，右侧语义眉标
  const markSize = 26
  const headerMidY = HEADER_H / 2
  drawNorthStarMark(ctx, PAD, headerMidY - markSize / 2, markSize, PALETTE.ink)

  ctx.textBaseline = 'middle'
  ctx.fillStyle = PALETTE.ink
  ctx.font = `600 27px ${FONT_MONO}`
  const wordmarkX = PAD + markSize + 16
  ctx.fillText('VENUS', wordmarkX, headerMidY + 1)
  const wordmarkW = ctx.measureText('VENUS').width

  ctx.strokeStyle = PALETTE.hairline
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(wordmarkX + wordmarkW + 20, headerMidY - 12)
  ctx.lineTo(wordmarkX + wordmarkW + 20, headerMidY + 12)
  ctx.stroke()

  ctx.fillStyle = PALETTE.muted
  ctx.font = `20px ${FONT_SANS}`
  ctx.fillText('摄影美学评估', wordmarkX + wordmarkW + 40, headerMidY + 1)

  ctx.textBaseline = 'top'
  drawEyebrow(ctx, 'PHOTOGRAPHY REVIEW', W - PAD, headerMidY - 9, PALETTE.muted, 'right')
  ctx.textAlign = 'left'

  drawHairline(ctx, 0, W, HEADER_H - 1)

  // 暗房图片舞台
  if (photoImg) {
    ctx.fillStyle = PALETTE.darkroom
    ctx.fillRect(0, HEADER_H, W, stageH)

    const photoX = Math.round((W - photoW) / 2)
    const photoY = HEADER_H + 56
    ctx.drawImage(photoImg, photoX, photoY, photoW, photoH)
    drawFrameCorners(ctx, photoX, photoY, photoW, photoH, 24, 10, PALETTE.amber)

    // 边注：门类与场景。舞台已使用裁切角，此处不再叠加帧号等第二种摄影语义元素（§4.2）
    // 图注归属报告正文栏，固定对齐 PAD；竖图被高度上限收窄时也不跟随图片居中，避免出现第二条左边界
    if (marginaliaText) {
      ctx.font = `20px ${FONT_SANS}`
      ctx.fillStyle = PALETTE.lightMuted
      ctx.fillText(marginaliaText, PAD, photoY + photoH + 34)
    }
  }

  // RESULT：分数块与维度评审表
  drawEyebrow(ctx, 'RESULT', PAD, resultTop, PALETTE.muted)

  ctx.fillStyle = PALETTE.ink
  ctx.font = `600 150px ${FONT_MONO}`
  ctx.fillText(scoreText, PAD, resultBodyTop)
  const scoreW = ctx.measureText(scoreText).width

  ctx.font = `500 30px ${FONT_MONO}`
  ctx.fillStyle = PALETTE.muted
  const outOfMetrics = ctx.measureText('/10')
  const outOfH = Math.ceil(outOfMetrics.actualBoundingBoxAscent + outOfMetrics.actualBoundingBoxDescent)
  ctx.fillText('/10', PAD + scoreW + 14, resultBodyTop + scoreGlyphH - outOfH - 6)

  const scoreLabelY = resultBodyTop + scoreGlyphH + 24
  ctx.font = `22px ${FONT_SANS}`
  ctx.fillStyle = PALETTE.body
  ctx.fillText('综合评分 ·', PAD, scoreLabelY)
  const scorePrefixW = ctx.measureText('综合评分 ·').width
  ctx.fillStyle = BAND_CANVAS_COLOR[band.key]
  ctx.fillText(band.label, PAD + scorePrefixW + 10, scoreLabelY)

  // 0–10 位置刻度，与维度条同一图形语言
  const trackY = scoreLabelY + 22 + 24
  ctx.fillStyle = PALETTE.hairline
  ctx.fillRect(PAD, trackY, leftColW, 6)
  ctx.fillStyle = PALETTE.amber
  ctx.fillRect(PAD, trackY, Math.max(0, Math.min(1, score / 10)) * leftColW, 6)

  if (dims.length > 0) {
    let dimY = resultBodyTop
    for (const dim of dims) {
      ctx.font = `24px ${FONT_SANS}`
      ctx.fillStyle = PALETTE.body
      ctx.textAlign = 'left'
      ctx.fillText(ellipsizeText(ctx, dim.label, rightColW - 110), rightColX, dimY)

      ctx.font = `500 26px ${FONT_MONO}`
      ctx.fillStyle = PALETTE.ink
      ctx.textAlign = 'right'
      ctx.fillText(Number(dim.value).toFixed(1), W - PAD, dimY)
      ctx.textAlign = 'left'

      const barY = dimY + 40
      ctx.fillStyle = PALETTE.hairline
      ctx.fillRect(rightColX, barY, rightColW, 6)
      ctx.fillStyle = PALETTE.amber
      ctx.fillRect(rightColX, barY, Math.max(0, Math.min(1, Number(dim.value) / 10)) * rightColW, 6)

      dimY += DIM_ROW_H
    }
  }

  // CRITIQUE：专业点评全文
  drawHairline(ctx, PAD, W - PAD, critRuleY)
  drawEyebrow(ctx, 'CRITIQUE', PAD, critTop, PALETTE.muted)

  ctx.fillStyle = PALETTE.ink
  ctx.font = `600 30px ${FONT_SANS}`
  ctx.fillText('专业点评', PAD, critTop + 20 + 16)

  ctx.fillStyle = PALETTE.body
  ctx.font = `400 30px ${FONT_SERIF}`
  let critY = critTextTop
  for (const para of reviewParas) {
    critY = drawWrappedText(ctx, para, PAD, critY, CONTENT_W, CRIT_LINE_H)
    critY += CRIT_PARA_GAP
  }

  // 页脚元数据
  drawHairline(ctx, PAD, W - PAD, footerRuleY)

  if (exifItems.length > 0) {
    const exifTop = footerRuleY + 44
    const exifGap = 24
    const exifColW = (CONTENT_W - exifGap * 3) / 4
    for (let i = 0; i < exifItems.length; i++) {
      const x = PAD + i * (exifColW + exifGap)
      ctx.fillStyle = PALETTE.muted
      ctx.font = `18px ${FONT_SANS}`
      ctx.fillText(exifItems[i]!.label, x, exifTop)
      ctx.fillStyle = PALETTE.ink
      ctx.font = `500 27px ${FONT_MONO}`
      ctx.fillText(ellipsizeText(ctx, exifItems[i]!.value, exifColW - 12), x, exifTop + 32)
    }
  }

  if (dateText) {
    ctx.fillStyle = PALETTE.muted
    ctx.font = `500 18px ${FONT_MONO}`
    ctx.fillText(`EVALUATED ${dateText}`, PAD, metaRowY)
  }

  ctx.font = `600 18px ${FONT_MONO}`
  const footerMarkSize = 16
  const footerWordW = ctx.measureText('VENUS').width
  const footerWordX = W - PAD - footerWordW
  ctx.fillStyle = PALETTE.ink
  ctx.fillText('VENUS', footerWordX, metaRowY)
  drawNorthStarMark(ctx, footerWordX - footerMarkSize - 10, metaRowY + 1, footerMarkSize, PALETTE.ink)

  onProgress?.('正在准备预览...')
  const now = new Date()
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  const filename = `venus_${ts}.png`
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('生成图片失败')

  return { blob, filename }
}

// ── Composable 主体 ──

/**
 * 分享海报生成管理（DESIGN.md §9.5：不暴露实现名词）。
 *
 * - phase 状态机：idle → loading-image → generating → exporting → idle
 * - objectURL 生命周期由 composable 管理，scope 销毁时自动 revoke
 * - SSR 守卫：服务端调用 generate 直接返回 null
 */
export function useShareImage() {
  const phase = shallowRef<ShareImagePhase>('idle')
  const error = shallowRef<string | null>(null)
  const previewUrl = shallowRef<string | null>(null)
  const filename = shallowRef('')

  function revokePreview(): void {
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value)
      previewUrl.value = null
    }
  }

  async function generate(options: ShareImageOptions): Promise<ShareImageResult | null> {
    // SSR 守卫（对齐 useExif L47 模式）
    if (import.meta.server) return null

    revokePreview() // 清理上一次
    phase.value = 'loading-image'
    error.value = null

    try {
      const result = await generateShareImage({
        ...options,
        onProgress: (msg) => {
          // 根据文案推断 phase（对齐原始三个调用点）
          if (msg.includes('读取照片')) phase.value = 'loading-image'
          else if (msg.includes('生成')) phase.value = 'generating'
          else phase.value = 'exporting'
          options.onProgress?.(msg)
        },
      })
      previewUrl.value = URL.createObjectURL(result.blob)
      filename.value = result.filename
      return result
    }
    catch (err) {
      error.value = (err as Error).message || '生成分享图失败'
      return null
    }
    finally {
      phase.value = 'idle'
    }
  }

  function download(): void {
    if (!previewUrl.value) return
    const a = document.createElement('a')
    a.href = previewUrl.value
    a.download = filename.value || 'venus_share.png'
    a.click()
  }

  function reset(): void {
    revokePreview()
    error.value = null
    filename.value = ''
  }

  // 对齐 useOssUpload / useImageSelection 的 onScopeDispose 清理模式
  onScopeDispose(() => {
    revokePreview()
  })

  return { phase, error, previewUrl, filename, generate, download, reset, revokePreview }
}
