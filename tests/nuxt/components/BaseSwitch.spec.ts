import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BaseSwitch from '~/components/ui/BaseSwitch.vue'

// venus group-joint.html 逐图明细开关的真实文案
const slots = {
  default: () => '包含逐图明细',
  description: () => '开启后，将为每张照片补充评分和点评，评估时间会相应增加',
}

describe('BaseSwitch', () => {
  it('渲染 label 外壳、role=switch 的 checkbox、轨道与文案区，label 与 input 通过 for/id 关联', async () => {
    const wrapper = await mountSuspended(BaseSwitch, {
      props: { modelValue: false },
      slots,
    })
    const label = wrapper.find('label')
    expect(label.classes()).toContain('detail-switch')

    const input = wrapper.find('input')
    expect(input.attributes('type')).toBe('checkbox')
    expect(input.attributes('role')).toBe('switch')
    expect(label.attributes('for')).toBeTruthy()
    expect(label.attributes('for')).toBe(input.attributes('id'))

    const track = wrapper.find('.switch-track')
    expect(track.attributes('aria-hidden')).toBe('true')
    expect(track.find('span').exists()).toBe(true)
    expect(wrapper.find('.switch-copy').exists()).toBe(true)
  })

  it('default slot 进 strong，description slot 进 small', async () => {
    const wrapper = await mountSuspended(BaseSwitch, {
      props: { modelValue: false },
      slots,
    })
    expect(wrapper.find('.switch-copy strong').text()).toBe('包含逐图明细')
    expect(wrapper.find('.switch-copy small').text())
      .toBe('开启后，将为每张照片补充评分和点评，评估时间会相应增加')
  })

  it('不传 description 时不渲染 small', async () => {
    const wrapper = await mountSuspended(BaseSwitch, {
      props: { modelValue: false },
      slots: { default: () => '包含逐图明细' },
    })
    expect(wrapper.find('.switch-copy small').exists()).toBe(false)
  })

  it('v-model：初始值驱动 checked 状态', async () => {
    const on = await mountSuspended(BaseSwitch, {
      props: { modelValue: true },
      slots,
    })
    expect(on.find('input').element.checked).toBe(true)

    const off = await mountSuspended(BaseSwitch, {
      props: { modelValue: false },
      slots,
    })
    expect(off.find('input').element.checked).toBe(false)
  })

  it('切换后发出 update:modelValue 与 change', async () => {
    const wrapper = await mountSuspended(BaseSwitch, {
      props: { modelValue: false },
      slots,
    })
    await wrapper.find('input').setValue(true)
    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
    expect(wrapper.emitted('change')).toEqual([[true]])
  })

  it('disabled 时 input 禁用且外壳挂禁用类，默认无', async () => {
    const wrapper = await mountSuspended(BaseSwitch, {
      props: { modelValue: false, disabled: true },
      slots,
    })
    expect(wrapper.find('input').attributes('disabled')).toBeDefined()
    expect(wrapper.find('label').classes()).toContain('detail-switch-disabled')

    const normal = await mountSuspended(BaseSwitch, {
      props: { modelValue: false },
      slots,
    })
    expect(normal.find('input').attributes('disabled')).toBeUndefined()
    expect(normal.find('label').classes()).not.toContain('detail-switch-disabled')
  })

  // 调用方 class 是既定的样式扩展点，不得被内部 class 覆盖（对齐 BaseCard/BaseSelect 约定）
  it('调用方 class 与内部 class 合并', async () => {
    const wrapper = await mountSuspended(BaseSwitch, {
      props: { modelValue: false },
      slots,
      attrs: { class: 'joint-detail-switch' },
    })
    const classes = wrapper.find('label').classes()
    expect(classes).toContain('detail-switch')
    expect(classes).toContain('joint-detail-switch')
  })
})
