/**
 * /api/evaluate/** — 委托给 venus-core Nitro 适配器。
 *
 * 覆盖 stream、stream/jsonl、group、group/stream、group/stream/jsonl 等子路由；
 * POST /api/evaluate 自身由同目录 index.post.ts 承接（radix3 的 `**` 不匹配空尾段）。
 */
export default defineEventHandler(handleVenusApi)
