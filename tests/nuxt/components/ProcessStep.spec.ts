import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MarkdownRender from 'markstream-vue'
import ProcessStep from '~/components/evaluation/ProcessStep.vue'
import type { GenreMetadata, ProcessStepItem, ProcessStepKind } from '#shared/types/evaluation'

// 回归锚点：app.js L679-691 / group.js L987-991 提案者初评步
const baseStep: ProcessStepItem = {
  kind: 'proposal',
  title: '提案者初评',
  badges: [{ variant: 'step-score', text: '评分：8.2' }],
  content: '构图稳健，光影层次分明。',
}

const metadata: Record<string, GenreMetadata> = {
  landscape: {
    label: '风光',
    dimensionLabels: [],
    subtypes: [],
    dimensions: [{ key: 'composition', label: '构图' }],
  },
}

describe('ProcessStep', () => {
  // ── 步骤类别与图标（回归锚点：app.js L680/699/726/745 step-{kind}）──

  it.each([
    ['proposal', 5],
    ['critique', 3],
    ['revision', 2],
    ['arbitration', 4],
  ] as Array<[ProcessStepKind, number]>)(
    'kind=%s 渲染 step-%s class 与 %i 条图标 path',
    async (kind, pathCount) => {
      const wrapper = await mountSuspended(ProcessStep, {
        props: { step: { ...baseStep, kind } },
      })
      expect(wrapper.element.tagName).toBe('ARTICLE')
      expect(wrapper.classes()).toContain('process-step')
      expect(wrapper.classes()).toContain(`step-${kind}`)

      // 图标逐字移植 app.js L682/701/728/747（polyline/line/circle 转 path）
      const svg = wrapper.find('.step-title svg')
      expect(svg.attributes('aria-hidden')).toBe('true')
      expect(svg.findAll('path')).toHaveLength(pathCount)
    },
  )

  // 回归锚点：group.js L927 data-step 编号
  it('stepNumber 渲染为 data-step 属性', async () => {
    const wrapper = await mountSuspended(ProcessStep, {
      props: { step: baseStep, stepNumber: 3 },
    })
    expect(wrapper.attributes('data-step')).toBe('3')
  })

  // ── 标题与徽章（回归锚点：group.js L929-934）──

  it('渲染标题与徽章，variant 透传 BaseBadge', async () => {
    const step: ProcessStepItem = {
      ...baseStep,
      kind: 'critique',
      title: '批判者质疑',
      badges: [
        { variant: 'severity-high', text: '质疑程度：高' },
        { variant: 'step-score', text: '建议：7.8' },
      ],
    }
    const wrapper = await mountSuspended(ProcessStep, { props: { step } })
    expect(wrapper.find('.step-title span').text()).toBe('批判者质疑')
    // BaseBadge severity 变体复合 class（BaseBadge L19-21）
    expect(wrapper.find('.severity-tag').text()).toBe('质疑程度：高')
    expect(wrapper.find('.step-score').text()).toBe('建议：7.8')
  })

  // ── 内容区（回归锚点：group.js L937 空值守卫）──

  it('content 非空时渲染 .step-content 且 BaseMarkdown 收到 final=true', async () => {
    const wrapper = await mountSuspended(ProcessStep, { props: { step: baseStep } })
    expect(wrapper.find('.step-content').exists()).toBe(true)
    const renderer = wrapper.findComponent(MarkdownRender)
    expect(renderer.props('content')).toBe('构图稳健，光影层次分明。')
    expect(renderer.props('final')).toBe(true)
  })

  it('content 空串时不渲染 .step-content', async () => {
    const wrapper = await mountSuspended(ProcessStep, {
      props: { step: { ...baseStep, content: '' } },
    })
    expect(wrapper.find('.step-content').exists()).toBe(false)
  })

  // ── 质疑列表（回归锚点：group.js L944 空值守卫）──

  it('challenges 非空时渲染 ChallengeList', async () => {
    const step: ProcessStepItem = {
      ...baseStep,
      kind: 'critique',
      challenges: [
        { dimension: 'composition', issue: '主体偏移', evidence: '留白过多', suggestedScore: 7.5 },
      ],
    }
    const wrapper = await mountSuspended(ProcessStep, {
      props: { step, genre: 'landscape', metadata },
    })
    const dimension = wrapper.find('.challenge-dimension')
    expect(dimension.exists()).toBe(true)
    // genre/metadata 透传 ChallengeList → resolveDimensionName 解析
    expect(dimension.text()).toContain('构图')
    expect(dimension.text()).toContain('→ 7.5')
  })

  it('challenges 缺省或空数组时不渲染 ChallengeList', async () => {
    const absent = await mountSuspended(ProcessStep, { props: { step: baseStep } })
    expect(absent.find('.challenge-list').exists()).toBe(false)

    const empty = await mountSuspended(ProcessStep, {
      props: { step: { ...baseStep, challenges: [] } },
    })
    expect(empty.find('.challenge-list').exists()).toBe(false)
  })

  // ── 推理块（回归锚点：app.js L770 空值守卫）──

  it('reasoning 与 reasoningToggle 齐备时渲染 ReasoningBlock', async () => {
    const step: ProcessStepItem = {
      ...baseStep,
      reasoning: '从构图维度逐项核对……',
      reasoningToggle: '提案者分析过程',
    }
    const wrapper = await mountSuspended(ProcessStep, { props: { step } })
    expect(wrapper.find('.thinking-block').exists()).toBe(true)
    expect(wrapper.find('.thinking-toggle').text()).toContain('提案者分析过程')
  })

  it.each(['', '   '])('reasoning 为空白串 %j 时不渲染 ReasoningBlock', async (reasoning) => {
    const step: ProcessStepItem = { ...baseStep, reasoning, reasoningToggle: '提案者分析过程' }
    const wrapper = await mountSuspended(ProcessStep, { props: { step } })
    expect(wrapper.find('.thinking-block').exists()).toBe(false)
  })

  // 映射层契约：reasoning 非空但 toggle 缺省 → 不渲染（测试覆盖显式化）
  it('reasoning 非空但 reasoningToggle 缺省时不渲染 ReasoningBlock', async () => {
    const step: ProcessStepItem = { ...baseStep, reasoning: '分析过程文本' }
    const wrapper = await mountSuspended(ProcessStep, { props: { step } })
    expect(wrapper.find('.thinking-block').exists()).toBe(false)
  })

  // ── 透传 ──

  it('属性透传至根元素', async () => {
    const wrapper = await mountSuspended(ProcessStep, {
      props: { step: baseStep },
      attrs: { 'data-testid': 'process-step' },
    })
    expect(wrapper.attributes('data-testid')).toBe('process-step')
  })
})
