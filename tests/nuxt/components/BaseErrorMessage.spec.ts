import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BaseErrorMessage from '~/components/ui/BaseErrorMessage.vue'

describe('BaseErrorMessage', () => {
  it('默认渲染为隐藏态的 role=alert 容器，文本为空', async () => {
    const wrapper = await mountSuspended(BaseErrorMessage)
    const alert = wrapper.find('div')
    expect(alert.exists()).toBe(true)
    expect(alert.attributes('role')).toBe('alert')
    expect(alert.classes()).toContain('error-message')
    expect(alert.classes()).not.toContain('active')
    expect(alert.text()).toBe('')
  })

  it('message 非空时挂 active 并渲染文案', async () => {
    const wrapper = await mountSuspended(BaseErrorMessage, {
      props: { message: '请上传 JPG、PNG、WebP、AVIF 或 TIFF 格式的照片' },
    })
    const alert = wrapper.find('div')
    expect(alert.classes()).toContain('active')
    expect(alert.text()).toBe('请上传 JPG、PNG、WebP、AVIF 或 TIFF 格式的照片')
  })

  // 播报可靠性的回归防线：容器常驻，隐藏态 role=alert 不得从 DOM 消失
  it('隐藏态时 role=alert 依然存在于 DOM', async () => {
    const wrapper = await mountSuspended(BaseErrorMessage, {
      props: { message: '' },
    })
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  })

  it('message 动态更新时 active 与文本同步变化', async () => {
    const wrapper = await mountSuspended(BaseErrorMessage, {
      props: { message: '' },
    })
    const alert = wrapper.find('div')
    expect(alert.classes()).not.toContain('active')

    await wrapper.setProps({ message: '请先选择照片' })
    expect(alert.classes()).toContain('active')
    expect(alert.text()).toBe('请先选择照片')

    await wrapper.setProps({ message: '' })
    expect(alert.classes()).not.toContain('active')
    expect(alert.text()).toBe('')
  })

  // 调用方 class 是既定的样式扩展点，不得被内部 class 覆盖
  it('调用方 class 与内部 class 合并', async () => {
    const wrapper = await mountSuspended(BaseErrorMessage, {
      attrs: { class: 'input-error' },
    })
    const classes = wrapper.find('div').classes()
    expect(classes).toContain('error-message')
    expect(classes).toContain('input-error')
  })

  it('属性透传至根元素', async () => {
    const wrapper = await mountSuspended(BaseErrorMessage, {
      attrs: { id: 'error-message' },
    })
    expect(wrapper.find('div').attributes('id')).toBe('error-message')
  })
})
