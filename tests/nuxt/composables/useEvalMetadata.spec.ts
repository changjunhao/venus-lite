import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'

// ── vi.hoisted：所有 mock 必须在模块加载前定义 ──

const { mockFetch } = vi.hoisted(() => {
  const mockFetch = vi.fn()
  // Nuxt 的 $fetch 在模块评估时捕获 globalThis.$fetch
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).$fetch = mockFetch
  return { mockFetch }
})

// eslint-disable-next-line import/first
import { buildGenreOptions, clearNuxtState, resolveGenreLabel, resolveSceneLabel, useEvalMetadata } from '#imports'
// eslint-disable-next-line import/first
import type { GenreMetadata } from '#shared/types/evaluation'

// ── 工具 ──

const FIXTURE: Record<string, GenreMetadata> = {
  landscape: {
    label: '风光',
    dimensionLabels: ['构图', '光影', '色彩', '质感', '意境'],
    subtypes: [
      { value: 'mountain', label: '山岳' },
      { value: 'seascape', label: '海景' },
    ],
    dimensions: [
      { key: 'composition', label: '构图' },
      { key: 'lighting', label: '光影' },
    ],
  },
  portrait: {
    label: '人像',
    dimensionLabels: ['表情', '构图', '光影', '环境', '故事性'],
    subtypes: [
      { value: 'studio', label: '棚拍' },
      { value: 'environmental', label: '环境人像' },
    ],
    dimensions: [
      { key: 'expression', label: '表情' },
      { key: 'composition', label: '构图' },
    ],
  },
}

let api: ReturnType<typeof useEvalMetadata>

// 对齐 useTheme.spec.ts 的 Host 组件模式：
// clearNuxtState 重置 useState，避免用例间共享状态泄漏
const MetadataHost = defineComponent({
  setup() {
    clearNuxtState()
    api = useEvalMetadata()
    return () => h('span')
  },
})

// ── 纯函数测试 ──

describe('resolveGenreLabel', () => {
  it('命中时返回门类中文标签', () => {
    expect(resolveGenreLabel('landscape', FIXTURE)).toBe('风光')
    expect(resolveGenreLabel('portrait', FIXTURE)).toBe('人像')
  })

  it('未命中时回退原始 key', () => {
    expect(resolveGenreLabel('street', FIXTURE)).toBe('street')
  })

  it('metadata 为 null/undefined 时回退原始 key', () => {
    expect(resolveGenreLabel('landscape', null)).toBe('landscape')
    expect(resolveGenreLabel('landscape')).toBe('landscape')
  })
})

describe('resolveSceneLabel', () => {
  it('命中时返回场景中文标签', () => {
    expect(resolveSceneLabel('mountain', 'landscape', FIXTURE)).toBe('山岳')
    expect(resolveSceneLabel('studio', 'portrait', FIXTURE)).toBe('棚拍')
  })

  it('未命中时回退原始 sceneType', () => {
    expect(resolveSceneLabel('urban', 'landscape', FIXTURE)).toBe('urban')
  })

  it('门类未命中时回退原始 sceneType', () => {
    expect(resolveSceneLabel('mountain', 'street', FIXTURE)).toBe('mountain')
  })

  it('metadata 为 null/undefined 时回退原始 sceneType', () => {
    expect(resolveSceneLabel('mountain', 'landscape', null)).toBe('mountain')
    expect(resolveSceneLabel('mountain', 'landscape')).toBe('mountain')
  })
})

describe('buildGenreOptions', () => {
  it('正常 metadata 返回选项列表', () => {
    const options = buildGenreOptions(FIXTURE)
    expect(options).toEqual([
      { value: 'landscape', label: '风光' },
      { value: 'portrait', label: '人像' },
    ])
  })

  it('metadata 为 null 时返回空数组', () => {
    expect(buildGenreOptions(null)).toEqual([])
  })

  it('metadata 为 undefined 时返回空数组', () => {
    expect(buildGenreOptions()).toEqual([])
  })

  it('metadata 为空对象时返回空数组', () => {
    expect(buildGenreOptions({})).toEqual([])
  })
})

// ── Composable 测试 ──

describe('useEvalMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetch 成功后 metadata 有值、loading 归 false、error 为 null', async () => {
    mockFetch.mockResolvedValue(FIXTURE)
    await mountSuspended(MetadataHost)

    const result = await api.fetch()

    expect(mockFetch).toHaveBeenCalledWith('/api/metadata')
    expect(result).toEqual(FIXTURE)
    expect(api.metadata.value).toEqual(FIXTURE)
    expect(api.loading.value).toBe(false)
    expect(api.error.value).toBeNull()
  })

  it('幂等性：已缓存后再次 fetch 不发新请求', async () => {
    mockFetch.mockResolvedValue(FIXTURE)
    await mountSuspended(MetadataHost)

    await api.fetch()
    await api.fetch()

    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('并发保护：loading 期间再次 fetch 不发新请求', async () => {
    let resolve!: (value: Record<string, GenreMetadata>) => void
    mockFetch.mockImplementation(() => new Promise(r => (resolve = r)))
    await mountSuspended(MetadataHost)

    const p1 = api.fetch()
    const p2 = api.fetch() // loading=true，应直接返回 null
    resolve(FIXTURE)
    await p1
    await p2

    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('失败后 error 有值、metadata 仍 null、不 throw', async () => {
    // 源码 catch 分支会 console.error（预期日志），静音并断言其确实上报
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch.mockRejectedValue(new Error('Network Error'))
    await mountSuspended(MetadataHost)

    const result = await api.fetch()

    expect(result).toBeNull()
    expect(api.metadata.value).toBeNull()
    expect(api.error.value).toBe('Network Error')
    expect(api.loading.value).toBe(false)
    expect(errorLog).toHaveBeenCalledWith('获取元数据失败:', expect.any(Error))
    errorLog.mockRestore()
  })

  it('失败后可重试', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch.mockRejectedValueOnce(new Error('timeout'))
    await mountSuspended(MetadataHost)

    await api.fetch()
    expect(api.error.value).toBe('timeout')

    mockFetch.mockResolvedValue(FIXTURE)
    const result = await api.fetch()
    expect(result).toEqual(FIXTURE)
    expect(api.error.value).toBeNull()
    // 仅失败那次上报，重试成功不产生日志
    expect(errorLog).toHaveBeenCalledTimes(1)
    errorLog.mockRestore()
  })

  it('genreEntries 随 metadata 派生', async () => {
    mockFetch.mockResolvedValue(FIXTURE)
    await mountSuspended(MetadataHost)

    expect(api.genreEntries.value).toEqual([])

    await api.fetch()
    expect(api.genreEntries.value).toEqual([
      { value: 'landscape', label: '风光' },
      { value: 'portrait', label: '人像' },
    ])
  })
})
