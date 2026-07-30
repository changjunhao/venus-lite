import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BaseBadge from '~/components/ui/BaseBadge.vue'

describe('BaseBadge', () => {
  it('默认渲染为 step-score 变体的 span', async () => {
    const wrapper = await mountSuspended(BaseBadge, {
      slots: { default: () => '评分：8.5' },
    })
    const badge = wrapper.find('span')
    expect(badge.exists()).toBe(true)
    expect(badge.classes()).toEqual(['step-score'])
  })

  it.each([
    ['step-score', ['step-score']],
    ['step-tag', ['step-tag']],
    ['severity-high', ['severity-tag', 'severity-high']],
    ['severity-medium', ['severity-tag', 'severity-medium']],
    ['severity-low', ['severity-tag', 'severity-low']],
  ] as const)('变体 %s 映射为 class %j', async (variant, expected) => {
    const wrapper = await mountSuspended(BaseBadge, { props: { variant } })
    expect(wrapper.find('span').classes()).toEqual(expected)
  })

  it('slot 内容透传', async () => {
    const wrapper = await mountSuspended(BaseBadge, {
      slots: { default: () => '质疑程度：高' },
    })
    expect(wrapper.text()).toBe('质疑程度：高')
  })

  // 调用方 class 是既定的样式扩展点，不得被内部 class 覆盖
  it('调用方 class 与内部 class 合并', async () => {
    const wrapper = await mountSuspended(BaseBadge, {
      props: { variant: 'step-tag' },
      attrs: { class: 'scene-tag' },
    })
    const classes = wrapper.find('span').classes()
    expect(classes).toContain('step-tag')
    expect(classes).toContain('scene-tag')
  })

  it('属性透传至根元素，可挂可访问名', async () => {
    const wrapper = await mountSuspended(BaseBadge, {
      attrs: { 'aria-label': '提案者评分 8.5' },
    })
    expect(wrapper.find('span').attributes('aria-label')).toBe('提案者评分 8.5')
  })
})
