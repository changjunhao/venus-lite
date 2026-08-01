/**
 * GET /api/metadata — 门类 / 子类 / 维度元数据，委托给 venus-core Nitro 适配器。
 * 前端在评估前拉取此表以渲染门类选择与维度说明。
 */
export default defineEventHandler(handleVenusApi)
