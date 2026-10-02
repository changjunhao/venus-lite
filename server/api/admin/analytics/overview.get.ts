import { getAnalyticsOverview } from '~~/server/utils/analytics-service'
import { analyticsFilters } from '~~/server/utils/analytics-request'
export default defineEventHandler(event => getAnalyticsOverview(event, analyticsFilters(event)))
