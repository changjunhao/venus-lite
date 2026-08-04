import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MarkdownRender from 'markstream-vue'
import CritiqueReport from '~/components/evaluation/CritiqueReport.vue'

const fullProps = {
  critique: '构图稳健，光影层次丰富。',
  suggestions: ['强化前景引导线。', '降低右上角高光。'],
  arbitrationNotes: {
    sceneTypeRuling: '该图属于环境人像，应优先评价人物与环境的关系。',
    decisions: [
      {
        target: 'lighting_quality',
        decision: 'partial' as const,
        reason: '高光确有损失，但没有影响人物识别。',
      },
      {
        target: 'composition_focus',
        decision: 'reject' as const,
        reason: '环境信息服务于叙事，不构成无效干扰。',
      },
    ],
    finalRationale: '综合争议证据，维持当前评分。',
  },
}

describe('CritiqueReport', () => {
  it('完整结构渲染 CRITIQUE / ACTION / VERDICT 三章', async () => {
    const wrapper = await mountSuspended(CritiqueReport, { props: fullProps })
    expect(wrapper.classes()).toContain('editorial-report-body')
    expect(wrapper.findAll('.report-chapter')).toHaveLength(3)
    expect(wrapper.findAll('.section-index').map(el => el.text())).toEqual(['CRITIQUE', 'ACTION', 'VERDICT'])
  })

  it('仅 critique 使用 Markdown，结构化字段不再进入 Markdown parser', async () => {
    const wrapper = await mountSuspended(CritiqueReport, { props: fullProps })
    const renderers = wrapper.findAllComponents(MarkdownRender)
    expect(renderers).toHaveLength(1)
    expect(renderers[0]!.props('content')).toBe(fullProps.critique)
    expect(renderers[0]!.props('final')).toBe(true)
  })

  it('suggestions 直接按数组渲染为有序列表', async () => {
    const wrapper = await mountSuspended(CritiqueReport, { props: fullProps })
    const items = wrapper.findAll('.suggestion-list li')
    expect(items).toHaveLength(2)
    expect(items.map(item => item.text())).toEqual(fullProps.suggestions)
  })

  it('arbitrationNotes 分区展示场景判定、逐条裁决和最终理由', async () => {
    const wrapper = await mountSuspended(CritiqueReport, {
      props: {
        ...fullProps,
        sceneTypeRulingLabel: '场景判定',
        decisionsLabel: '争议裁决',
        finalRationaleLabel: '最终理由',
        decisionPartialLabel: '部分采纳',
        decisionRejectLabel: '驳回',
      },
    })
    expect(wrapper.findAll('.arbitration-block h4').map(el => el.text())).toEqual([
      '场景判定',
      '争议裁决',
      '最终理由',
    ])
    expect(wrapper.findAll('.decision-target').map(el => el.text())).toEqual([
      'lighting_quality',
      'composition_focus',
    ])
    expect(wrapper.findAll('.decision-status').map(el => el.text())).toEqual(['部分采纳', '驳回'])
    expect(wrapper.find('.arbitration-final p').text()).toBe(fullProps.arbitrationNotes.finalRationale)
  })

  it('LOW 无争议时 decisions 为空，只隐藏争议裁决分区', async () => {
    const wrapper = await mountSuspended(CritiqueReport, {
      props: {
        ...fullProps,
        arbitrationNotes: {
          sceneTypeRuling: '场景判断一致。',
          decisions: [],
          finalRationale: '采用双方共识。',
        },
      },
    })
    expect(wrapper.find('.decision-list').exists()).toBe(false)
    expect(wrapper.findAll('.arbitration-block')).toHaveLength(2)
  })

  it('showCritique=false 时仅渲染 ACTION + VERDICT', async () => {
    const wrapper = await mountSuspended(CritiqueReport, {
      props: { ...fullProps, showCritique: false },
    })
    expect(wrapper.findAll('.section-index').map(el => el.text())).toEqual(['ACTION', 'VERDICT'])
  })

  it('空建议数组和缺失仲裁对象不渲染对应章节', async () => {
    const wrapper = await mountSuspended(CritiqueReport, {
      props: { critique: '', suggestions: [] },
    })
    expect(wrapper.findAll('.report-chapter')).toHaveLength(0)
  })

  it('支持自定义章节标题', async () => {
    const wrapper = await mountSuspended(CritiqueReport, {
      props: {
        ...fullProps,
        critiqueTitle: 'Expert Critique',
        suggestionsTitle: 'Suggestions',
        arbitrationTitle: 'Verdict Notes',
      },
    })
    expect(wrapper.findAll('h3.chapter-title').map(el => el.text())).toEqual([
      'Expert Critique',
      'Suggestions',
      'Verdict Notes',
    ])
  })

  it('attrs 落根元素', async () => {
    const wrapper = await mountSuspended(CritiqueReport, {
      props: fullProps,
      attrs: { id: 'critique-report', class: 'extra' },
    })
    expect(wrapper.attributes('id')).toBe('critique-report')
    expect(wrapper.classes()).toContain('extra')
  })
})
