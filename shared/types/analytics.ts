/** 使用分析的前后端共享数据契约。绝不包含原始 IP、图片 URL 或评估全文。 */

export type AnalyticsEvaluationMode = 'single' | 'joint' | 'compare' | 'unknown'
export type AnalyticsEvaluationStatus = 'started' | 'completed' | 'failed'

export interface AnalyticsGeoLocation {
  countryCode: string
  regionName: string
  cityName: string
}

export interface AnalyticsEvaluationRecord {
  id: number
  status: AnalyticsEvaluationStatus
  mode: AnalyticsEvaluationMode
  genre: string | null
  totalScore: number | null
  imageCount: number | null
  ipHash: string | null
  countryCode: string
  regionName: string
  cityName: string
  startedAt: string
  completedAt: string | null
  durationMs: number | null
  failureCode: string | null
}

export interface AnalyticsFilters {
  from?: string
  to?: string
  mode?: AnalyticsEvaluationMode
  genre?: string
  countryCode?: string
}

export interface AnalyticsOverview {
  startedCount: number
  completedCount: number
  failedCount: number
  completionRate: number
  averageScore: number | null
  uniqueVisitors: number
  latestCompletedAt: string | null
}

export interface AnalyticsTimelinePoint {
  date: string
  completedCount: number
  averageScore: number | null
}

export interface AnalyticsBreakdownItem {
  key: string
  count: number
  averageScore: number | null
  share: number
}

export interface AnalyticsBreakdown {
  modes: AnalyticsBreakdownItem[]
  genres: AnalyticsBreakdownItem[]
  regions: AnalyticsBreakdownItem[]
}

export interface AnalyticsRecordsPage {
  items: AnalyticsEvaluationRecord[]
  total: number
  page: number
  pageSize: number
}

export interface AnalyticsSession {
  authenticated: boolean
}
