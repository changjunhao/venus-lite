import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BaseButton from '~/components/ui/BaseButton.vue'

describe('BaseButton', () => {
  it('默认渲染为 primary button', async () => {
    const wrapper = await mountSuspended(BaseButton, {
      slots: { default: () => '开始单图评估' },
    })
    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
    expect(button.attributes('type')).toBe('button')
    expect(button.classes()).toContain('btn')
    expect(button.classes()).toContain('btn-primary')
  })

  it.each([
    ['primary', ['btn', 'btn-primary']],
    ['secondary', ['btn', 'btn-secondary']],
    ['share', ['btn', 'btn-share']],
  ] as const)('变体 %s 映射为 class %j', async (variant, expected) => {
    const wrapper = await mountSuspended(BaseButton, { props: { variant } })
    expect(wrapper.find('button').classes()).toEqual(expected)
  })

  it('text 变体仅挂 text-button，不属于 .btn 家族', async () => {
    const wrapper = await mountSuspended(BaseButton, { props: { variant: 'text' } })
    const classes = wrapper.find('button').classes()
    expect(classes).toContain('text-button')
    expect(classes).not.toContain('btn')
  })

  it('传入 to 时渲染为链接，不带 disabled 属性', async () => {
    const wrapper = await mountSuspended(BaseButton, {
      props: { to: '/single', disabled: true, loading: true },
    })
    const link = wrapper.find('a')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('/single')
    expect(link.attributes('disabled')).toBeUndefined()
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('disabled 时按钮禁用且点击不触发事件', async () => {
    const wrapper = await mountSuspended(BaseButton, {
      props: { disabled: true },
      attrs: { onClick: () => {} },
    })
    const button = wrapper.find('button')
    expect(button.attributes('disabled')).toBeDefined()
    await button.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('loading 时禁用并标记 aria-busy，结束后属性移除', async () => {
    const wrapper = await mountSuspended(BaseButton, { props: { loading: true } })
    const button = wrapper.find('button')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('aria-busy')).toBe('true')

    await wrapper.setProps({ loading: false })
    expect(button.attributes('aria-busy')).toBeUndefined()
    expect(button.attributes('disabled')).toBeUndefined()
  })

  it('仅 loading（未传 disabled）时按钮仍禁用', async () => {
    const wrapper = await mountSuspended(BaseButton, { props: { loading: true } })
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('slot 内容透传，调用方可切换 loading 文案', async () => {
    const wrapper = await mountSuspended(BaseButton, {
      props: { loading: true },
      slots: { default: () => '单图评估中...' },
    })
    expect(wrapper.text()).toBe('单图评估中...')
  })

  it('type=submit 正确透传', async () => {
    const wrapper = await mountSuspended(BaseButton, { props: { type: 'submit' } })
    expect(wrapper.find('button').attributes('type')).toBe('submit')
  })
})
