import type { Note } from '#shared/types/api'

/**
 * POST /api/notes — 新建备忘录。
 * 演示统一错误结构：校验失败时 createError({ statusCode, data: ApiError })。
 */
export default defineEventHandler(async (event): Promise<Note> => {
  const body = await readBody<{ title?: unknown }>(event).catch(() => null)
  const title = typeof body?.title === 'string' ? body.title.trim() : ''

  if (!title) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { code: 'VALIDATION_ERROR', message: '备忘内容不能为空' },
    })
  }
  if (title.length > 100) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { code: 'VALIDATION_ERROR', message: '备忘内容不能超过 100 字' },
    })
  }

  return createNote(title)
})
