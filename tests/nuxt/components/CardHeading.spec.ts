import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import CardHeading from '~/components/ui/CardHeading.vue'

describe('CardHeading', () => {
  it('默认渲染为 div.card-heading，slot 内容进入 h3', async () => {
    const wrapper = await mountSuspended(CardHeading, {
      slots: { default: () => '系列整体分析' },
    })
    const root = wrapper.find('div')
    expect(root.exists()).toBe(true)
    expect(root.classes()).toEqual(['card-heading'])
    expect(wrapper.find('h3').text()).toBe('系列整体分析')
  })

  it('eyebrow prop 渲染为 span 且位于 h3 之前', async () => {
    const wrapper = await mountSuspended(CardHeading, {
      props: { eyebrow: 'SERIES ANALYSIS' },
      slots: { default: () => '系列整体分析' },
    })
    const span = wrapper.find('span')
    expect(span.text()).toBe('SERIES ANALYSIS')
    // 眉标在标题之前（venus 源结构：span + h3）
    const children = wrapper.find('.card-heading').element.children
    expect(children[0]?.tagName).toBe('SPAN')
    expect(children[1]?.tagName).toBe('H3')
  })

  // 眉标缺席时 span 不渲染，h3 亦不悬空 10px（span + h3 相邻选择器）
  it('未传 eyebrow 时不渲染 span', async () => {
    const wrapper = await mountSuspended(CardHeading, {
      slots: { default: () => '最终排名' },
    })
    expect(wrapper.find('span').exists()).toBe(false)
  })

  // 调用方 class 是既定的语义扩展点（如 compare-focus-heading），不得被内部 class 覆盖
  it('调用方 class 与内部 class 合并', async () => {
    const wrapper = await mountSuspended(CardHeading, {
      attrs: { class: 'compare-focus-heading' },
    })
    const classes = wrapper.find('div').classes()
    expect(classes).toContain('card-heading')
    expect(classes).toContain('compare-focus-heading')
  })

  it('属性透传至根元素', async () => {
    const wrapper = await mountSuspended(CardHeading, {
      attrs: { id: 'ranking-heading' },
    })
    expect(wrapper.find('div').attributes('id')).toBe('ranking-heading')
  })
})
