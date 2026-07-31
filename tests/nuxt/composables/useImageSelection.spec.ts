import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, effectScope, h } from 'vue'
import {
  getFileIdentity,
  getImageDimensions,
  useImageSelection,
  validateImageFile,
  type SelectionMode,
} from '#imports'

// ── Mock 工具 ──

/** 可控 Image 类：通过 mockDimensions 设置下一张图片的尺寸，或 mockImageError 触发 onerror */
let mockDimensions = { width: 1920, height: 1080 }
let mockImageError = false

class MockImage {
  naturalWidth = 0
  naturalHeight = 0
  onload: (() => void) | null = null
  onerror: (() => void) | null = null

  set src(_value: string) {
    // 模拟异步加载完成
    queueMicrotask(() => {
      if (mockImageError) {
        this.onerror?.()
      }
      else {
        this.naturalWidth = mockDimensions.width
        this.naturalHeight = mockDimensions.height
        this.onload?.()
      }
    })
  }
}

function createMockFile(name: string, type: string, size = 1000, lastModified = 1000): File {
  const buffer = new ArrayBuffer(size)
  return new File([buffer], name, { type, lastModified })
}

// ── 全局 mock 设置 ──

let createObjectURLMock: ReturnType<typeof vi.fn>
let revokeObjectURLMock: ReturnType<typeof vi.fn>
let urlCounter = 0

beforeEach(() => {
  vi.unstubAllGlobals()
  mockDimensions = { width: 1920, height: 1080 }
  mockImageError = false
  urlCounter = 0

  createObjectURLMock = vi.fn(() => `blob:mock-${++urlCounter}`)
  revokeObjectURLMock = vi.fn()

  // happy-dom 的 URL 无 createObjectURL/revokeObjectURL，直接挂载后 spy
  const URLStatic = URL as unknown as Record<string, unknown>
  URLStatic.createObjectURL = createObjectURLMock
  URLStatic.revokeObjectURL = revokeObjectURLMock

  vi.stubGlobal('Image', MockImage)
})

// ── 纯函数测试 ──

describe('getFileIdentity', () => {
  it('返回 name:size:lastModified 格式的身份标识', () => {
    const file = createMockFile('photo.jpg', 'image/jpeg', 2048, 1700000000)
    expect(getFileIdentity(file)).toBe('photo.jpg:2048:1700000000')
  })
})

describe('getImageDimensions', () => {
  it('成功时返回自然尺寸', async () => {
    mockDimensions = { width: 3000, height: 2000 }
    const result = await getImageDimensions('blob:test')
    expect(result).toEqual({ width: 3000, height: 2000 })
  })

  it('加载失败时 reject', async () => {
    mockImageError = true
    await expect(getImageDimensions('blob:bad')).rejects.toThrow('unreadable')
  })
})

describe('validateImageFile', () => {
  it('不支持的 MIME → ok:false + unsupported-type', async () => {
    const file = createMockFile('doc.pdf', 'application/pdf')
    const result = await validateImageFile(file)
    expect(result).toEqual({ ok: false, code: 'unsupported-type' })
    expect(createObjectURLMock).not.toHaveBeenCalled()
  })

  it('无法解码 → ok:false + unreadable', async () => {
    mockImageError = true
    const file = createMockFile('corrupt.jpg', 'image/jpeg')
    const result = await validateImageFile(file)
    expect(result).toEqual({ ok: false, code: 'unreadable' })
    // 失败时 revoke 临时 URL
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-1')
  })

  it('超过 8K → ok:false + exceeds-8k + params', async () => {
    mockDimensions = { width: 7680, height: 4321 } // > 8K
    const file = createMockFile('huge.jpg', 'image/jpeg')
    const result = await validateImageFile(file)
    expect(result).toEqual({
      ok: false,
      code: 'exceeds-8k',
      params: { width: 7680, height: 4321 },
    })
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-1')
  })

  it('4K-8K 非 JPEG/PNG → ok:false + high-res-format', async () => {
    mockDimensions = { width: 3840, height: 2161 } // > 4K
    const file = createMockFile('large.webp', 'image/webp')
    const result = await validateImageFile(file)
    expect(result).toEqual({
      ok: false,
      code: 'high-res-format',
      params: { width: 3840, height: 2161 },
    })
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-1')
  })

  it('4K-8K JPEG → ok:true', async () => {
    mockDimensions = { width: 3840, height: 2161 } // > 4K but JPEG is allowed
    const file = createMockFile('large.jpg', 'image/jpeg')
    const result = await validateImageFile(file)
    expect(result).toEqual({
      ok: true,
      objectURL: 'blob:mock-1',
      width: 3840,
      height: 2161,
    })
    expect(revokeObjectURLMock).not.toHaveBeenCalled()
  })

  it('合法文件 → ok:true + objectURL + width/height', async () => {
    mockDimensions = { width: 2400, height: 1600 }
    const file = createMockFile('photo.png', 'image/png')
    const result = await validateImageFile(file)
    expect(result).toEqual({
      ok: true,
      objectURL: 'blob:mock-1',
      width: 2400,
      height: 1600,
    })
    expect(createObjectURLMock).toHaveBeenCalledWith(file)
    expect(revokeObjectURLMock).not.toHaveBeenCalled()
  })
})

