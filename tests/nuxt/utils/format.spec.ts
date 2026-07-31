import { describe, expect, it } from 'vitest'
import { SCORE_BANDS, formatFileSize, getScoreBand, splitFileName } from '#shared/utils/format'

describe('splitFileName', () => {
  it('常规文件名拆分为主体与含点扩展名', () => {
    expect(splitFileName('photo.jpg')).toEqual({ stem: 'photo', ext: '.jpg' })
  })

  it('多点文件名只在最后一个点拆分', () => {
    expect(splitFileName('a.b.c.jpg')).toEqual({ stem: 'a.b.c', ext: '.jpg' })
  })

  it('无点文件名不拆分', () => {
    expect(splitFileName('photo')).toEqual({ stem: 'photo', ext: '' })
  })

  // dot === 0 视为无扩展名（点开头的隐藏文件）
  it('点开头文件名不拆分', () => {
    expect(splitFileName('.gitignore')).toEqual({ stem: '.gitignore', ext: '' })
  })

  it('点结尾文件名不拆分', () => {
    expect(splitFileName('photo.')).toEqual({ stem: 'photo.', ext: '' })
  })

  // 含点扩展名最长 8 字符：恰好 8 保留，9 起不拆
  it('扩展名长度边界', () => {
    expect(splitFileName('a.abcdefg')).toEqual({ stem: 'a', ext: '.abcdefg' })
    expect(splitFileName('a.abcdefgh')).toEqual({ stem: 'a.abcdefgh', ext: '' })
  })

  it('空字符串返回空主体与空扩展名', () => {
    expect(splitFileName('')).toEqual({ stem: '', ext: '' })
  })
})

describe('formatFileSize', () => {
  it('小于 1024 字节显示为 B', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(1023)).toBe('1023 B')
  })

  it('KB 范围保留一位小数', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
  })

  it('MB 范围保留一位小数', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
    expect(formatFileSize(5.5 * 1024 * 1024)).toBe('5.5 MB')
  })
})

// 回归锚点：venus utils.js L46-51 SCORE_BANDS 阈值
describe('getScoreBand', () => {
  it('0–4.9 → unformed / 尚未成形 / score-red', () => {
    expect(getScoreBand(0).key).toBe('unformed')
    expect(getScoreBand(4.9).key).toBe('unformed')
    expect(getScoreBand(4.9)).toMatchObject({ label: '尚未成形', colorClass: 'score-red' })
  })

  it('5.0–6.4 → basic / 基础成立 / score-orange', () => {
    expect(getScoreBand(5.0).key).toBe('basic')
    expect(getScoreBand(6.4).key).toBe('basic')
    expect(getScoreBand(6.4)).toMatchObject({ label: '基础成立', colorClass: 'score-orange' })
  })

  it('6.5–7.9 → clear / 表达清晰 / score-blue', () => {
    expect(getScoreBand(6.5).key).toBe('clear')
    expect(getScoreBand(7.9).key).toBe('clear')
    expect(getScoreBand(7.9)).toMatchObject({ label: '表达清晰', colorClass: 'score-blue' })
  })

  it('8.0–10.0 → strong / 优势明确 / score-green', () => {
    expect(getScoreBand(8.0).key).toBe('strong')
    expect(getScoreBand(10).key).toBe('strong')
    expect(getScoreBand(10)).toMatchObject({ label: '优势明确', colorClass: 'score-green' })
  })

  // ceiling 为开区间（score < ceiling）：恰值归入下一区间
  it('ceiling 精确值归入下一区间', () => {
    expect(getScoreBand(5).key).toBe('basic')
    expect(getScoreBand(6.5).key).toBe('clear')
    expect(getScoreBand(8).key).toBe('strong')
  })

  // 回归锚点：app.js L617 Number.isFinite 防御
  it('越界与异常输入防御', () => {
    expect(getScoreBand(Number.NaN).key).toBe('unformed')
    expect(getScoreBand(Number.POSITIVE_INFINITY).key).toBe('unformed')
    expect(getScoreBand(-1).key).toBe('unformed')
    expect(getScoreBand(11).key).toBe('strong')
  })

  it('SCORE_BANDS 导出四项且阈值递增', () => {
    expect(SCORE_BANDS).toHaveLength(4)
    expect(SCORE_BANDS.map(b => b.key)).toEqual(['unformed', 'basic', 'clear', 'strong'])
    expect(SCORE_BANDS[3]!.ceiling).toBe(Infinity)
  })
})
