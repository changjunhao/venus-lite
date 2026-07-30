import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BaseSectionIndex from '~/components/ui/BaseSectionIndex.vue'

describe('BaseSectionIndex', () => {
  it('默认渲染为 span.section-index', async () => {
    const wrapper = await mountSuspended(BaseSectionIndex, {
      slots: { default: () => 'INPUT' },
    })
    const index = wrapper.find('span')
    expect(index.exists()).toBe(true)
    expect(index.classes()).toEqual(['section-index'])
  })

  it('slot 内容透传', async () => {
    const wrapper = await mountSuspended(BaseSectionIndex, {
      slots: { default: () => 'RESULT' },
    })
    expect(wrapper.text()).toBe('RESULT')
  })

  // 调用方 class 是既定的语义扩展点（如首页追加 home-section-index），不得被内部 class 覆盖
  it('调用方 class 与内部 class 合并', async () => {
    const wrapper = await mountSuspended(BaseSectionIndex, {
      attrs: { class: 'home-section-index' },
    })
    const classes = wrapper.find('span').classes()
    expect(classes).toContain('section-index')
    expect(classes).toContain('home-section-index')
  })

  it('属性透传至根元素', async () => {
    const wrapper = await mountSuspended(BaseSectionIndex, {
      attrs: { id: 'result-index' },
    })
    expect(wrapper.find('span').attributes('id')).toBe('result-index')
  })
})
