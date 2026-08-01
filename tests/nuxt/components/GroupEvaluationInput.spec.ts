import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Component } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import GroupEvaluationInput from '~/components/business/GroupEvaluationInput.vue'

// 测试环境强制 zh locale：happy-dom 的 navigator.language 为 en-US，
// i18n detectBrowserLanguage 会探测为 en；cookie 优先生效（nuxt.config cookieKey 'venus-locale'）
document.cookie = 'venus-locale=zh'

// ── Mock 工具（同 useImageSelection.spec.ts L18-65 模式）──

let mockDimensions = { width: 1920, height: 1080 }
let mockImageError = false

class MockImage {
  naturalWidth = 0
  naturalHeight = 0
  onload: (() => void) | null = null
  onerror: (() => void) | null = null

  set src(_value: string) {
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

  const URLStatic = URL as unknown as Record<string, unknown>
  URLStatic.createObjectURL = createObjectURLMock
  URLStatic.revokeObjectURL = revokeObjectURLMock

  vi.stubGlobal('Image', MockImage)
})

// ── 挂载辅助 ──

/** nuxt vitest 环境默认 stub TransitionGroup；PreviewGrid 以其为根，
 * 需真实渲染卡片（同 PreviewGrid.spec.ts L7-14 的解除模式）。 */
function mountInput(options: Parameters<typeof mountSuspended>[1] = {}) {
  return mountSuspended(GroupEvaluationInput as Component, {
    props: { variant: 'joint' },
    ...options,
    global: { stubs: { TransitionGroup: false }, ...options?.global },
  })
}

/** 经上传区 drop 事件注入文件并等待校验管线完成（同 SingleEvaluationFlow.spec.ts L276 模式） */
async function addFiles(wrapper: Awaited<ReturnType<typeof mountInput>>, files: File[]) {
  await wrapper.find('.upload-zone').trigger('drop', { dataTransfer: { files } })
  await flushPromises()
}

// ── 渲染 ──

describe('渲染', () => {
  // 回归锚点：group-joint.html L51-55 .group-input-card + .group-intro
  it('joint 变体：卡片壳 + INPUT 眉标 + 标题/引言 + 计数徽章 0 / 10 FRAMES', async () => {
    const wrapper = await mountInput()

    const card = wrapper.find('.group-input-card')
    expect(card.exists()).toBe(true)
    expect(card.element.tagName).toBe('SECTION')

    expect(wrapper.find('.section-index').text()).toBe('INPUT')
    expect(wrapper.find('.group-intro h2').text()).toBe('建立一个系列')
    expect(wrapper.find('.group-intro p').text())
      .toBe('上传 2–10 张照片并调整顺序。系统会关注照片之间的关系，而不只是逐张打分。')

    const badge = wrapper.find('.image-count-badge')
    expect(badge.find('strong').text()).toBe('0')
    expect(badge.find('span').text()).toBe('/ 10 FRAMES')
  })

  // 回归锚点：group-compare.html L53 intro 差异
  it('compare 变体：标题/引言切换为对比文案', async () => {
    const wrapper = await mountInput({ props: { variant: 'compare' } })
    expect(wrapper.find('.group-intro h2').text()).toBe('选择需要比较的照片')
    expect(wrapper.find('.group-intro p').text())
      .toBe('上传 2–10 张照片。系统会在统一标准下比较每张作品，排序不受上传顺序影响。')
  })

  // 回归锚点：group-joint.html L82 contact-sheet / group-compare.html L82 comparison-grid
  it('变体传递至 PreviewGrid：joint → .contact-sheet，compare → .comparison-grid', async () => {
    const joint = await mountInput()
    expect(joint.find('.group-preview-grid.contact-sheet').exists()).toBe(true)

    const compare = await mountInput({ props: { variant: 'compare' } })
    expect(compare.find('.group-preview-grid.comparison-grid').exists()).toBe(true)
  })

  // 回归锚点：group-joint.html L57-69 门类 + 逐图明细开关
  it('门类控制：9 个静态选项（auto + 8 门类），默认 auto，开关默认未选中（§9.3）', async () => {
    const wrapper = await mountInput()

    const options = wrapper.findAll('option')
    expect(options).toHaveLength(9)
    expect(options[0]!.text()).toBe('自动识别')
    expect(options[8]!.text()).toBe('运动')
    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('auto')

    const checkbox = wrapper.find('input[type="checkbox"]')
    expect(checkbox.exists()).toBe(true)
    expect((checkbox.element as HTMLInputElement).checked).toBe(false)
  })

  // 回归锚点：group-joint.html L85 按钮初始禁用
  it('空选择时评估按钮禁用，文案为「开始联合评估」', async () => {
    const wrapper = await mountInput()
    const button = wrapper.find('.group-evaluate-button')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.text()).toBe('开始联合评估')
  })
})

// ── 选片管线 ──

