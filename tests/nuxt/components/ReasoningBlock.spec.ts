import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MarkdownRender from 'markstream-vue'
import ReasoningBlock from '~/components/evaluation/ReasoningBlock.vue'

describe('ReasoningBlock', () => {
  const props = { toggleText: '提案者分析过程', content: '逐步分析构图与光影' }

  // ── 结构（回归锚点：app.js L771-778 thinking-block）──

  it('渲染 toggle 按钮 + 内容区，按钮文案为完整 toggleText', async () => {
    const wrapper = await mountSuspended(ReasoningBlock, { props })
    expect(wrapper.find('.thinking-block').exists()).toBe(true)

    const toggle = wrapper.find('button.thinking-toggle')
    expect(toggle.exists()).toBe(true)
    expect(toggle.attributes('type')).toBe('button')
    expect(toggle.text()).toContain('提案者分析过程')

    expect(wrapper.find('.thinking-content').exists()).toBe(true)
  })

  it('help-circle 图标 aria-hidden（§14.4 装饰性图标）', async () => {
    const wrapper = await mountSuspended(ReasoningBlock, { props })
    const svg = wrapper.find('.thinking-toggle svg')
    expect(svg.exists()).toBe(true)
    expect(svg.attributes('aria-hidden')).toBe('true')
  })

  // ── 折叠交互（回归锚点：app.js L760-765 open class 切换）──

  // 回归锚点：app.js L772 初始无 open class（默认折叠）
  it('默认折叠：aria-expanded=false 且内容区 display:none', async () => {
    const wrapper = await mountSuspended(ReasoningBlock, { props })
    expect(wrapper.find('.thinking-toggle').attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.thinking-block').classes()).not.toContain('thinking-open')
    // v-show 精确对应 venus display:none→block（style.css L981/983）；
    // happy-dom 布局引擎不可靠（isVisible 恒 true），改断言内联 style
    expect(wrapper.find('.thinking-content').attributes('style')).toContain('display: none')
  })

  it('点击 toggle 展开：aria-expanded=true 且内容区 display 恢复', async () => {
    const wrapper = await mountSuspended(ReasoningBlock, { props })
    await wrapper.find('.thinking-toggle').trigger('click')
    expect(wrapper.find('.thinking-toggle').attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('.thinking-block').classes()).toContain('thinking-open')
    expect(wrapper.find('.thinking-content').attributes('style')).toBeUndefined()
  })

  it('再次点击收起', async () => {
    const wrapper = await mountSuspended(ReasoningBlock, { props })
    await wrapper.find('.thinking-toggle').trigger('click')
    await wrapper.find('.thinking-toggle').trigger('click')
    expect(wrapper.find('.thinking-toggle').attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.thinking-content').attributes('style')).toContain('display: none')
  })

  // ── 无障碍（有意增强：venus 原版无 aria 关联，DESIGN §9.14/§14.2）──

  it('aria-controls 与内容区 id 显式关联', async () => {
    const wrapper = await mountSuspended(ReasoningBlock, { props })
    const contentId = wrapper.find('.thinking-content').attributes('id')
    expect(contentId).toBeTruthy()
    expect(wrapper.find('.thinking-toggle').attributes('aria-controls')).toBe(contentId)
  })

  // ── Markdown 渲染（component-plan §四.7 静态场景 final: true）──

  it('BaseMarkdown 收到 content 与 final=true', async () => {
    const wrapper = await mountSuspended(ReasoningBlock, { props })
    const renderer = wrapper.findComponent(MarkdownRender)
    expect(renderer.exists()).toBe(true)
    expect(renderer.props('content')).toBe('逐步分析构图与光影')
    expect(renderer.props('final')).toBe(true)
  })
})
