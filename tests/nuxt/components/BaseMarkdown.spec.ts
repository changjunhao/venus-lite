import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MarkdownRender from 'markstream-vue'
import BaseMarkdown from '~/components/ui/BaseMarkdown.vue'

describe('BaseMarkdown', () => {
  it('渲染 markstream-vue 容器', async () => {
    const wrapper = await mountSuspended(BaseMarkdown, {
      props: { content: '', final: true },
    })
    expect(wrapper.find('.markstream-vue').exists()).toBe(true)
  })

  // venus renderMarkdown 的粗体/斜体子集是最低渲染保障
  it('final 态渲染粗体与斜体', async () => {
    const wrapper = await mountSuspended(BaseMarkdown, {
      props: { content: '**构图** 与 *光线*', final: true },
    })
    expect(wrapper.find('strong').text()).toBe('构图')
    expect(wrapper.find('em').text()).toBe('光线')
  })

  // 薄封装的固定配置是既定架构约束，不得被意外改动
  it('内部硬编码配置透传至 MarkdownRender', async () => {
    const wrapper = await mountSuspended(BaseMarkdown, {
      props: { content: '点评内容', final: true },
    })
    const renderer = wrapper.findComponent(MarkdownRender)
    expect(renderer.props('customId')).toBe('venus')
    expect(renderer.props('smoothStreaming')).toBe('auto')
    expect(renderer.props('mode')).toBe('minimal')
    expect(renderer.props('fade')).toBe(false)
  })

  it('final 默认 false，显式传入后透传为 true', async () => {
    const streaming = await mountSuspended(BaseMarkdown, {
      props: { content: '流式中' },
    })
    expect(streaming.findComponent(MarkdownRender).props('final')).toBe(false)

    const done = await mountSuspended(BaseMarkdown, {
      props: { content: '已完成', final: true },
    })
    expect(done.findComponent(MarkdownRender).props('final')).toBe(true)
  })

  // 流式累积 → final 收敛；内容断言只在 final 后做，且经 vi.waitFor
  // 等待 renderer 的异步重解析（pacing/parse 合并非同步完成）
  it('流式累积 content 并置 final 后渲染完整内容', async () => {
    const wrapper = await mountSuspended(BaseMarkdown, {
      props: { content: '提案者正在' },
    })
    await wrapper.setProps({ content: '提案者正在**形成初评**' })
    await wrapper.setProps({ final: true })
    await vi.waitFor(() => {
      expect(wrapper.find('strong').exists()).toBe(true)
    })
    expect(wrapper.text()).toContain('提案者正在')
    expect(wrapper.find('strong').text()).toBe('形成初评')
  })

  // 调用方 class 是既定的样式扩展点，不得被内部 class 覆盖
  it('调用方 class 与内部 class 合并', async () => {
    const wrapper = await mountSuspended(BaseMarkdown, {
      props: { content: '点评', final: true },
      attrs: { class: 'critique-text' },
    })
    const classes = wrapper.find('.markstream-vue').classes()
    expect(classes).toContain('markstream-vue')
    expect(classes).toContain('critique-text')
  })

  it('属性透传至根元素', async () => {
    const wrapper = await mountSuspended(BaseMarkdown, {
      props: { content: '点评', final: true },
      attrs: { id: 'critique-markdown' },
    })
    expect(wrapper.find('.markstream-vue').attributes('id')).toBe('critique-markdown')
  })
})
