import { runAnalyticsRetention } from '~~/server/utils/analytics-service'
export default defineEventHandler(event => ({ deleted: runAnalyticsRetention(event) }))
