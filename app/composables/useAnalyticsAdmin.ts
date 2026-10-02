import type { AnalyticsBreakdown, AnalyticsFilters, AnalyticsOverview, AnalyticsRecordsPage, AnalyticsTimelinePoint } from '#shared/types/analytics'

export function useAnalyticsAdmin() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function refresh(filters: AnalyticsFilters = {}) {
    loading.value = true
    error.value = null
    try {
      const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value).map(([key, value]) => [key, String(value)]))
      const suffix = query.toString() ? `?${query}` : ''
      const [overview, timeline, breakdown, records] = await Promise.all([
        $fetch<AnalyticsOverview>(`/api/admin/analytics/overview${suffix}`),
        $fetch<AnalyticsTimelinePoint[]>(`/api/admin/analytics/timeline${suffix}`),
        $fetch<AnalyticsBreakdown>(`/api/admin/analytics/breakdown${suffix}`),
        $fetch<AnalyticsRecordsPage>(`/api/admin/analytics/records${suffix}`),
      ])
      return { overview, timeline, breakdown, records }
    }
    catch (cause: unknown) {
      error.value = (cause as Error).message || '加载分析数据失败'
      return null
    }
    finally {
      loading.value = false
    }
  }

  return { loading, error, refresh }
}
