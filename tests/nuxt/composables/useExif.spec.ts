import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'

// ── vi.hoisted：所有 mock 必须在模块加载前定义 ──

const { mockLoad } = vi.hoisted(() => {
  return { mockLoad: vi.fn() }
})

vi.mock('exifreader', () => ({
  load: mockLoad,
}))

// eslint-disable-next-line import/first
import { extractExif, useExif } from '#imports'

// ── 工具 ──

function createMockFile(name = 'test.jpg', type = 'image/jpeg'): File {
  const buffer = new ArrayBuffer(100)
  return new File([buffer], name, { type })
}

/** 完整 EXIF tags mock（对齐 upload.js L53-105 全字段） */
function fullTags() {
  return {
    ShutterSpeedValue: { computed: 0.004, description: '1/250' },
    ISOSpeedRatings: { value: 400 },
    FNumber: { computed: 2.8 },
    FocalLength: { computed: 35 },
    Model: { description: 'ILCE-7M4' },
    LensModel: { description: 'FE 35mm F1.4 GM' },
    DateTimeOriginal: { description: '2024:01:15 10:30:00' },
    Flash: { value: 16, description: 'Flash did not fire' },
  }
}

// ── 纯函数测试 ──

describe('extractExif', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('全字段正确提取', async () => {
    mockLoad.mockResolvedValue(fullTags())
    const result = await extractExif(createMockFile())

    expect(mockLoad).toHaveBeenCalledOnce()
    expect(result).toEqual({
      shutterSpeed: '1/250',
      iso: 400,
      fNumber: 2.8,
      focalLength: 35,
      cameraModel: 'ILCE-7M4',
      lensModel: 'FE 35mm F1.4 GM',
      dateTimeOriginal: '2024-01-15 10:30',
      flash: 'Flash did not fire',
    })
  })

  it('部分字段缺失时仅返回有值字段', async () => {
    mockLoad.mockResolvedValue({
      Model: { description: 'X-T5' },
      FNumber: { computed: 1.4 },
    })
    const result = await extractExif(createMockFile())

    expect(result).toEqual({
      cameraModel: 'X-T5',
      fNumber: 1.4,
    })
  })

  it('全字段缺失（空 tags）返回 null', async () => {
    mockLoad.mockResolvedValue({})
    const result = await extractExif(createMockFile())
    expect(result).toBeNull()
  })

  it('ExifReader.load 抛异常时返回 null（不 throw）', async () => {
    mockLoad.mockRejectedValue(new Error('corrupt file'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await extractExif(createMockFile())

    expect(result).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith('EXIF 提取失败:', 'corrupt file')
    warnSpy.mockRestore()
  })

  it('ISO NaN 守卫：value 为非数字时 iso 字段不出现', async () => {
    mockLoad.mockResolvedValue({
      ISOSpeedRatings: { value: 'abc' },
      Model: { description: 'Test' },
    })
    const result = await extractExif(createMockFile())

    expect(result).toEqual({ cameraModel: 'Test' })
    expect(result?.iso).toBeUndefined()
  })

  it('ISO 为数组时取首元素（parseInt 语义）', async () => {
    mockLoad.mockResolvedValue({
      ISOSpeedRatings: { value: [100, 200] },
    })
    const result = await extractExif(createMockFile())
    expect(result?.iso).toBe(100)
  })

  it('日期格式化："2024:01:15 10:30:00" → "2024-01-15 10:30"', async () => {
    mockLoad.mockResolvedValue({
      DateTimeOriginal: { description: '2024:01:15 10:30:00' },
    })
    const result = await extractExif(createMockFile())
    expect(result?.dateTimeOriginal).toBe('2024-01-15 10:30')
  })

  it('日期多标签 fallback：DateTimeOriginal 无 → DateTimeDigitized 有', async () => {
    mockLoad.mockResolvedValue({
      DateTimeDigitized: { description: '2023:06:20 08:15:30' },
    })
    const result = await extractExif(createMockFile())
    expect(result?.dateTimeOriginal).toBe('2023-06-20 08:15')
  })

  it('日期 value fallback：description 全无 → 取 .value', async () => {
    mockLoad.mockResolvedValue({
      DateTime: { value: '2022:12:01 18:45:00' },
    })
    const result = await extractExif(createMockFile())
    expect(result?.dateTimeOriginal).toBe('2022-12-01 18:45')
  })

  it('shutterSpeed 优先取 description', async () => {
    mockLoad.mockResolvedValue({
      ShutterSpeedValue: { computed: 0.008, description: '1/125' },
    })
    const result = await extractExif(createMockFile())
    expect(result?.shutterSpeed).toBe('1/125')
  })

  it('shutterSpeed 无 description 时回退 computed 字符串', async () => {
    mockLoad.mockResolvedValue({
      ShutterSpeedValue: { computed: 0.004 },
    })
    const result = await extractExif(createMockFile())
    expect(result?.shutterSpeed).toBe('0.004')
  })

  it('flash 取 description 回退 String(value)', async () => {
    mockLoad.mockResolvedValue({
      Flash: { value: 24 },
    })
    const result = await extractExif(createMockFile())
    expect(result?.flash).toBe('24')
  })
})

// ── Composable 测试 ──

let api: ReturnType<typeof useExif>

function createHost() {
  return defineComponent({
    setup() {
      api = useExif()
      return () => h('span')
    },
  })
}

describe('useExif', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await mountSuspended(createHost())
  })

  it('extract 成功后 exif.value 有值、extracting 归 false', async () => {
    mockLoad.mockResolvedValue({ Model: { description: 'A7IV' } })

    const result = await api.extract(createMockFile())

    expect(result).toEqual({ cameraModel: 'A7IV' })
    expect(api.exif.value).toEqual({ cameraModel: 'A7IV' })
    expect(api.extracting.value).toBe(false)
  })

  it('extract 失败后 exif.value 为 null、extracting 归 false', async () => {
    mockLoad.mockRejectedValue(new Error('fail'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await api.extract(createMockFile())

    expect(result).toBeNull()
    expect(api.exif.value).toBeNull()
    expect(api.extracting.value).toBe(false)
  })

  it('reset 清空 exif', async () => {
    mockLoad.mockResolvedValue({ FNumber: { computed: 2.0 } })
    await api.extract(createMockFile())
    expect(api.exif.value).toEqual({ fNumber: 2.0 })

    api.reset()
    expect(api.exif.value).toBeNull()
  })

  it('连续 extract 替换旧值', async () => {
    mockLoad.mockResolvedValueOnce({ Model: { description: 'Camera A' } })
    await api.extract(createMockFile('a.jpg'))
    expect(api.exif.value).toEqual({ cameraModel: 'Camera A' })

    mockLoad.mockResolvedValueOnce({ Model: { description: 'Camera B' } })
    await api.extract(createMockFile('b.jpg'))
    expect(api.exif.value).toEqual({ cameraModel: 'Camera B' })
  })

  it('extracting 在异步期间为 true', async () => {
    let resolveLoad!: (value: unknown) => void
    mockLoad.mockReturnValue(new Promise(resolve => (resolveLoad = resolve)))

    const promise = api.extract(createMockFile())
    expect(api.extracting.value).toBe(true)

    resolveLoad({ Model: { description: 'Test' } })
    await promise
    expect(api.extracting.value).toBe(false)
  })
})
