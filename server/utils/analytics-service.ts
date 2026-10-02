import type { H3Event } from 'h3'
import type { AnalyticsBreakdown, AnalyticsFilters, AnalyticsOverview, AnalyticsTimelinePoint, AnalyticsEvaluationMode, AnalyticsRecordsPage } from '#shared/types/analytics'
import { buildAnalyticsFilter, cleanAnalyticsRetention, completeAnalyticsEvaluation, failAnalyticsEvaluation, getAnalyticsDb, insertAnalyticsStart, queryAnalyticsRecords } from './analytics-db'
import { getAnalyticsIdentity, resolveAnalyticsLocation } from './analytics-privacy'

interface AnalyticsConfig {
  analyticsDbPath: string
  analyticsIpHashSalt: string
  analyticsGeoipDbPath: string
  analyticsRetentionDays: number
}

function getConfig(event: H3Event): AnalyticsConfig {
  return useRuntimeConfig(event) as unknown as AnalyticsConfig
}

export async function startAnalyticsEvaluation(event: H3Event, mode: AnalyticsEvaluationMode): Promise<number | null> {
  const config = getConfig(event)
  const db = getAnalyticsDb(config.analyticsDbPath)
  if (!db) return null
  const { ip, ipHash } = getAnalyticsIdentity(event, config.analyticsIpHashSalt)
  const location = await resolveAnalyticsLocation(ip, config.analyticsGeoipDbPath)
  return insertAnalyticsStart(db, { mode, ipHash, ...location, startedAt: new Date().toISOString() })
}

export function completeAnalyticsEvaluationFromEvent(event: H3Event, id: number, payload: Record<string, unknown>, fallbackMode: AnalyticsEvaluationMode): void {
  const db = getAnalyticsDb(getConfig(event).analyticsDbPath)
  if (!db) return
  const metadata = asRecord(payload.metadata)
  const score = finiteNumber(payload.totalScore ?? payload.total_score)
  const duration = finiteNumber(metadata?.durationMs ?? metadata?.duration_ms)
  const mode = asMode(payload.mode) || fallbackMode
  const imageCount = finiteNumber(metadata?.imageCount ?? metadata?.image_count)
  completeAnalyticsEvaluation(db, id, {
    mode,
    genre: stringValue(payload.genre),
    totalScore: score,
    imageCount: imageCount == null ? null : Math.trunc(imageCount),
    completedAt: stringValue(metadata?.evaluatedAt ?? metadata?.evaluated_at) || new Date().toISOString(),
    durationMs: duration == null ? null : Math.trunc(duration),
  })
}

export function failAnalyticsEvaluationFromEvent(event: H3Event, id: number, code: string): void {
  const db = getAnalyticsDb(getConfig(event).analyticsDbPath)
  if (db) failAnalyticsEvaluation(db, id, code || 'STREAM_ERROR', new Date().toISOString())
}

export function getAnalyticsOverview(event: H3Event, filters: AnalyticsFilters): AnalyticsOverview {
  const db = requireAnalyticsDb(event)
  const { clause, params } = buildAnalyticsFilter(filters)
  const row = db.prepare(`SELECT
    COUNT(*) AS startedCount,
    SUM(status = 'completed') AS completedCount,
    SUM(status = 'failed') AS failedCount,
    AVG(CASE WHEN status = 'completed' THEN total_score END) AS averageScore,
    COUNT(DISTINCT CASE WHEN status = 'completed' THEN ip_hash END) AS uniqueVisitors,
    MAX(CASE WHEN status = 'completed' THEN completed_at END) AS latestCompletedAt
    FROM analytics_evaluations WHERE 1 = 1${clause}`).get(...params) as Record<string, unknown>
  const startedCount = Number(row.startedCount || 0)
  const completedCount = Number(row.completedCount || 0)
  return { startedCount, completedCount, failedCount: Number(row.failedCount || 0), completionRate: startedCount ? completedCount / startedCount : 0, averageScore: finiteNumber(row.averageScore), uniqueVisitors: Number(row.uniqueVisitors || 0), latestCompletedAt: stringValue(row.latestCompletedAt) }
}

export function getAnalyticsTimeline(event: H3Event, filters: AnalyticsFilters): AnalyticsTimelinePoint[] {
  const db = requireAnalyticsDb(event)
  const { clause, params } = buildAnalyticsFilter(filters)
  const rows = db.prepare(`SELECT substr(completed_at, 1, 10) AS date, COUNT(*) AS completedCount, AVG(total_score) AS averageScore FROM analytics_evaluations WHERE status = 'completed'${clause} GROUP BY date ORDER BY date`).all(...params) as Array<Record<string, unknown>>
  return rows.map(row => ({ date: String(row.date), completedCount: Number(row.completedCount), averageScore: finiteNumber(row.averageScore) }))
}

export function getAnalyticsBreakdown(event: H3Event, filters: AnalyticsFilters): AnalyticsBreakdown {
  const db = requireAnalyticsDb(event)
  const { clause, params } = buildAnalyticsFilter(filters)
  const total = Number((db.prepare(`SELECT COUNT(*) AS count FROM analytics_evaluations WHERE status = 'completed'${clause}`).get(...params) as { count: number }).count)
  const group = (column: string) => (db.prepare(`SELECT ${column} AS key, COUNT(*) AS count, AVG(total_score) AS averageScore FROM analytics_evaluations WHERE status = 'completed'${clause} GROUP BY ${column} ORDER BY count DESC LIMIT 12`).all(...params) as Array<Record<string, unknown>>).map(row => ({ key: String(row.key || 'unknown'), count: Number(row.count), averageScore: finiteNumber(row.averageScore), share: total ? Number(row.count) / total : 0 }))
  return { modes: group('mode'), genres: group('genre'), regions: group('country_code') }
}

export function getAnalyticsRecords(event: H3Event, filters: AnalyticsFilters, page: number, pageSize: number): AnalyticsRecordsPage {
  const db = requireAnalyticsDb(event)
  const result = queryAnalyticsRecords(db, filters, page, pageSize)
  return { items: result.rows.map(record => ({ ...record, ipHash: record.ipHash ? record.ipHash.slice(0, 12) : null })), total: result.total, page, pageSize }
}

export function runAnalyticsRetention(event: H3Event): number {
  const config = getConfig(event)
  const db = requireAnalyticsDb(event)
  const days = Math.max(1, Number(config.analyticsRetentionDays) || 180)
  return cleanAnalyticsRetention(db, new Date(Date.now() - days * 86400000).toISOString())
}

function requireAnalyticsDb(event: H3Event) {
  const db = getAnalyticsDb(getConfig(event).analyticsDbPath)
  if (!db) throw createError({ statusCode: 503, statusMessage: 'Analytics Disabled', data: { code: 'ANALYTICS_DISABLED', message: 'Analytics database is not configured.' } })
  return db
}
function asRecord(value: unknown): Record<string, unknown> | null { return value && typeof value === 'object' ? value as Record<string, unknown> : null }
function finiteNumber(value: unknown): number | null { const n = Number(value); return Number.isFinite(n) ? n : null }
function stringValue(value: unknown): string | null { return typeof value === 'string' && value ? value : null }
function asMode(value: unknown): AnalyticsEvaluationMode | null { return value === 'single' || value === 'joint' || value === 'compare' ? value : null }
