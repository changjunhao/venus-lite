import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ProcessTimeline from '~/components/evaluation/ProcessTimeline.vue'
import type { GenreMetadata, ProcessStepItem } from '#shared/types/evaluation'

// 回归锚点：app.js L663-766 renderProcess 四步编排（revision 为条件步骤）
const proposal: ProcessStepItem = {
  kind: 'proposal',
  title: '提案者初评',
  badges: [{ variant: 'step-score', text: '评分：8.2' }],
  content: '构图稳健。',
}
const critique: ProcessStepItem = {
  kind: 'critique',
  title: '批判者质疑',
  badges: [{ variant: 'severity-high', text: '质疑程度：高' }],
  content: '依据不足。',
  challenges: [
    { dimension: 'composition', issue: '主体偏移', evidence: '留白过多', suggestedScore: 7.5 },
  ],
}
const revision: ProcessStepItem = {
  kind: 'revision',
  title: '提案者修正',
  badges: [{ variant: 'step-score', text: '修正后：7.9' }],
  content: '重新核对维度评分。',
}
const arbitration: ProcessStepItem = {
  kind: 'arbitration',
  title: '仲裁者裁决',
  badges: [{ variant: 'step-score', text: '最终：8.0' }],
  content: '综合双方论证。',
}

// 无 revision 三步（app.js L743：arbitration = revision ? 4 : 3）
const threeSteps = [proposal, critique, arbitration]
const fourSteps = [proposal, critique, revision, arbitration]

const metadata: Record<string, GenreMetadata> = {
  landscape: {
    label: '风光',
    dimensionLabels: [],
    subtypes: [],
    dimensions: [{ key: 'composition', label: '构图' }],
  },
}

describe('ProcessTimeline', () => {
  // ── 边界 ──

  // DESIGN §2.5「为空时不显示容器」
  it('steps 为空数组时不渲染折叠壳', async () => {
    const wrapper = await mountSuspended(ProcessTimeline, {
      props: { title: '查看评估过程', steps: [] },
    })
    expect(wrapper.find('.collapsible').exists()).toBe(false)
  })

  // ── 结构（回归锚点：single.html L159-164 #process-collapsible）──

  it('BaseCollapsible 包裹，header 渲染 title', async () => {
    const wrapper = await mountSuspended(ProcessTimeline, {
      props: { title: '查看评估过程', steps: threeSteps },
    })
    expect(wrapper.find('.collapsible').exists()).toBe(true)
    expect(wrapper.find('.collapsible-title').text()).toBe('查看评估过程')
    expect(wrapper.find('.process-content').exists()).toBe(true)
  })

  // 回归锚点：single.html L161 aria-expanded="false"（默认折叠，DESIGN §9.14）
  it('默认折叠', async () => {
    const wrapper = await mountSuspended(ProcessTimeline, {
      props: { title: '查看评估过程', steps: threeSteps },
    })
    expect(wrapper.find('.collapsible-header').attributes('aria-expanded')).toBe('false')
  })

  it('v-model:open=true 初始展开', async () => {
    const wrapper = await mountSuspended(ProcessTimeline, {
      props: { title: '查看评估过程', steps: threeSteps, open: true },
    })
    expect(wrapper.find('.collapsible-header').attributes('aria-expanded')).toBe('true')
  })

  // ── 步骤编排（回归锚点：app.js L663-766 / group.js L972-1032）──

  it('三步序列渲染 3 个 ProcessStep，data-step 编号 1..3', async () => {
    const wrapper = await mountSuspended(ProcessTimeline, {
      props: { title: '查看评估过程', steps: threeSteps },
    })
    const steps = wrapper.findAll('.process-step')
    expect(steps).toHaveLength(3)
    expect(steps[0]!.attributes('data-step')).toBe('1')
    expect(steps[1]!.attributes('data-step')).toBe('2')
    expect(steps[2]!.attributes('data-step')).toBe('3')
    expect(steps[0]!.classes()).toContain('step-proposal')
    expect(steps[2]!.classes()).toContain('step-arbitration')
  })

  // 回归锚点：app.js L743 revision 条件插入时 arbitration 编号为 4
  it('四步序列（含 revision）data-step 编号 1..4', async () => {
    const wrapper = await mountSuspended(ProcessTimeline, {
      props: { title: '查看评估过程', steps: fourSteps },
    })
    const steps = wrapper.findAll('.process-step')
    expect(steps).toHaveLength(4)
    expect(steps[2]!.classes()).toContain('step-revision')
    expect(steps[3]!.attributes('data-step')).toBe('4')
  })

  // ── 交互 ──

  it('点击 header 发出 update:open', async () => {
    const wrapper = await mountSuspended(ProcessTimeline, {
      props: { title: '查看评估过程', steps: threeSteps },
    })
    await wrapper.find('.collapsible-header').trigger('click')
    expect(wrapper.emitted('update:open')).toEqual([[true]])
  })

  // ── 透传 ──

  it('genre/metadata 透传至 ChallengeList（维度名解析间接验证）', async () => {
    const wrapper = await mountSuspended(ProcessTimeline, {
      props: { title: '查看评估过程', steps: threeSteps, genre: 'landscape', metadata },
    })
    expect(wrapper.find('.challenge-dimension').text()).toContain('构图')
  })

  it('属性透传至根元素', async () => {
    const wrapper = await mountSuspended(ProcessTimeline, {
      props: { title: '查看评估过程', steps: threeSteps },
      attrs: { id: 'process-collapsible' },
    })
    expect(wrapper.find('.collapsible').attributes('id')).toBe('process-collapsible')
  })
})
