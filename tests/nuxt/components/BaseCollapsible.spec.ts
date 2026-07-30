import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BaseCollapsible from '~/components/ui/BaseCollapsible.vue'

// venus single.html 评估过程折叠面板的真实文案
const slots = {
  header: () => '查看评估过程',
  default: () => '提案 → 质疑 → 修正 → 仲裁',
}

describe('BaseCollapsible', () => {
  it('渲染 heading > button 结构，chevron aria-hidden，aria-controls 关联内容区', async () => {
    const wrapper = await mountSuspended(BaseCollapsible, {
      props: { open: false },
      slots,
    })
    // 键盘可达（Enter/Space）由原生 button 保证，断言元素类型即覆盖该规格点
    const button = wrapper.find('h3.collapsible-heading > button.collapsible-header')
    expect(button.exists()).toBe(true)
    expect(button.attributes('type')).toBe('button')

    const icon = wrapper.find('.collapsible-icon')
    expect(icon.attributes('aria-hidden')).toBe('true')

    const content = wrapper.find('.collapsible-content')
    expect(content.attributes('id')).toBeTruthy()
    expect(button.attributes('aria-controls')).toBe(content.attributes('id'))
  })

  it.each(['h2', 'h4'] as const)('headingTag=%s 渲染为对应标签', async (headingTag) => {
    const wrapper = await mountSuspended(BaseCollapsible, {
      props: { open: false, headingTag },
      slots,
    })
    expect(wrapper.find(`${headingTag}.collapsible-heading`).exists()).toBe(true)
  })

  it('header slot 进 title，default slot 进 body', async () => {
    const wrapper = await mountSuspended(BaseCollapsible, {
      props: { open: false },
      slots,
    })
    expect(wrapper.find('.collapsible-title').text()).toBe('查看评估过程')
    expect(wrapper.find('.collapsible-body').text()).toBe('提案 → 质疑 → 修正 → 仲裁')
  })

  it('v-model:open 初始值驱动 aria-expanded、open 类与 inert', async () => {
    // venus EXIF 折叠面板默认展开的场景
    const opened = await mountSuspended(BaseCollapsible, {
      props: { open: true },
      slots,
    })
    expect(opened.find('.collapsible-header').attributes('aria-expanded')).toBe('true')
    expect(opened.find('.collapsible').classes()).toContain('collapsible-open')
    expect(opened.find('.collapsible-content').attributes('inert')).toBeUndefined()

    const closed = await mountSuspended(BaseCollapsible, {
      props: { open: false },
      slots,
    })
    expect(closed.find('.collapsible-header').attributes('aria-expanded')).toBe('false')
    expect(closed.find('.collapsible').classes()).not.toContain('collapsible-open')
    expect(closed.find('.collapsible-content').attributes('inert')).toBeDefined()
  })

  it('点击 header 发出 update:open 与 change', async () => {
    const wrapper = await mountSuspended(BaseCollapsible, {
      props: { open: false },
      slots,
    })
    await wrapper.find('.collapsible-header').trigger('click')
    expect(wrapper.emitted('update:open')).toEqual([[true]])
    expect(wrapper.emitted('change')).toEqual([[true]])
  })

  // 调用方 class 是既定的样式扩展点，不得被内部 class 覆盖（对齐 BaseCard/BaseSelect/BaseSwitch 约定）
  it('调用方 class 与内部 class 合并', async () => {
    const wrapper = await mountSuspended(BaseCollapsible, {
      props: { open: false },
      slots,
      attrs: { class: 'report-disclosure-collapsible' },
    })
    const classes = wrapper.find('.collapsible').classes()
    expect(classes).toContain('collapsible')
    expect(classes).toContain('report-disclosure-collapsible')
  })
})
