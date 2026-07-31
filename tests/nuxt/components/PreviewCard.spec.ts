import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { ImageEntry } from '~/composables/useImageSelection'
import PreviewCard from '~/components/upload/PreviewCard.vue'

function createEntry(overrides: Partial<ImageEntry> = {}): ImageEntry {
  const file = new File([new ArrayBuffer(1024)], 'sunset-beach.jpg', { type: 'image/jpeg', lastModified: 1000 })
  return {
    id: 'image-1',
    identity: 'sunset-beach.jpg:1024:1000',
    file,
    objectURL: 'blob:mock-1',
    width: 3840,
    height: 2160,
    ...overrides,
  }
}

const baseProps = {
  entry: createEntry(),
  index: 1,
  count: 3,
  alt: '第 2 张照片：sunset-beach.jpg',
  removeLabel: '移除第 2 张照片',
  moveBackLabel: '将第 2 张照片前移',
  moveForwardLabel: '将第 2 张照片后移',
  moveBackText: '前移',
  moveForwardText: '后移',
}

describe('PreviewCard', () => {
  it('默认渲染：article.group-preview-card + preview-media + preview-meta 结构', async () => {
    const wrapper = await mountSuspended(PreviewCard, { props: baseProps })
    const card = wrapper.find('article.group-preview-card')
    expect(card.exists()).toBe(true)
    expect(wrapper.find('.preview-media').exists()).toBe(true)
    expect(wrapper.find('.preview-meta').exists()).toBe(true)
    expect(wrapper.find('.preview-actions').exists()).toBe(true)
  })

  // 回归锚点：group.js L258 String(index + 1).padStart(2, '0')
  it('编号补零：index=0 渲染 "01"', async () => {
    const wrapper = await mountSuspended(PreviewCard, {
      props: { ...baseProps, index: 0 },
    })
    expect(wrapper.find('.preview-number').text()).toBe('01')
  })

  it('编号不补零：index=9 渲染 "10"', async () => {
    const wrapper = await mountSuspended(PreviewCard, {
      props: { ...baseProps, index: 9, count: 10 },
    })
    expect(wrapper.find('.preview-number').text()).toBe('10')
  })

  it('preview-number 标记 aria-hidden（编号为视觉索引，语义由 alt/aria-label 承载）', async () => {
    const wrapper = await mountSuspended(PreviewCard, { props: baseProps })
    expect(wrapper.find('.preview-number').attributes('aria-hidden')).toBe('true')
  })

  it('img 渲染 objectURL + alt + 尺寸属性 + decoding="async"', async () => {
    const wrapper = await mountSuspended(PreviewCard, { props: baseProps })
    const img = wrapper.find('.preview-media img')
    expect(img.attributes('src')).toBe('blob:mock-1')
    expect(img.attributes('alt')).toBe('第 2 张照片：sunset-beach.jpg')
    expect(img.attributes('width')).toBe('3840')
    expect(img.attributes('height')).toBe('2160')
    expect(img.attributes('decoding')).toBe('async')
  })

  // 回归锚点：group.js L261-268 移除按钮
  it('移除按钮：aria-label + 点击 emit remove', async () => {
    const wrapper = await mountSuspended(PreviewCard, { props: baseProps })
    const button = wrapper.find('.preview-remove')
    expect(button.attributes('aria-label')).toBe('移除第 2 张照片')
    expect(button.attributes('type')).toBe('button')

    await button.trigger('click')
    expect(wrapper.emitted('remove')).toHaveLength(1)
  })

  // 回归锚点：group.js L276 `${w}×${h} · ${formatFileSize(size)}`
  it('信息行格式：宽×高 · 体积', async () => {
    const wrapper = await mountSuspended(PreviewCard, { props: baseProps })
    expect(wrapper.find('.info').text()).toBe('3840×2160 · 1.0 KB')
  })

  it('UiFileName 渲染文件名截断结构 + title 完整名', async () => {
    const wrapper = await mountSuspended(PreviewCard, { props: baseProps })
    const fileName = wrapper.find('.preview-meta strong .file-name')
    expect(fileName.exists()).toBe(true)
    expect(fileName.attributes('title')).toBe('sunset-beach.jpg')
    expect(wrapper.find('.file-stem').text()).toBe('sunset-beach')
    expect(wrapper.find('.file-ext').text()).toBe('.jpg')
  })

  // 回归锚点：group.js L283 index === 0 禁用前移
  it('前移按钮：index=0 时 disabled', async () => {
    const wrapper = await mountSuspended(PreviewCard, {
      props: { ...baseProps, index: 0 },
    })
    const back = wrapper.find('[data-move="back"]')
    expect(back.attributes('disabled')).toBeDefined()
  })

  // 回归锚点：group.js L290 index === length - 1 禁用后移
  it('后移按钮：index=count-1 时 disabled', async () => {
    const wrapper = await mountSuspended(PreviewCard, {
      props: { ...baseProps, index: 2 },
    })
    const forward = wrapper.find('[data-move="forward"]')
    expect(forward.attributes('disabled')).toBeDefined()
  })

  it('中间位置：前移/后移按钮均可用，点击 emit move 含方向', async () => {
    const wrapper = await mountSuspended(PreviewCard, { props: baseProps })
    const back = wrapper.find('[data-move="back"]')
    const forward = wrapper.find('[data-move="forward"]')
    expect(back.attributes('disabled')).toBeUndefined()
    expect(forward.attributes('disabled')).toBeUndefined()

    await back.trigger('click')
    expect(wrapper.emitted('move')?.[0]).toEqual([-1])

    await forward.trigger('click')
    expect(wrapper.emitted('move')?.[1]).toEqual([1])
  })

  it('移动按钮渲染调用方传入的可见文案与 aria-label', async () => {
    const wrapper = await mountSuspended(PreviewCard, { props: baseProps })
    const back = wrapper.find('[data-move="back"]')
    expect(back.text()).toBe('前移')
    expect(back.attributes('aria-label')).toBe('将第 2 张照片前移')

    const forward = wrapper.find('[data-move="forward"]')
    expect(forward.text()).toBe('后移')
    expect(forward.attributes('aria-label')).toBe('将第 2 张照片后移')
  })

  // 回归锚点：group.js L266/L283/L290 state.isLoading 全禁用
  it('disabled=true：移除/前移/后移按钮全禁用且点击不 emit', async () => {
    const wrapper = await mountSuspended(PreviewCard, {
      props: { ...baseProps, disabled: true },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(3)
    for (const button of buttons) {
      expect(button.attributes('disabled')).toBeDefined()
    }

    await wrapper.find('.preview-remove').trigger('click')
    await wrapper.find('[data-move="back"]').trigger('click')
    expect(wrapper.emitted('remove')).toBeUndefined()
    expect(wrapper.emitted('move')).toBeUndefined()
  })

  it('属性透传至根 article', async () => {
    const wrapper = await mountSuspended(PreviewCard, {
      props: baseProps,
      attrs: { 'data-testid': 'preview-card' },
    })
    expect(wrapper.find('article').attributes('data-testid')).toBe('preview-card')
  })
})
