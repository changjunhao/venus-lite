import { getAnalyticsBreakdown } from '~~/server/utils/analytics-service'
import { analyticsFilters } from '~~/server/utils/analytics-request'
export default defineEventHandler(event => getAnalyticsBreakdown(event, analyticsFilters(event)))
