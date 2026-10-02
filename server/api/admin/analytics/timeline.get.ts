import { getAnalyticsTimeline } from '~~/server/utils/analytics-service'
import { analyticsFilters } from '~~/server/utils/analytics-request'
export default defineEventHandler(event => getAnalyticsTimeline(event, analyticsFilters(event)))
