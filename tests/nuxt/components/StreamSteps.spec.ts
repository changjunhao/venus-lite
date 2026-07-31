import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import StreamSteps from '~/components/evaluation/StreamSteps.vue'
import type { StreamStepItem } from '#shared/types/evaluation'

describe('StreamSteps', () => {
  // 回归锚点：single.html L113-118 四固定步
  const fourSteps: StreamStepItem[] = [
    { agent: 'genreDetector', label: '门类识别', status: 'pending' },
    { agent: 'proposer', label: '提案者初评', status: 'pending' },
    { agent: 'critic', label: '批判者质疑', status: 'pending' },
    { agent: 'arbiter', label: '仲裁者裁决', status: 'pending' },
  ]

  // ── 渲染 ──

  it('渲染有序列表 <ol>，步骤数量与标签正确', async () => {
    const wrapper = await mountSuspended(StreamSteps, { props: { steps: fourSteps } })
    expect(wrapper.element.tagName).toBe('OL')
    expect(wrapper.classes()).toContain('stream-steps')

    const items = wrapper.findAll('li')
    expect(items).toHaveLength(4)
    expect(items[0]!.text()).toBe('门类识别')
    expect(items[3]!.text()).toBe('仲裁者裁决')
  })

  // 回归锚点：app.js L503-511 data-agent 用于步骤匹配
  it('每个步骤携带 data-agent 属性', async () => {
    const wrapper = await mountSuspended(StreamSteps, { props: { steps: fourSteps } })
    const items = wrapper.findAll('li')
    expect(items[0]!.attributes('data-agent')).toBe('genreDetector')
    expect(items[1]!.attributes('data-agent')).toBe('proposer')
    expect(items[2]!.attributes('data-agent')).toBe('critic')
    expect(items[3]!.attributes('data-agent')).toBe('arbiter')
  })

  // ── 状态 class 映射（回归锚点：app.js L507-511）──

  it('pending 状态无额外 class', async () => {
    const wrapper = await mountSuspended(StreamSteps, { props: { steps: fourSteps } })
    const item = wrapper.find('[data-agent="genreDetector"]')
    expect(item.classes()).not.toContain('active')
    expect(item.classes()).not.toContain('done')
  })

  it('active 状态渲染 .active class', async () => {
    const steps: StreamStepItem[] = [
      { agent: 'genreDetector', label: '门类识别', status: 'done' },
      { agent: 'proposer', label: '提案者初评', status: 'active' },
      { agent: 'critic', label: '批判者质疑', status: 'pending' },
      { agent: 'arbiter', label: '仲裁者裁决', status: 'pending' },
    ]
    const wrapper = await mountSuspended(StreamSteps, { props: { steps } })
    expect(wrapper.find('[data-agent="proposer"]').classes()).toContain('active')
    expect(wrapper.find('[data-agent="genreDetector"]').classes()).toContain('done')
    expect(wrapper.find('[data-agent="critic"]').classes()).not.toContain('active')
  })

  // 回归锚点：app.js L466-470 evaluation_complete → 全部 done
  it('全完成态：所有步骤渲染 .done', async () => {
    const steps: StreamStepItem[] = fourSteps.map(s => ({ ...s, status: 'done' as const }))
    const wrapper = await mountSuspended(StreamSteps, { props: { steps } })
    for (const item of wrapper.findAll('li')) {
      expect(item.classes()).toContain('done')
      expect(item.classes()).not.toContain('active')
    }
  })

  // ── 条件步骤（回归锚点：app.js L487-495 ensureRevisionStep）──

  it('proposer-revision 条件步骤出现时渲染于 arbiter 之前', async () => {
    const steps: StreamStepItem[] = [
      { agent: 'genreDetector', label: '门类识别', status: 'done' },
      { agent: 'proposer', label: '提案者初评', status: 'done' },
      { agent: 'critic', label: '批判者质疑', status: 'done' },
      { agent: 'proposer-revision', label: '提案者修正', status: 'active' },
      { agent: 'arbiter', label: '仲裁者裁决', status: 'pending' },
    ]
    const wrapper = await mountSuspended(StreamSteps, { props: { steps } })
    const items = wrapper.findAll('li')
    expect(items).toHaveLength(5)
    expect(items[3]!.attributes('data-agent')).toBe('proposer-revision')
    expect(items[3]!.text()).toBe('提案者修正')
    expect(items[4]!.attributes('data-agent')).toBe('arbiter')
  })

  // ── 边界 ──

  it('空数组渲染空列表', async () => {
    const wrapper = await mountSuspended(StreamSteps, { props: { steps: [] } })
    expect(wrapper.find('ol').exists()).toBe(true)
    expect(wrapper.findAll('li')).toHaveLength(0)
  })

  it('属性透传至根元素', async () => {
    const wrapper = await mountSuspended(StreamSteps, {
      props: { steps: fourSteps },
      attrs: { 'data-testid': 'stream-steps' },
    })
    expect(wrapper.attributes('data-testid')).toBe('stream-steps')
  })
})
