import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import type { AnalyticsEvaluationMode, AnalyticsEvaluationRecord, AnalyticsEvaluationStatus, AnalyticsFilters } from '#shared/types/analytics'

let database: Database.Database | null = null
let databasePath = ''

export interface AnalyticsStartInput {
  mode: AnalyticsEvaluationMode
  ipHash: string | null
  countryCode: string
  regionName: string
  cityName: string
  startedAt: string
}

export interface AnalyticsCompleteInput {
  mode: AnalyticsEvaluationMode
  genre: string | null
  totalScore: number | null
  imageCount: number | null
  completedAt: string
  durationMs: number | null
}

function initialize(db: Database.Database): void {
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  db.pragma('foreign_keys = ON')
  const version = Number(db.pragma('user_version', { simple: true }))
  if (version >= 1) return

  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics_evaluations (
      id INTEGER PRIMARY KEY,
      status TEXT NOT NULL CHECK(status IN ('started', 'completed', 'failed')),
      mode TEXT NOT NULL CHECK(mode IN ('single', 'joint', 'compare', 'unknown')),
      genre TEXT,
      total_score REAL,
      image_count INTEGER,
      ip_hash TEXT,
      country_code TEXT NOT NULL DEFAULT 'unknown',
      region_name TEXT NOT NULL DEFAULT 'unknown',
      city_name TEXT NOT NULL DEFAULT 'unknown',
      started_at TEXT NOT NULL,
      completed_at TEXT,
      duration_ms INTEGER,
      failure_code TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS analytics_status_completed_at ON analytics_evaluations(status, completed_at);
    CREATE INDEX IF NOT EXISTS analytics_completed_at ON analytics_evaluations(completed_at);
    CREATE INDEX IF NOT EXISTS analytics_mode_completed_at ON analytics_evaluations(mode, completed_at);
    CREATE INDEX IF NOT EXISTS analytics_genre_completed_at ON analytics_evaluations(genre, completed_at);
    CREATE INDEX IF NOT EXISTS analytics_country_completed_at ON analytics_evaluations(country_code, completed_at);
    PRAGMA user_version = 1;
  `)
}

export function getAnalyticsDb(path: string): Database.Database | null {
  if (!path) return null
  if (database && databasePath === path) return database
  if (database) database.close()
  mkdirSync(dirname(path), { recursive: true })
  database = new Database(path)
  databasePath = path
  initialize(database)
  return database
}

export function insertAnalyticsStart(db: Database.Database, input: AnalyticsStartInput): number {
  const result = db.prepare(`
    INSERT INTO analytics_evaluations (status, mode, ip_hash, country_code, region_name, city_name, started_at)
    VALUES ('started', @mode, @ipHash, @countryCode, @regionName, @cityName, @startedAt)
  `).run(input)
  return Number(result.lastInsertRowid)
}

export function completeAnalyticsEvaluation(db: Database.Database, id: number, input: AnalyticsCompleteInput): void {
  db.prepare(`
    UPDATE analytics_evaluations
    SET status = 'completed', mode = @mode, genre = @genre, total_score = @totalScore,
      image_count = @imageCount, completed_at = @completedAt, duration_ms = @durationMs, failure_code = NULL
    WHERE id = @id AND status = 'started'
  `).run({ id, ...input })
}

export function failAnalyticsEvaluation(db: Database.Database, id: number, failureCode: string, completedAt: string): void {
  db.prepare(`
    UPDATE analytics_evaluations
    SET status = 'failed', failure_code = @failureCode, completed_at = @completedAt
    WHERE id = @id AND status = 'started'
  `).run({ id, failureCode, completedAt })
}

export function cleanAnalyticsRetention(db: Database.Database, before: string): number {
  return db.prepare('DELETE FROM analytics_evaluations WHERE started_at < ?').run(before).changes
}

function buildFilter(filters: AnalyticsFilters, alias = ''): { clause: string, params: unknown[] } {
  const prefix = alias ? `${alias}.` : ''
  const conditions: string[] = []
  const params: unknown[] = []
  if (filters.from) { conditions.push(`${prefix}completed_at >= ?`); params.push(filters.from) }
  if (filters.to) { conditions.push(`${prefix}completed_at <= ?`); params.push(filters.to) }
  if (filters.mode && filters.mode !== 'unknown') { conditions.push(`${prefix}mode = ?`); params.push(filters.mode) }
  if (filters.genre) { conditions.push(`${prefix}genre = ?`); params.push(filters.genre) }
  if (filters.countryCode) { conditions.push(`${prefix}country_code = ?`); params.push(filters.countryCode) }
  return { clause: conditions.length ? ` AND ${conditions.join(' AND ')}` : '', params }
}

export function queryAnalyticsRecords(db: Database.Database, filters: AnalyticsFilters, page: number, pageSize: number): { total: number, rows: AnalyticsEvaluationRecord[] } {
  const { clause, params } = buildFilter(filters)
  const total = Number((db.prepare(`SELECT COUNT(*) AS count FROM analytics_evaluations WHERE 1 = 1${clause}`).get(...params) as { count: number }).count)
  const rows = db.prepare(`SELECT * FROM analytics_evaluations WHERE 1 = 1${clause} ORDER BY started_at DESC LIMIT ? OFFSET ?`).all(...params, pageSize, (page - 1) * pageSize) as Array<Record<string, unknown>>
  return { total, rows: rows.map(mapRecord) }
}

function mapRecord(row: Record<string, unknown>): AnalyticsEvaluationRecord {
  return {
    id: Number(row.id), status: row.status as AnalyticsEvaluationStatus, mode: row.mode as AnalyticsEvaluationMode,
    genre: row.genre as string | null, totalScore: row.total_score as number | null, imageCount: row.image_count as number | null,
    ipHash: row.ip_hash as string | null, countryCode: String(row.country_code), regionName: String(row.region_name), cityName: String(row.city_name),
    startedAt: String(row.started_at), completedAt: row.completed_at as string | null, durationMs: row.duration_ms as number | null, failureCode: row.failure_code as string | null,
  }
}

export function buildAnalyticsFilter(filters: AnalyticsFilters): { clause: string, params: unknown[] } {
  return buildFilter(filters)
}