describe('选片管线', () => {
  // 回归锚点：group.js L236 renderSelection 计数 + 网格渲染
  it('加入 2 张有效照片：预览卡渲染 + 计数徽章更新 + selectionChange 发射', async () => {
    const wrapper = await mountInput()
    await addFiles(wrapper, [
      createMockFile('a.jpg', 'image/jpeg', 1000),
      createMockFile('b.jpg', 'image/jpeg', 2000),
    ])

    expect(wrapper.findAll('.group-preview-card')).toHaveLength(2)
    expect(wrapper.find('.image-count-badge strong').text()).toBe('2')
    expect(wrapper.find('.group-preview-grid img[alt="第 1 张照片：a.jpg"]').exists()).toBe(true)

    const emitted = wrapper.emitted('selectionChange')
    expect(emitted).toHaveLength(1)
    expect(emitted![0]).toEqual([2])
  })

  it('加入照片后按钮启用，点击发射 start 载荷（entries/genre/includePerImage）', async () => {
    const wrapper = await mountInput()
    await addFiles(wrapper, [
      createMockFile('a.jpg', 'image/jpeg', 1000),
      createMockFile('b.jpg', 'image/jpeg', 2000),
    ])

    const button = wrapper.find('.group-evaluate-button')
    expect(button.attributes('disabled')).toBeUndefined()

    await button.trigger('click')
    const start = wrapper.emitted('start')
    expect(start).toHaveLength(1)
    const payload = start![0]![0] as { entries: unknown[], genre: string, includePerImage: boolean }
    expect(payload.entries).toHaveLength(2)
    expect(payload.genre).toBe('auto')
    expect(payload.includePerImage).toBe(false)
  })

  // 回归锚点：group.js L209 removeFile → invalidateResult
  it('移除照片：卡片减少 + selectionChange 发射', async () => {
    const wrapper = await mountInput()
    await addFiles(wrapper, [
      createMockFile('a.jpg', 'image/jpeg', 1000),
      createMockFile('b.jpg', 'image/jpeg', 2000),
    ])

    await wrapper.find('.group-preview-card .preview-remove').trigger('click')
    // TransitionGroup 离场在 happy-dom 中需额外微任务周期完成 DOM 移除
    await flushPromises()
    await flushPromises()

    expect(wrapper.findAll('.group-preview-card')).toHaveLength(1)
    const emitted = wrapper.emitted('selectionChange')
    expect(emitted![emitted!.length - 1]).toEqual([1])
  })

  // 回归锚点：group.js L227 clearFiles → invalidateResult
  it('清空全部：卡片归零 + selectionChange 发射 0', async () => {
    const wrapper = await mountInput()
    await addFiles(wrapper, [
      createMockFile('a.jpg', 'image/jpeg', 1000),
      createMockFile('b.jpg', 'image/jpeg', 2000),
    ])

    await wrapper.find('.selection-toolbar .text-button').trigger('click')
    await flushPromises()
    await flushPromises()

    expect(wrapper.findAll('.group-preview-card')).toHaveLength(0)
    const emitted = wrapper.emitted('selectionChange')
    expect(emitted![emitted!.length - 1]).toEqual([0])
  })
})

// ── 错误映射（group.js L134/L180/L186/L201）──

describe('错误映射', () => {
  // 回归锚点：group.js L195 `${file.name}：${error.message}`
  it('不支持的格式：文件名前缀 + 格式提示', async () => {
    const wrapper = await mountInput()
    await addFiles(wrapper, [createMockFile('bad.gif', 'image/gif', 500)])

    expect(wrapper.find('.error-message').text())
      .toBe('bad.gif：不支持该照片格式，请选择 JPEG、PNG、WebP、BMP、TIFF 或 HEIC')
  })

  // 回归锚点：group.js L186 `${file.name}：已在选择列表中`
  it('重复文件：文件名前缀 + 去重提示', async () => {
    const wrapper = await mountInput()
    await addFiles(wrapper, [createMockFile('a.jpg', 'image/jpeg', 1000)])
    await addFiles(wrapper, [createMockFile('a.jpg', 'image/jpeg', 1000)])

    expect(wrapper.find('.error-message').text()).toBe('a.jpg：已在选择列表中')
  })

  // 回归锚点：group.js L180 无文件名前缀
  it('超出容量：无文件名前缀，含 max 插值', async () => {
    const wrapper = await mountInput()
    const ten = Array.from({ length: 10 }, (_, i) => createMockFile(`p${i}.jpg`, 'image/jpeg', 1000 + i))
    await addFiles(wrapper, ten)
    await addFiles(wrapper, [createMockFile('extra.jpg', 'image/jpeg', 9999)])

    expect(wrapper.find('.error-message').text()).toBe('最多只能选择 10 张照片')
    expect(wrapper.findAll('.group-preview-card')).toHaveLength(10)
  })

  // 回归锚点：group.js L201 errors.join('；')
  it('多条错误以「；」拼接', async () => {
    const wrapper = await mountInput()
    await addFiles(wrapper, [createMockFile('a.jpg', 'image/jpeg', 1000)])
    await addFiles(wrapper, [
      createMockFile('bad.gif', 'image/gif', 500),
      createMockFile('a.jpg', 'image/jpeg', 1000),
    ])

    expect(wrapper.find('.error-message').text())
      .toBe('bad.gif：不支持该照片格式，请选择 JPEG、PNG、WebP、BMP、TIFF 或 HEIC；a.jpg：已在选择列表中')
  })

  it('再次加文件时清除旧错误（group.js L169 hideError）', async () => {
    const wrapper = await mountInput()
    await addFiles(wrapper, [createMockFile('bad.gif', 'image/gif', 500)])
    expect(wrapper.find('.error-message').classes()).toContain('active')

    await addFiles(wrapper, [createMockFile('a.jpg', 'image/jpeg', 1000)])
    expect(wrapper.find('.error-message').classes()).not.toContain('active')
  })
})

