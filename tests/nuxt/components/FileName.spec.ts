import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import FileName from '~/components/ui/FileName.vue'

describe('FileName', () => {
  it('默认渲染为 span.file-name，主体与扩展名分列 stem/ext', async () => {
    const wrapper = await mountSuspended(FileName, {
      props: { name: 'contact-sheet-01.jpg' },
    })
    const root = wrapper.find('span')
    expect(root.classes()).toEqual(['file-name'])
    expect(wrapper.find('.file-stem').text()).toBe('contact-sheet-01')
    expect(wrapper.find('.file-ext').text()).toBe('.jpg')
  })

  it('无扩展名时不渲染 .file-ext', async () => {
    const wrapper = await mountSuspended(FileName, {
      props: { name: 'README' },
    })
    expect(wrapper.find('.file-stem').text()).toBe('README')
    expect(wrapper.find('.file-ext').exists()).toBe(false)
  })

  // §13.2：截断后完整文件名经可访问名称提供
  it('根元素 title 为完整文件名', async () => {
    const wrapper = await mountSuspended(FileName, {
      props: { name: 'contact-sheet-01.jpg' },
    })
    expect(wrapper.find('.file-name').attributes('title')).toBe('contact-sheet-01.jpg')
  })

  // 调用方 class 是既定的样式扩展点，不得被内部 class 覆盖
  it('调用方 class 与内部 class 合并', async () => {
    const wrapper = await mountSuspended(FileName, {
      props: { name: 'photo.jpg' },
      attrs: { class: 'ranking-source' },
    })
    const classes = wrapper.find('span').classes()
    expect(classes).toContain('file-name')
    expect(classes).toContain('ranking-source')
  })

  it('属性透传至根元素', async () => {
    const wrapper = await mountSuspended(FileName, {
      props: { name: 'photo.jpg' },
      attrs: { id: 'selected-frame-name' },
    })
    expect(wrapper.find('span').attributes('id')).toBe('selected-frame-name')
  })
})
