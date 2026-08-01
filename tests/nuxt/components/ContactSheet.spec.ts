import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ContactSheet from '~/components/evaluation/ContactSheet.vue'
import type { ImageEntry } from '~/composables/useImageSelection'

/** 构造 ImageEntry 形状 mock（objectURL 以 blob: 占位） */
function createEntry(index: number, width = 1200, height = 800): ImageEntry {
  return {
    id: `entry-${index}`,
    identity: `photo-${index}.jpg:1024:1722400000000`,
    file: new File([], `photo-${index}.jpg`, { type: 'image/jpeg' }),
    objectURL: `blob:mock-${index}`,
    width,
    height,
  }
}

const entries = [createEntry(1), createEntry(2), createEntry(3, 900, 1600)]

const requiredProps = {
  entries,
  altTemplate: '系列中的第 {index} 张照片',
  ariaLabel: '系列照片接触印样',
}

describe('ContactSheet', () => {
  it('渲染为 div.result-contact-sheet，aria-label 正确', async () => {
    const wrapper = await mountSuspended(ContactSheet, {
      props: requiredProps,
    })
    const root = wrapper.find('div.result-contact-sheet')
    expect(root.exists()).toBe(true)
    expect(root.attributes('aria-label')).toBe('系列照片接触印样')
  })

  it('entries 按序渲染为 figure.result-contact-frame，img src 逐项对应', async () => {
    const wrapper = await mountSuspended(ContactSheet, {
      props: requiredProps,
    })
    const figures = wrapper.findAll('figure.result-contact-frame')
    expect(figures).toHaveLength(3)
    figures.forEach((figure, index) => {
      const img = figure.find('img')
      expect(img.attributes('src')).toBe(`blob:mock-${index + 1}`)
    })
  })

  it('img 绑定 width/height 原生属性（CLS 防护）', async () => {
    const wrapper = await mountSuspended(ContactSheet, {
      props: requiredProps,
    })
    const images = wrapper.findAll('img')
    expect(images[0]?.attributes('width')).toBe('1200')
    expect(images[0]?.attributes('height')).toBe('800')
    expect(images[2]?.attributes('width')).toBe('900')
    expect(images[2]?.attributes('height')).toBe('1600')
  })

  it('FRAME 编号按序补零生成', async () => {
    const wrapper = await mountSuspended(ContactSheet, {
      props: requiredProps,
    })
    const captions = wrapper.findAll('figcaption')
    expect(captions.map(caption => caption.text()))
      .toEqual(['FRAME 01', 'FRAME 02', 'FRAME 03'])
  })

  it('alt 模板 {index} 插值为 1-based 序号', async () => {
    const wrapper = await mountSuspended(ContactSheet, {
      props: requiredProps,
    })
    const images = wrapper.findAll('img')
    expect(images.map(img => img.attributes('alt')))
      .toEqual(['系列中的第 1 张照片', '系列中的第 2 张照片', '系列中的第 3 张照片'])
  })

  it('空 entries 时根元素渲染但无 figure（隐藏归 Flow）', async () => {
    const wrapper = await mountSuspended(ContactSheet, {
      props: { ...requiredProps, entries: [] },
    })
    expect(wrapper.find('div.result-contact-sheet').exists()).toBe(true)
    expect(wrapper.findAll('figure')).toHaveLength(0)
  })

  // 调用方 class 是既定的语义扩展点，不得被内部 class 覆盖
  it('调用方 class 与内部 class 合并', async () => {
    const wrapper = await mountSuspended(ContactSheet, {
      props: requiredProps,
      attrs: { class: 'joint-sheet' },
    })
    const classes = wrapper.find('div').classes()
    expect(classes).toContain('result-contact-sheet')
    expect(classes).toContain('joint-sheet')
  })

  it('属性透传至根元素', async () => {
    const wrapper = await mountSuspended(ContactSheet, {
      props: requiredProps,
      attrs: { id: 'result-contact-sheet' },
    })
    expect(wrapper.find('div').attributes('id')).toBe('result-contact-sheet')
  })
})
