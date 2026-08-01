import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── 纯函数与 composable 导入 ──

import {
  buildExifSummaryItems,
  formatPosterDate,
  prepareReviewParagraphs,
  useShareImage,
  wrapTextLines,
} from '#imports'

// ── 工具：mock CanvasRenderingContext2D ──

/** 创建一个仅实现 measureText 的 stub ctx（每字符固定宽度） */
function createMeasureCtx(charWidth = 30): CanvasRenderingContext2D {
  return {
    measureText: vi.fn((text: string) => ({
      width: text.length * charWidth,
      actualBoundingBoxAscent: 20,
      actualBoundingBoxDescent: 5,
    })),
    fillText: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    closePath: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    letterSpacing: '',
  } as unknown as CanvasRenderingContext2D
}

// ── 纯函数测试：prepareReviewParagraphs ──

describe('prepareReviewParagraphs', () => {
  it('清理 Markdown 语法并保留段落', () => {
    const input = '## 标题\n\n**加粗**段落一\n\n段落二'
    const result = prepareReviewParagraphs(input, 'fallback')
    expect(result).toEqual(['标题', '加粗段落一', '段落二'])
  })

  it('空值时返回 fallback', () => {
    expect(prepareReviewParagraphs('', '默认文案')).toEqual(['默认文案'])
    expect(prepareReviewParagraphs(null, '默认文案')).toEqual(['默认文案'])
    expect(prepareReviewParagraphs(undefined, '默认文案')).toEqual(['默认文案'])
  })

  it('移除代码块', () => {
    const input = '正文\n```\ncode\n```\n后续'
    const result = prepareReviewParagraphs(input, 'fb')
    expect(result).toEqual(['正文', '后续'])
  })

  it('移除链接保留文字', () => {
    const input = '[点击这里](http://example.com)的内容'
    const result = prepareReviewParagraphs(input, 'fb')
    expect(result).toEqual(['点击这里的内容'])
  })

  it('移除列表标记', () => {
    const input = '- 项目一\n- 项目二'
    const result = prepareReviewParagraphs(input, 'fb')
    expect(result).toEqual(['项目一', '项目二'])
  })
})

// ── 纯函数测试：buildExifSummaryItems ──

describe('buildExifSummaryItems', () => {
  it('null 返回空数组', () => {
    expect(buildExifSummaryItems(null)).toEqual([])
    expect(buildExifSummaryItems(undefined)).toEqual([])
  })

  it('正确映射字段', () => {
    const items = buildExifSummaryItems({
      shutterSpeed: '1/250',
      fNumber: 2.8,
      iso: 400,
      focalLength: 35,
    })
    expect(items).toEqual([
      { label: '快门', value: '1/250' },
      { label: '光圈', value: 'f/2.8' },
      { label: 'ISO', value: 'ISO 400' },
      { label: '焦距', value: '35mm' },
    ])
  })

  it('最多返回 4 项', () => {
    const items = buildExifSummaryItems({
      shutterSpeed: '1/250',
      fNumber: 2.8,
      iso: 400,
      focalLength: 35,
      cameraModel: 'ILCE-7M4',
    })
    expect(items.length).toBeLessThanOrEqual(4)
  })

  it('缺失字段不出现', () => {
    const items = buildExifSummaryItems({ iso: 800 })
    expect(items).toEqual([{ label: 'ISO', value: 'ISO 800' }])
  })
})

// ── 纯函数测试：formatPosterDate ──

describe('formatPosterDate', () => {
  it('有效 ISO 格式化为 YYYY.MM.DD', () => {
    expect(formatPosterDate('2026-03-15T10:30:00Z')).toBe('2026.03.15')
  })

  it('无效日期返回空串', () => {
    expect(formatPosterDate('not-a-date')).toBe('')
  })

  it('无参数时使用当前日期（非空）', () => {
    const result = formatPosterDate()
    expect(result).toMatch(/^\d{4}\.\d{2}\.\d{2}$/)
  })
})

// ── 纯函数测试：wrapTextLines ──

describe('wrapTextLines', () => {
  it('短文本不拆行', () => {
    const ctx = createMeasureCtx(10) // 每字符 10px，maxWidth 200 → 20 字符
    const lines = wrapTextLines(ctx, '短文本', 200)
    expect(lines).toEqual(['短文本'])
  })

  it('超长文本按宽度拆行', () => {
    const ctx = createMeasureCtx(10) // 每字符 10px
    const text = '一二三四五六七八九十' // 10 字符 = 100px
    const lines = wrapTextLines(ctx, text, 50) // 50px → 每行 5 字符
    expect(lines.length).toBe(2)
    expect(lines[0]).toBe('一二三四五')
    expect(lines[1]).toBe('六七八九十')
  })

  it('行首禁则标点悬挂', () => {
    const ctx = createMeasureCtx(10)
    // 5 字符宽度 → "一二三四五" 后 "。" 应悬挂在行末
    const text = '一二三四五。六'
    const lines = wrapTextLines(ctx, text, 50)
    // "。" 是行首禁则，应悬挂到第一行末
    expect(lines[0]).toBe('一二三四五。')
    expect(lines[1]).toBe('六')
  })

  it('空文本返回空数组', () => {
    const ctx = createMeasureCtx(10)
    expect(wrapTextLines(ctx, '', 100)).toEqual([])
    expect(wrapTextLines(ctx, null, 100)).toEqual([])
  })
})

// ── Composable 测试 ──

describe('useShareImage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('初始状态正确', () => {
    const { phase, error, previewUrl, filename } = useShareImage()
    expect(phase.value).toBe('idle')
    expect(error.value).toBeNull()
    expect(previewUrl.value).toBeNull()
    expect(filename.value).toBe('')
  })

  it('SSR 守卫：服务端返回 null', async () => {
    // 模拟 import.meta.server
    const originalServer = import.meta.server
    Object.defineProperty(import.meta, 'server', { value: true, configurable: true })

    const { generate, phase } = useShareImage()
    const result = await generate({ totalScore: 7.5 })

    expect(result).toBeNull()
    expect(phase.value).toBe('idle')

    Object.defineProperty(import.meta, 'server', { value: originalServer, configurable: true })
  })

  it('reset 清除状态', () => {
    const { error, filename, reset } = useShareImage()
    error.value = 'some error'
    filename.value = 'test.png'

    reset()

    expect(error.value).toBeNull()
    expect(filename.value).toBe('')
  })

  it('revokePreview 释放 objectURL', () => {
    const mockRevoke = vi.fn()
    vi.stubGlobal('URL', {
      ...URL,
      revokeObjectURL: mockRevoke,
      createObjectURL: vi.fn(() => 'blob:mock'),
    })

    const { previewUrl, revokePreview } = useShareImage()
    previewUrl.value = 'blob:mock-url'

    revokePreview()

    expect(mockRevoke).toHaveBeenCalledWith('blob:mock-url')
    expect(previewUrl.value).toBeNull()

    vi.unstubAllGlobals()
  })
})
