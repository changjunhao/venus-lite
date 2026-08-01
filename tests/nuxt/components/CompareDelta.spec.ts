import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import CompareDelta from '~/components/evaluation/CompareDelta.vue'

describe('CompareDelta', () => {
  // ── 结构回归（锚点 group.js L782-795）──

  it('渲染为 div.compare-focus-delta，包含 heading / bars / footnote 三段', async () => {
    const wrapper = await mountSuspended(CompareDelta, {
      props: { leftScore: 8.5, rightScore: 7.0 },
    })
    expect(wrapper.element.tagName).toBe('DIV')
    expect(wrapper.classes()).toContain('compare-focus-delta')
    expect(wrapper.find('.compare-delta-heading').exists()).toBe(true)
    expect(wrapper.find('.compare-score-bars').exists()).toBe(true)
    expect(wrapper.find('p').exists()).toBe(true)
  })

  // ── 差值格式（锚点 group.js L781/L787）──

  it('正差值显示 +X.X', async () => {
    const wrapper = await mountSuspended(CompareDelta, {
      props: { leftScore: 8.5, rightScore: 8.0 },
    })
    expect(wrapper.find('.compare-delta-heading strong').text()).toBe('+0.5')
  })

  it('负差值显示 -X.X', async () => {
    const wrapper = await mountSuspended(CompareDelta, {
      props: { leftScore: 7.0, rightScore: 7.5 },
    })
    expect(wrapper.find('.compare-delta-heading strong').text()).toBe('-0.5')
  })

  it('零差值显示 +0.0', async () => {
    const wrapper = await mountSuspended(CompareDelta, {
      props: { leftScore: 7.5, rightScore: 7.5 },
    })
    expect(wrapper.find('.compare-delta-heading strong').text()).toBe('+0.0')
  })

  // ── NaN 防御（锚点 ScorePanel L36-39 健壮版，修正源 L779-781 无防御）──

  it('score 为 NaN 时防御为 0：差值 +0.0、条宽 0%', async () => {
    const wrapper = await mountSuspended(CompareDelta, {
      props: { leftScore: Number.NaN, rightScore: Number.NaN },
    })
    expect(wrapper.find('.compare-delta-heading strong').text()).toBe('+0.0')
    const bars = wrapper.findAll('.compare-score-bars b')
    expect(bars[0]!.attributes('style')).toContain('width: 0%')
    expect(bars[1]!.attributes('style')).toContain('width: 0%')
  })

  // ── 条宽 clamp（锚点 group.js L790-791）──

  it('条宽为 clamp(0,10) × 10%', async () => {
    const wrapper = await mountSuspended(CompareDelta, {
      props: { leftScore: 8.5, rightScore: 6.0 },
    })
    const bars = wrapper.findAll('.compare-score-bars b')
    expect(bars[0]!.attributes('style')).toContain('width: 85%')
    expect(bars[1]!.attributes('style')).toContain('width: 60%')
  })

  it('score 超出 0-10 时条宽被 clamp', async () => {
    const wrapper = await mountSuspended(CompareDelta, {
      props: { leftScore: 12, rightScore: -1 },
    })
    const bars = wrapper.findAll('.compare-score-bars b')
    expect(bars[0]!.attributes('style')).toContain('width: 100%')
    expect(bars[1]!.attributes('style')).toContain('width: 0%')
  })

  // ── 标签与文案（锚点 group.js L786/L789-793）──

  it('默认文案：标题 / aria-label / 条标签 / 脚注', async () => {
    const wrapper = await mountSuspended(CompareDelta, {
      props: { leftScore: 8.0, rightScore: 7.5 },
    })
    expect(wrapper.find('.compare-delta-heading span').text()).toBe('综合评分差值')
    expect(wrapper.find('.compare-score-bars').attributes('aria-label')).toBe('两张照片综合评分对比')
    const labels = wrapper.findAll('.compare-score-bars > div > span')
    expect(labels[0]!.text()).toBe('左侧 8.0')
    expect(labels[1]!.text()).toBe('右侧 7.5')
    expect(wrapper.find('p').text()).toContain('差异来源请结合两侧')
  })

  it('模板插值 {score} 生效', async () => {
    const wrapper = await mountSuspended(CompareDelta, {
      props: {
        leftScore: 8.0,
        rightScore: 7.5,
        leftBarTemplate: 'Left {score}',
        rightBarTemplate: 'Right {score}',
      },
    })
    const labels = wrapper.findAll('.compare-score-bars > div > span')
    expect(labels[0]!.text()).toBe('Left 8.0')
    expect(labels[1]!.text()).toBe('Right 7.5')
  })

  it('自定义文案 props 生效', async () => {
    const wrapper = await mountSuspended(CompareDelta, {
      props: {
        leftScore: 8.0,
        rightScore: 7.5,
        headingLabel: 'Score gap',
        barsAriaLabel: 'Score bars',
        footnote: 'Custom footnote.',
      },
    })
    expect(wrapper.find('.compare-delta-heading span').text()).toBe('Score gap')
    expect(wrapper.find('.compare-score-bars').attributes('aria-label')).toBe('Score bars')
    expect(wrapper.find('p').text()).toBe('Custom footnote.')
  })

  // ── attrs 透传（先例 RankingCard.spec.ts L171-179）──

  it('attrs 落根元素', async () => {
    const wrapper = await mountSuspended(CompareDelta, {
      props: { leftScore: 8.0, rightScore: 7.5 },
      attrs: { id: 'delta-1', class: 'extra' },
    })
    expect(wrapper.attributes('id')).toBe('delta-1')
    expect(wrapper.classes()).toContain('extra')
    expect(wrapper.classes()).toContain('compare-focus-delta')
  })
})
