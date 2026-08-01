/**
 * 前后端共享的纯工具函数。
 *
 * 位于 shared/utils/ 下，Nuxt 4 会同时向 app 与 server 自动导入。
 */
import type { GenreMetadata, ScoreBand } from '#shared/types/evaluation'

/** 拆分文件名主体与扩展名，截断展示时保留扩展名（DESIGN.md §13.2）；点开头/点结尾/含点扩展名超 8 字符视为无扩展名 */
export function splitFileName(name: string): { stem: string; ext: string } {
  const value = String(name ?? '')
  const dot = value.lastIndexOf('.')
  if (dot <= 0 || dot === value.length - 1 || value.length - dot > 8) return { stem: value, ext: '' }
  return { stem: value.slice(0, dot), ext: value.slice(dot) }
}

/** 将 ISO 时间格式化为短日期时间（默认中文环境，调用方可传入当前 BCP-47 locale） */
export function formatDateTime(isoString: string, locale = 'zh-CN'): string {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 文件体积格式化（逐行移植 venus utils.js L24-28）：B / KB / MB 三档，KB 与 MB 保留一位小数 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * 耗时格式化（逐行移植 venus utils.js L30-33）：<1000 显示毫秒，否则秒保留一位小数。
 * 调用方可传入当前 BCP-47 locale（formatDateTime 先例），默认中文单位（§15.4）。
 * 与 venus 源码一致不做内部 NaN 防御——归一在 useEvaluationStream 事件解析层完成
 * （component-plan §4.4），调用方经 `?? 0` 兜底后传入（group.js L565 先例）。
 */
export function formatDuration(ms: number, locale = 'zh-CN'): string {
  const unit = locale.startsWith('zh')
    ? { millisecond: '毫秒', second: '秒' }
    : { millisecond: 'ms', second: 's' }
  if (ms < 1000) return `${ms} ${unit.millisecond}`
  return `${(ms / 1000).toFixed(1)} ${unit.second}`
}

/**
 * §5.4 评分区间单一来源（逐行移植 venus utils.js L46-51）。
 * ScorePanel（CSS class）、useShareImage（Canvas 色值按 key 映射）共同消费
 * （component-plan §4.3）。
 */
export const SCORE_BANDS: ScoreBand[] = [
  { key: 'unformed', ceiling: 5, label: '尚未成形', colorClass: 'score-red' },
  { key: 'basic', ceiling: 6.5, label: '基础成立', colorClass: 'score-orange' },
  { key: 'clear', ceiling: 8, label: '表达清晰', colorClass: 'score-blue' },
  { key: 'strong', ceiling: Infinity, label: '优势明确', colorClass: 'score-green' },
]

/** §5.4 四区间查找（venus utils.js L53-55）：score < ceiling 命中首项；NaN/Infinity 安全回退（app.js L617） */
export function getScoreBand(score: number): ScoreBand {
  const s = Number.isFinite(score) ? score : 0
  return SCORE_BANDS.find(band => s < band.ceiling) ?? SCORE_BANDS[SCORE_BANDS.length - 1]!
}

/**
 * 维度名称解析（逐行移植 venus utils.js L79-95 getDimensionName）。
 * 当前门类优先 → 全门类回退 → 原始 key 兜底。
 * 消费方：DimensionList（渲染）/ 未来 useShareImage（Canvas）。
 */
export function resolveDimensionName(
  key: string,
  genre?: string,
  metadata?: Record<string, GenreMetadata> | null,
): string {
  if (metadata) {
    // 当前门类的维度列表（venus-core 格式：dimensions 是 [{key, label}] 数组）
    if (genre && metadata[genre]?.dimensions) {
      const found = metadata[genre].dimensions.find(d => d.key === key)
      if (found) return found.label
    }
    // 回退：遍历所有门类查找
    for (const g of Object.values(metadata)) {
      if (g.dimensions) {
        const found = g.dimensions.find(d => d.key === key)
        if (found) return found.label
      }
    }
  }
  return key
}

/**
 * §15.1 门类与场景合并为单个标签，按“门类 · 场景”的层级顺序排列
 * （逐行移植 venus utils.js L66-69）。
 * 不显示“门类”“场景”前缀词（§15.1）；compare 模式无系列场景，
 * sceneName 传空串即仅输出门类（group.js L537）。
 * 消费方：Flow 映射层（结果区头标签）/ 未来 useShareImage（Canvas）。
 */
export function formatGenreSceneTag(genreName: string, sceneName?: string): string {
  return [genreName, sceneName].filter(Boolean).join(' · ')
}
