/**
 * POST /api/evaluate — 单图同步评估，委托给 venus-core Nitro 适配器。
 * 与 [...].ts 共用同一个惰性 adapter 单例。
 */
export default defineEventHandler(handleVenusApi)
