import type { Note } from '#shared/types/api'

/**
 * GET /api/notes — 备忘录列表。
 * listNotes 来自 server/utils（Nitro 自动导入）。
 */
export default defineEventHandler((): Note[] => {
  return listNotes()
})
