import type { H3Event } from 'h3'
import type { AnalyticsFilters } from '#shared/types/analytics'
export function analyticsFilters(event: H3Event): AnalyticsFilters {
  const q = getQuery(event); const mode = q.mode
  return { from: date(q.from), to: date(q.to), mode: mode === 'single' || mode === 'joint' || mode === 'compare' ? mode : undefined, genre: text(q.genre), countryCode: text(q.countryCode) }
}
export function analyticsPage(event: H3Event): { page: number, pageSize: number } {
  const q = getQuery(event); return { page: clamp(q.page, 1, 100000, 1), pageSize: clamp(q.pageSize, 1, 100, 20) }
}
function date(value: unknown): string | undefined { return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : undefined }
function text(value: unknown): string | undefined { return typeof value === 'string' && value.length <= 100 ? value : undefined }
function clamp(value: unknown, min: number, max: number, fallback: number): number { const n = Number(value); return Number.isInteger(n) && n >= min && n <= max ? n : fallback }