// ── loading 锁定（group.js L1034-1042 setLoading）──

describe('loading 锁定', () => {
  it('loading=true：按钮文案切换 + 禁用 + aria-busy + 子组件禁用', async () => {
    const wrapper = await mountInput({ props: { variant: 'joint', loading: true } })

    const button = wrapper.find('.group-evaluate-button')
    expect(button.text()).toBe('联合评估中...')
    expect(button.attributes('disabled')).toBeDefined()
    expect(wrapper.find('.group-input-card').attributes('aria-busy')).toBe('true')

    // L1040-1042：门类下拉与逐图开关禁用
    expect(wrapper.find('select').attributes('disabled')).toBeDefined()
    expect(wrapper.find('input[type="checkbox"]').attributes('disabled')).toBeDefined()
    // L1042：清空按钮禁用（count>0 时 toolbar 才可见，此处验证 select 即可）
  })

  it('compare loading 文案为「对比评估中...」', async () => {
    const wrapper = await mountInput({ props: { variant: 'compare', loading: true } })
    expect(wrapper.find('.group-evaluate-button').text()).toBe('对比评估中...')
  })

  // 回归锚点：group.js L168 isLoading 守卫
  it('loading 时 onFiles 早退：不新增条目、不发射 selectionChange', async () => {
    const wrapper = await mountInput({ props: { variant: 'joint', loading: true } })
    await addFiles(wrapper, [createMockFile('a.jpg', 'image/jpeg', 1000)])

    expect(wrapper.findAll('.group-preview-card')).toHaveLength(0)
    expect(wrapper.emitted('selectionChange')).toBeUndefined()
  })
})

// ── 事件转发（group.js L1083-1087 invalidateResult）──

describe('事件转发', () => {
  it('门类变更透传 genreChange', async () => {
    const wrapper = await mountInput()
    await wrapper.find('select').setValue('portrait')

    expect(wrapper.emitted('genreChange')).toBeTruthy()
    expect(wrapper.emitted('genreChange')![0]).toEqual(['portrait'])
  })

  it('逐图明细切换透传 includePerImageChange', async () => {
    const wrapper = await mountInput()
    await wrapper.find('input[type="checkbox"]').setValue(true)

    expect(wrapper.emitted('includePerImageChange')).toBeTruthy()
    expect(wrapper.emitted('includePerImageChange')![0]).toEqual([true])
  })
})

// ── objectURL 生命周期回归 ──

describe('objectURL 生命周期', () => {
  it('移除照片时 revoke 对应 URL', async () => {
    const wrapper = await mountInput()
    await addFiles(wrapper, [
      createMockFile('a.jpg', 'image/jpeg', 1000),
      createMockFile('b.jpg', 'image/jpeg', 2000),
    ])
    expect(createObjectURLMock).toHaveBeenCalledTimes(2)

    await wrapper.find('.group-preview-card .preview-remove').trigger('click')
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1)
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-1')
  })

  it('清空时 revoke 全部 URL', async () => {
    const wrapper = await mountInput()
    await addFiles(wrapper, [
      createMockFile('a.jpg', 'image/jpeg', 1000),
      createMockFile('b.jpg', 'image/jpeg', 2000),
    ])

    await wrapper.find('.selection-toolbar .text-button').trigger('click')
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(2)
  })

  it('卸载时 onScopeDispose 兜底 revoke 全部残留 URL', async () => {
    const wrapper = await mountInput()
    await addFiles(wrapper, [
      createMockFile('a.jpg', 'image/jpeg', 1000),
      createMockFile('b.jpg', 'image/jpeg', 2000),
    ])
    expect(revokeObjectURLMock).not.toHaveBeenCalled()

    wrapper.unmount()
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(2)
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-1')
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-2')
  })
})
