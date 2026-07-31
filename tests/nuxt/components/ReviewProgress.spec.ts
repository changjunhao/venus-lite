import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ReviewProgress from '~/components/evaluation/ReviewProgress.vue'
import type { ReasoningBlock, StreamStepItem } from '#shared/types/evaluation'

describe('ReviewProgress', () => {
  const steps: StreamStepItem[] = [
    { agent: 'genreDetector', label: '门类识别', status: 'done' },
    { agent: 'proposer', label: '提案者初评', status: 'active' },
    { agent: 'critic', label: '批判者质疑', status: 'pending' },
    { agent: 'arbiter', label: '仲裁者裁决', status: 'pending' },
  ]

  const blocks: ReasoningBlock[] = [
    { agent: 'proposer', label: '提案者初评', content: '正在分析构图与光线', final: false },
  ]

  const baseProps = {
    active: true,
    text: '提案者初评中',
    subtext: '逐项评估构图、光影、主体与技术完成度',
    steps,
    blocks,
  }

  // ── 可见性（回归锚点：app.js L862 .toggle('active', loading)）──

  it('active=false 时不渲染', async () => {
    const wrapper = await mountSuspended(ReviewProgress, {
      props: { ...baseProps, active: false },
    })
    expect(wrapper.find('.review-progress').exists()).toBe(false)
  })

  // 回归锚点：single.html L106-120 #loading-section 结构
  it('active=true 时渲染根 section + progress-marker + 文案区', async () => {
    const wrapper = await mountSuspended(ReviewProgress, { props: baseProps })
    const root = wrapper.find('.review-progress')
    expect(root.exists()).toBe(true)
    expect(root.element.tagName).toBe('SECTION')
    expect(wrapper.find('.progress-marker').exists()).toBe(true)
    expect(wrapper.find('.review-progress-copy').exists()).toBe(true)
  })

  // ── 文案（回归锚点：app.js L888-896 setLoadingText）──

  it('主文案渲染于 .loading-text', async () => {
    const wrapper = await mountSuspended(ReviewProgress, { props: baseProps })
    expect(wrapper.find('.loading-text').text()).toBe('提案者初评中')
  })

  it('subtext 非空时渲染 .loading-subtext', async () => {
    const wrapper = await mountSuspended(ReviewProgress, { props: baseProps })
    expect(wrapper.find('.loading-subtext').text()).toBe('逐项评估构图、光影、主体与技术完成度')
  })

  // 回归锚点：app.js L894 loadingSubtext.hidden = subtext === ''
  it('subtext 未传时不渲染 .loading-subtext', async () => {
    const wrapper = await mountSuspended(ReviewProgress, {
      props: { ...baseProps, subtext: undefined },
    })
    expect(wrapper.find('.loading-subtext').exists()).toBe(false)
  })

  // ── 无障碍 ──

  // §14.5：aria-live 仅在文案区（与 single.html L108 一致）
  it('aria-live="polite" 仅在 .review-progress-copy 上', async () => {
    const wrapper = await mountSuspended(ReviewProgress, { props: baseProps })
    expect(wrapper.find('.review-progress-copy').attributes('aria-live')).toBe('polite')
    expect(wrapper.find('.review-progress').attributes('aria-live')).toBeUndefined()
    // 推理区不参与播报
    expect(wrapper.find('.stream-thinking').attributes('aria-live')).toBeUndefined()
  })

  // §14.4：装饰性旋转环对辅助技术隐藏
  it('progress-marker 有 aria-hidden="true"', async () => {
    const wrapper = await mountSuspended(ReviewProgress, { props: baseProps })
    expect(wrapper.find('.progress-marker').attributes('aria-hidden')).toBe('true')
  })

  // ── indexLabel ──

  it('indexLabel 默认为 REVIEW IN PROGRESS', async () => {
    const wrapper = await mountSuspended(ReviewProgress, { props: baseProps })
    expect(wrapper.find('.section-index').text()).toBe('REVIEW IN PROGRESS')
  })

  it('自定义 indexLabel 渲染', async () => {
    const wrapper = await mountSuspended(ReviewProgress, {
      props: { ...baseProps, indexLabel: 'SERIES REVIEW' },
    })
    expect(wrapper.find('.section-index').text()).toBe('SERIES REVIEW')
  })

  // ── 子组件组合（component-plan L113：StreamSteps + StreamReasoning）──

  it('步骤轨道收到 steps 并渲染步骤文本', async () => {
    const wrapper = await mountSuspended(ReviewProgress, { props: baseProps })
    const items = wrapper.findAll('.stream-step')
    expect(items).toHaveLength(4)
    expect(items[0]!.text()).toBe('门类识别')
    expect(items[1]!.classes()).toContain('active')
  })

  it('推理区收到 blocks 并渲染块标题', async () => {
    const wrapper = await mountSuspended(ReviewProgress, { props: baseProps })
    expect(wrapper.find('.stream-think-agent').text()).toBe('提案者初评过程')
  })

  // ── 透传 ──

  it('属性透传至根元素', async () => {
    const wrapper = await mountSuspended(ReviewProgress, {
      props: baseProps,
      attrs: { id: 'loading-section' },
    })
    expect(wrapper.find('.review-progress').attributes('id')).toBe('loading-section')
  })
})
