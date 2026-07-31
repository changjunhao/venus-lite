import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ModeCardGrid from '~/components/home/ModeCardGrid.vue'
import ModeCard from '~/components/home/ModeCard.vue'
import type { ModeCardItem } from '~/components/home/ModeCard.vue'

/** venus index.html L85-110 源三卡 */
const modes: ModeCardItem[] = [
  {
    label: 'SINGLE FRAME',
    title: '单图评估',
    description: '分析一张作品的构图、光影、主体、技术完成度与视觉影响力，给出完整裁决和可执行建议。',
    ctaLabel: '评估一张作品',
    to: '/single',
    layout: 'single',
    featured: true,
    visuals: [
      { src: '/assets/editorial/forest.jpg', width: 1000, height: 666 },
    ],
  },
  {
    label: 'SERIES REVIEW',
    title: '组图联合评估',
    description: '把 2–10 张照片作为一个系列，分析整体叙事、视觉一致性、节奏和系列完成度。',
    ctaLabel: '评估一个系列',
    to: '/group-joint',
    layout: 'series',
    visuals: [
      { src: '/assets/editorial/landscape.jpg', width: 1200, height: 1800 },
      { src: '/assets/editorial/forest.jpg', width: 1000, height: 666 },
      { src: '/assets/editorial/water.jpg', width: 1000, height: 667 },
    ],
  },
  {
    label: 'COMPARATIVE REVIEW',
    title: '组图对比评估',
    description: '在统一标准下比较 2–10 张照片，获得排序、分数、差异摘要及每个判断的依据。',
    ctaLabel: '比较一组照片',
    to: '/group-compare',
    layout: 'compare',
    visuals: [
      { src: '/assets/editorial/forest.jpg', width: 1000, height: 666 },
      { src: '/assets/editorial/water.jpg', width: 1000, height: 667 },
    ],
  },
]

const requiredProps = {
  title: '选择评估方式',
  modes,
}

const fullProps = {
  ...requiredProps,
  eyebrow: 'MODES',
  description: '从单张作品的细致分析，到系列叙事与横向比较，选择与你当前创作问题相符的评估方式。',
}

describe('ModeCardGrid', () => {
  it('渲染为 section.home-modes，aria-labelledby 指向章节标题', async () => {
    const wrapper = await mountSuspended(ModeCardGrid, { props: fullProps })
    const root = wrapper.find('section')
    expect(root.exists()).toBe(true)
    expect(root.classes()).toContain('home-modes')
    // useId() 生成值不可预期，故断言指向关系而非字面量
    const titleId = wrapper.find('h2').attributes('id')
    expect(titleId).toBeTruthy()
    expect(root.attributes('aria-labelledby')).toBe(titleId)
  })

  it('标题区渲染眉标 / h2 / 说明', async () => {
    const wrapper = await mountSuspended(ModeCardGrid, { props: fullProps })
    expect(wrapper.find('.section-index').text()).toBe(fullProps.eyebrow)
    expect(wrapper.find('h2').text()).toBe(fullProps.title)
    expect(wrapper.find('.home-section-heading > p').text()).toBe(fullProps.description)
  })

  it('可选文案缺席时对应节点不渲染', async () => {
    const wrapper = await mountSuspended(ModeCardGrid, { props: requiredProps })
    expect(wrapper.find('.section-index').exists()).toBe(false)
    expect(wrapper.find('.home-section-heading > p').exists()).toBe(false)
  })

  it('modes 按序渲染为 ModeCard', async () => {
    const wrapper = await mountSuspended(ModeCardGrid, { props: fullProps })
    expect(wrapper.findAll('.home-mode-grid > .home-mode-card')).toHaveLength(3)
    expect(wrapper.findAllComponents(ModeCard)).toHaveLength(modes.length)
  })

  it('编号按序补零派生', async () => {
    const wrapper = await mountSuspended(ModeCardGrid, { props: fullProps })
    expect(wrapper.findAllComponents(ModeCard).map(card => card.props('number')))
      .toEqual(['01', '02', '03'])
  })

  it('featured 按数据透传而非按顺序派生', async () => {
    const wrapper = await mountSuspended(ModeCardGrid, {
      props: {
        ...fullProps,
        // 推荐位移到第二张：featured 是语义，不随顺序变化
        modes: modes.map((mode, index) => ({ ...mode, featured: index === 1 })),
      },
    })
    const cards = wrapper.findAll('.home-mode-card')
    expect(cards[0]?.classes()).not.toContain('home-mode-featured')
    expect(cards[1]?.classes()).toContain('home-mode-featured')
    expect(cards[2]?.classes()).not.toContain('home-mode-featured')
  })

  it('每张 ModeCard 收到透传 props', async () => {
    const wrapper = await mountSuspended(ModeCardGrid, { props: fullProps })
    wrapper.findAllComponents(ModeCard).forEach((card, index) => {
      const mode = modes[index]
      expect(card.props('label')).toBe(mode?.label)
      expect(card.props('title')).toBe(mode?.title)
      expect(card.props('description')).toBe(mode?.description)
      expect(card.props('ctaLabel')).toBe(mode?.ctaLabel)
      expect(card.props('to')).toBe(mode?.to)
      expect(card.props('layout')).toBe(mode?.layout)
      expect(card.props('visuals')).toEqual(mode?.visuals)
    })
  })

  // 调用方 class 是既定的语义扩展点，不得被内部 class 覆盖
  it('调用方 class 与内部 class 合并', async () => {
    const wrapper = await mountSuspended(ModeCardGrid, {
      props: requiredProps,
      attrs: { class: 'home-section' },
    })
    const classes = wrapper.find('section').classes()
    expect(classes).toContain('home-modes')
    expect(classes).toContain('home-section')
  })

  // 锚点 id 归页面信息架构，经 attrs 透传而非组件内硬编码
  it('属性透传至根元素', async () => {
    const wrapper = await mountSuspended(ModeCardGrid, {
      props: requiredProps,
      attrs: { id: 'modes' },
    })
    expect(wrapper.find('section').attributes('id')).toBe('modes')
  })
})
