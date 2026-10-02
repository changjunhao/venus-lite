import { getAnalyticsRecords } from '~~/server/utils/analytics-service'
import { analyticsFilters, analyticsPage } from '~~/server/utils/analytics-request'
export default defineEventHandler((event) => { const { page, pageSize } = analyticsPage(event); return getAnalyticsRecords(event, analyticsFilters(event), page, pageSize) })
