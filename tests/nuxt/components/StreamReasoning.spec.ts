import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MarkdownRender from 'markstream-vue'
import StreamReasoning from '~/components/evaluation/StreamReasoning.vue'
import type { ReasoningBlock } from '#shared/types/evaluation'

describe('StreamReasoning', () => {
  // ── 边界 ──

  // 回归锚点：single.html L119 #stream-thinking 初始 display:none（无内容时不渲染）
  it('blocks 为空时不渲染根节点', async () => {
    const wrapper = await mountSuspended(StreamReasoning, { props: { blocks: [] } })
    expect(wrapper.find('.stream-thinking').exists()).toBe(false)
  })

  // ── 单块渲染（回归锚点：app.js L819-829 块结构）──

  it('单块渲染：header 标签「{label}{suffix}」+ 内容区', async () => {
    const blocks: ReasoningBlock[] = [
      { agent: 'proposer', label: '提案者初评', content: '正在分析构图', final: false },
    ]
    const wrapper = await mountSuspended(StreamReasoning, { props: { blocks, suffix: '过程' } })

    expect(wrapper.find('.stream-thinking').exists()).toBe(true)
    const block = wrapper.find('.stream-think-block')
    expect(block.exists()).toBe(true)
    expect(block.attributes('data-agent')).toBe('proposer')

    // app.js L825 `${label}过程`；suffix 由调用方传入（双 locale 场景传 t('review.reasoningSuffix')）
    expect(wrapper.find('.stream-think-agent').text()).toBe('提案者初评过程')
    expect(wrapper.find('.stream-think-content').exists()).toBe(true)
  })

  it('suffix 缺省时标题仅为 label（不硬编码「过程」）', async () => {
    const blocks: ReasoningBlock[] = [
      { agent: 'proposer', label: 'Proposer\'s initial review', content: 'content', final: false },
    ]
    const wrapper = await mountSuspended(StreamReasoning, { props: { blocks } })
    expect(wrapper.find('.stream-think-agent').text()).toBe('Proposer\'s initial review')
  })

  it('BaseMarkdown 收到流式态 content 与 final=false', async () => {
    const blocks: ReasoningBlock[] = [
      { agent: 'critic', label: '批判者质疑', content: '检查评分依据', final: false },
    ]
    const wrapper = await mountSuspended(StreamReasoning, { props: { blocks } })
    const renderer = wrapper.findComponent(MarkdownRender)
    expect(renderer.exists()).toBe(true)
    expect(renderer.props('content')).toBe('检查评分依据')
    expect(renderer.props('final')).toBe(false)
  })

  // 回归锚点：app.js L441-444 agent_complete → block.classList.add('done')
  it('final=true 时块渲染 .done class 且 BaseMarkdown 收到 final', async () => {
    const blocks: ReasoningBlock[] = [
      { agent: 'genreDetector', label: '门类识别', content: '风光', final: true },
    ]
    const wrapper = await mountSuspended(StreamReasoning, { props: { blocks } })
    expect(wrapper.find('.stream-think-block').classes()).toContain('done')
    expect(wrapper.findComponent(MarkdownRender).props('final')).toBe(true)
  })

  // ── 多块 ──

  it('多块按传入顺序渲染，各块 data-agent 独立', async () => {
    const blocks: ReasoningBlock[] = [
      { agent: 'genreDetector', label: '门类识别', content: '风光', final: true },
      { agent: 'proposer', label: '提案者初评', content: '构图分析中', final: false },
    ]
    const wrapper = await mountSuspended(StreamReasoning, { props: { blocks } })
    const blockEls = wrapper.findAll('.stream-think-block')
    expect(blockEls).toHaveLength(2)
    expect(blockEls[0]!.attributes('data-agent')).toBe('genreDetector')
    expect(blockEls[1]!.attributes('data-agent')).toBe('proposer')

    // 完成态与流式态共存
    expect(blockEls[0]!.classes()).toContain('done')
    expect(blockEls[1]!.classes()).not.toContain('done')

    // 各块 BaseMarkdown 独立收到各自 content
    const renderers = wrapper.findAllComponents(MarkdownRender)
    expect(renderers).toHaveLength(2)
    expect(renderers[0]!.props('content')).toBe('风光')
    expect(renderers[1]!.props('content')).toBe('构图分析中')
  })

  // ── 无障碍 ──

  // §14.5：持续变化的分析过程全文不入 Live Region
  it('容器不设 aria-live（推理文本不参与播报）', async () => {
    const blocks: ReasoningBlock[] = [
      { agent: 'proposer', label: '提案者初评', content: '内容', final: false },
    ]
    const wrapper = await mountSuspended(StreamReasoning, { props: { blocks } })
    expect(wrapper.find('.stream-thinking').attributes('aria-live')).toBeUndefined()
  })

  // ── 透传 ──

  it('属性透传至根元素', async () => {
    const blocks: ReasoningBlock[] = [
      { agent: 'proposer', label: '提案者初评', content: '内容', final: false },
    ]
    const wrapper = await mountSuspended(StreamReasoning, {
      props: { blocks },
      attrs: { 'data-testid': 'stream-thinking' },
    })
    expect(wrapper.find('.stream-thinking').attributes('data-testid')).toBe('stream-thinking')
  })
})
