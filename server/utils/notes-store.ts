import type { Note } from '#shared/types/api'

/**
 * 备忘录内存存储 — 仅为架构演示（server/utils 与路由分离的约定），非持久化。
 * 进程重启后数据即丢失；真实业务应替换为数据库或外部存储。
 */

const notes = new Map<string, Note>()

// 预置一条数据，便于首屏演示 SSR 取数
const seed: Note = {
  id: crypto.randomUUID(),
  title: '欢迎使用 Venus Lite 架构骨架',
  createdAt: new Date().toISOString(),
}
notes.set(seed.id, seed)

/** 按创建时间倒序返回全部备忘录 */
export function listNotes(): Note[] {
  return [...notes.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** 新建备忘录（入参已由路由层校验） */
export function createNote(title: string): Note {
  const note: Note = {
    id: crypto.randomUUID(),
    title,
    createdAt: new Date().toISOString(),
  }
  notes.set(note.id, note)
  return note
}
