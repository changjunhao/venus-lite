import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BaseCard from '~/components/ui/BaseCard.vue'

describe('BaseCard', () => {
  it('默认渲染为 panel 变体的 section', async () => {
    const wrapper = await mountSuspended(BaseCard)
    const card = wrapper.find('section')
    expect(card.exists()).toBe(true)
    expect(card.classes()).toEqual(['card', 'card-panel'])
  })

  it.each(['article', 'div', 'aside'] as const)('as=%s 渲染为对应标签', async (as) => {
    const wrapper = await mountSuspended(BaseCard, { props: { as } })
    const card = wrapper.find(as)
    expect(card.exists()).toBe(true)
    expect(card.classes()).toContain('card-panel')
  })

  it('plain 变体只保留结构类，不挂面板表面', async () => {
    const wrapper = await mountSuspended(BaseCard, { props: { variant: 'plain' } })
    const classes = wrapper.find('section').classes()
    expect(classes).toContain('card')
    expect(classes).not.toContain('card-panel')
  })

  it('slot 内容透传', async () => {
    const wrapper = await mountSuspended(BaseCard, {
      slots: { default: () => '系列整体分析' },
    })
    expect(wrapper.text()).toBe('系列整体分析')
  })

  // 调用方 class 是既定的样式扩展点（如系列摘要卡补 amber 左边线），不得被内部 class 覆盖
  it('调用方 class 与内部 class 合并', async () => {
    const wrapper = await mountSuspended(BaseCard, {
      attrs: { class: 'summary-card' },
    })
    const classes = wrapper.find('section').classes()
    expect(classes).toContain('card')
    expect(classes).toContain('card-panel')
    expect(classes).toContain('summary-card')
  })

  it('属性透传至根元素，可挂可访问名', async () => {
    const wrapper = await mountSuspended(BaseCard, {
      attrs: { 'aria-labelledby': 'result-heading' },
    })
    expect(wrapper.find('section').attributes('aria-labelledby')).toBe('result-heading')
  })
})