// ── Composable 测试 ──

/** 宿主组件：挂载 composable 并暴露 API（对齐 useTheme.spec.ts 模式） */
let api: ReturnType<typeof useImageSelection>

function createHost(mode: SelectionMode) {
  return defineComponent({
    setup() {
      api = useImageSelection({ mode })
      return () => h('span')
    },
  })
}

describe('useImageSelection（multi 模式）', () => {
  beforeEach(async () => {
    await mountSuspended(createHost('multi'))
  })

  it('addFiles 添加合法文件，entries 含正确 entry', async () => {
    mockDimensions = { width: 1920, height: 1080 }
    const file = createMockFile('a.jpg', 'image/jpeg', 1000, 100)
    await api.addFiles([file])

    expect(api.entries.value).toHaveLength(1)
    expect(api.entries.value[0]).toMatchObject({
      identity: 'a.jpg:1000:100',
      file,
      width: 1920,
      height: 1080,
    })
    expect(api.entries.value[0]!.objectURL).toMatch(/^blob:mock-/)
    expect(api.errors.value).toHaveLength(0)
  })

  it('去重：同 identity 不重复添加 + 产生 duplicate 错误', async () => {
    const file1 = createMockFile('a.jpg', 'image/jpeg', 1000, 100)
    const file2 = createMockFile('a.jpg', 'image/jpeg', 1000, 100) // 同 identity
    await api.addFiles([file1])
    await api.addFiles([file2])

    expect(api.entries.value).toHaveLength(1)
    expect(api.errors.value).toHaveLength(1)
    expect(api.errors.value[0]).toMatchObject({ code: 'duplicate', fileName: 'a.jpg' })
  })

  it('批内去重：同一批中相同 identity 只添加一次', async () => {
    const file1 = createMockFile('a.jpg', 'image/jpeg', 1000, 100)
    const file2 = createMockFile('a.jpg', 'image/jpeg', 1000, 100)
    await api.addFiles([file1, file2])

    expect(api.entries.value).toHaveLength(1)
    expect(api.errors.value).toHaveLength(1)
    expect(api.errors.value[0]).toMatchObject({ code: 'duplicate' })
  })

  it('超 10 张截断 + over-capacity 错误', async () => {
    // 先添加 9 张
    const files9 = Array.from({ length: 9 }, (_, i) =>
      createMockFile(`img${i}.jpg`, 'image/jpeg', 1000 + i, i),
    )
    await api.addFiles(files9)
    expect(api.entries.value).toHaveLength(9)

    // 再添加 3 张，只应接受 1 张（达到上限 10）
    const files3 = Array.from({ length: 3 }, (_, i) =>
      createMockFile(`extra${i}.jpg`, 'image/jpeg', 2000 + i, 100 + i),
    )
    await api.addFiles(files3)

    expect(api.entries.value).toHaveLength(10)
    expect(api.errors.value).toHaveLength(2)
    expect(api.errors.value.every(e => e.code === 'over-capacity')).toBe(true)
  })

  it('removeEntry：移除 + revoke objectURL', async () => {
    const file = createMockFile('a.jpg', 'image/jpeg', 1000, 100)
    await api.addFiles([file])
    const entry = api.entries.value[0]!

    api.removeEntry(entry.id)
    expect(api.entries.value).toHaveLength(0)
    expect(revokeObjectURLMock).toHaveBeenCalledWith(entry.objectURL)
  })

  it('moveEntry：交换位置', async () => {
    const file1 = createMockFile('a.jpg', 'image/jpeg', 1000, 1)
    const file2 = createMockFile('b.jpg', 'image/jpeg', 1000, 2)
    await api.addFiles([file1, file2])

    const [first, second] = api.entries.value
    api.moveEntry(first!.id, 1) // 第一张后移

    expect(api.entries.value[0]!.identity).toBe(second!.identity)
    expect(api.entries.value[1]!.identity).toBe(first!.identity)
  })

  it('moveEntry 边界：首张前移 / 末张后移为 no-op', async () => {
    const file1 = createMockFile('a.jpg', 'image/jpeg', 1000, 1)
    const file2 = createMockFile('b.jpg', 'image/jpeg', 1000, 2)
    await api.addFiles([file1, file2])

    const [first, second] = api.entries.value
    api.moveEntry(first!.id, -1) // 首张前移
    expect(api.entries.value[0]!.id).toBe(first!.id)

    api.moveEntry(second!.id, 1) // 末张后移
    expect(api.entries.value[1]!.id).toBe(second!.id)
  })

  it('clear：全量 revoke + 清空', async () => {
    const files = [
      createMockFile('a.jpg', 'image/jpeg', 1000, 1),
      createMockFile('b.jpg', 'image/jpeg', 1000, 2),
    ]
    await api.addFiles(files)
    const urls = api.entries.value.map(e => e.objectURL)

    api.clear()
    expect(api.entries.value).toHaveLength(0)
    expect(api.errors.value).toHaveLength(0)
    urls.forEach(url => expect(revokeObjectURLMock).toHaveBeenCalledWith(url))
  })

  it('canSubmit：< 2 张为 false，≥ 2 张为 true', async () => {
    expect(api.canSubmit.value).toBe(false)

    await api.addFiles([createMockFile('a.jpg', 'image/jpeg', 1000, 1)])
    expect(api.canSubmit.value).toBe(false)

    await api.addFiles([createMockFile('b.jpg', 'image/jpeg', 1000, 2)])
    expect(api.canSubmit.value).toBe(true)
  })

  it('scope dispose：自动 revoke 所有 objectURL', async () => {
    const scope = effectScope()
    let scopeApi: ReturnType<typeof useImageSelection>

    scope.run(() => {
      scopeApi = useImageSelection({ mode: 'multi' })
    })

    mockDimensions = { width: 800, height: 600 }
    await scopeApi!.addFiles([createMockFile('x.jpg', 'image/jpeg', 500, 1)])
    const url = scopeApi!.entries.value[0]!.objectURL

    scope.stop()
    expect(revokeObjectURLMock).toHaveBeenCalledWith(url)
  })

  it('校验失败时 entries 不变，errors 有值', async () => {
    const good = createMockFile('good.jpg', 'image/jpeg', 1000, 1)
    await api.addFiles([good])
    expect(api.entries.value).toHaveLength(1)

    mockImageError = true
    const bad = createMockFile('bad.jpg', 'image/jpeg', 1000, 2)
    await api.addFiles([bad])

    expect(api.entries.value).toHaveLength(1) // 不变
    expect(api.errors.value).toHaveLength(1)
    expect(api.errors.value[0]).toMatchObject({ code: 'unreadable', fileName: 'bad.jpg' })
  })
})

