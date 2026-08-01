import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MarkdownRender from 'markstream-vue'
import SummaryCard from '~/components/evaluation/SummaryCard.vue'

const seriesContent = '系列以水为线索，节奏从舒缓走向紧凑。'

describe('SummaryCard', () => {
  // ── 结构回归（锚点 group-joint.html L127-130）──

  it('渲染为 section.group-summary-card，包含 .card-heading 与 .editorial-copy', async () => {
    const wrapper = await mountSuspended(SummaryCard, {
      props: { content: seriesContent },
    })
    expect(wrapper.element.tagName).toBe('SECTION')
    expect(wrapper.classes()).toContain('group-summary-card')
    expect(wrapper.find('.card-heading').exists()).toBe(true)
    expect(wrapper.find('.editorial-copy').exists()).toBe(true)
  })

  it('series 变体携带 .series-summary class', async () => {
    const wrapper = await mountSuspended(SummaryCard, {
      props: { content: seriesContent },
    })
    expect(wrapper.classes()).toContain('series-summary')
  })

  // ── 眉标与标题（锚点 group-joint.html L128 / group-compare.html L147）──

  it('series 默认眉标 SERIES ANALYSIS、标题 系列整体分析', async () => {
    const wrapper = await mountSuspended(SummaryCard, {
      props: { content: seriesContent },
    })
    expect(wrapper.find('.card-heading span').text()).toBe('SERIES ANALYSIS')
    expect(wrapper.find('.card-heading h3').text()).toBe('系列整体分析')
  })

  it('comparison 变体派生眉标 COMPARISON SUMMARY、标题 对比总结', async () => {
    const wrapper = await mountSuspended(SummaryCard, {
      props: { content: '两张照片在光影处理上差异显著。', variant: 'comparison' },
    })
    expect(wrapper.classes()).toContain('comparison-summary')
    expect(wrapper.find('.card-heading span').text()).toBe('COMPARISON SUMMARY')
    expect(wrapper.find('.card-heading h3').text()).toBe('对比总结')
  })

  it('传入自定义 eyebrow/title 时覆盖 variant 默认值', async () => {
    const wrapper = await mountSuspended(SummaryCard, {
      props: { content: seriesContent, eyebrow: 'CUSTOM EYEBROW', title: '自定义标题' },
    })
    expect(wrapper.find('.card-heading span').text()).toBe('CUSTOM EYEBROW')
    expect(wrapper.find('.card-heading h3').text()).toBe('自定义标题')
  })

  // ── variant 排版 class（锚点 group.css L132-135）──

  it('comparison 变体的 .editorial-copy 携带 --comparison 修饰 class', async () => {
    const wrapper = await mountSuspended(SummaryCard, {
      props: { content: seriesContent, variant: 'comparison' },
    })
    expect(wrapper.find('.editorial-copy').classes()).toContain('editorial-copy--comparison')
  })

  it('series 变体的 .editorial-copy 无修饰 class', async () => {
    const wrapper = await mountSuspended(SummaryCard, {
      props: { content: seriesContent },
    })
    expect(wrapper.find('.editorial-copy').classes()).toEqual(['editorial-copy'])
  })

  // ── BaseMarkdown 集成 ──

  it('MarkdownRender 接收 content 与 final=true', async () => {
    const wrapper = await mountSuspended(SummaryCard, {
      props: { content: seriesContent },
    })
    const renderer = wrapper.findComponent(MarkdownRender)
    expect(renderer.exists()).toBe(true)
    expect(renderer.props('content')).toBe(seriesContent)
    expect(renderer.props('final')).toBe(true)
  })

  it('空 content 不实例化 MarkdownRender', async () => {
    const wrapper = await mountSuspended(SummaryCard)
    expect(wrapper.find('.editorial-copy').exists()).toBe(true)
    expect(wrapper.findComponent(MarkdownRender).exists()).toBe(false)
  })

  // ── attrs 透传（先例 CritiqueReport.spec.ts L122-130）──

  it('attrs 落根元素', async () => {
    const wrapper = await mountSuspended(SummaryCard, {
      props: { content: seriesContent },
      attrs: { id: 'summary-text', class: 'extra' },
    })
    expect(wrapper.attributes('id')).toBe('summary-text')
    expect(wrapper.classes()).toContain('extra')
    expect(wrapper.classes()).toContain('group-summary-card')
  })
})