describe('useImageSelection（single 模式）', () => {
  beforeEach(async () => {
    await mountSuspended(createHost('single'))
  })

  it('addFiles 添加文件，canSubmit 为 true', async () => {
    const file = createMockFile('photo.jpg', 'image/jpeg', 2000, 100)
    await api.addFiles([file])

    expect(api.entries.value).toHaveLength(1)
    expect(api.canSubmit.value).toBe(true)
    expect(api.count.value).toBe(1)
  })

  it('addFiles 替换旧 entry，旧 objectURL 被 revoke', async () => {
    const file1 = createMockFile('first.jpg', 'image/jpeg', 1000, 1)
    await api.addFiles([file1])
    const oldURL = api.entries.value[0]!.objectURL

    const file2 = createMockFile('second.jpg', 'image/jpeg', 2000, 2)
    await api.addFiles([file2])

    expect(api.entries.value).toHaveLength(1)
    expect(api.entries.value[0]!.file.name).toBe('second.jpg')
    expect(revokeObjectURLMock).toHaveBeenCalledWith(oldURL)
  })

  it('校验失败时 errors 有值，entries 不变', async () => {
    const good = createMockFile('good.jpg', 'image/jpeg', 1000, 1)
    await api.addFiles([good])

    const bad = createMockFile('bad.gif', 'image/gif', 1000, 2)
    await api.addFiles([bad])

    expect(api.entries.value).toHaveLength(1)
    expect(api.entries.value[0]!.file.name).toBe('good.jpg')
    expect(api.errors.value).toHaveLength(1)
    expect(api.errors.value[0]).toMatchObject({ code: 'unsupported-type', fileName: 'bad.gif' })
  })

  it('moveEntry 在 single 模式下为 no-op', async () => {
    const file = createMockFile('a.jpg', 'image/jpeg', 1000, 1)
    await api.addFiles([file])
    const id = api.entries.value[0]!.id

    api.moveEntry(id, 1)
    expect(api.entries.value).toHaveLength(1)
    expect(api.entries.value[0]!.id).toBe(id)
  })

  it('canSubmit：空为 false，有 1 张为 true', () => {
    expect(api.canSubmit.value).toBe(false)
  })
})
