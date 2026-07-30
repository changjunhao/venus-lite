import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BaseSelect from '~/components/ui/BaseSelect.vue'

// venus 门类下拉的真实数据子集（single.html）
const genreOptions = [
  { value: 'auto', label: '自动识别' },
  { value: 'portrait', label: '人像' },
  { value: 'landscape', label: '风光' },
]

const baseProps = {
  modelValue: 'auto',
  options: genreOptions,
  label: '摄影门类',
}

describe('BaseSelect', () => {
  it('默认渲染 field 变体，label 与 select 通过 for/id 关联', async () => {
    const wrapper = await mountSuspended(BaseSelect, { props: baseProps })
    const root = wrapper.find('div')
    expect(root.classes()).toContain('control-field')
    expect(root.classes()).toContain('control-field-field')

    const label = wrapper.find('label')
    const select = wrapper.find('select')
    expect(label.text()).toBe('摄影门类')
    expect(label.attributes('for')).toBeTruthy()
    expect(label.attributes('for')).toBe(select.attributes('id'))
  })

  it('options 数组驱动 option 渲染，含 disabled 映射', async () => {
    const wrapper = await mountSuspended(BaseSelect, {
      props: {
        ...baseProps,
        options: [...genreOptions, { value: 'sports', label: '运动', disabled: true }],
      },
    })
    const options = wrapper.findAll('option')
    expect(options).toHaveLength(4)
    expect(options.map(option => option.attributes('value'))).toEqual([
      'auto', 'portrait', 'landscape', 'sports',
    ])
    expect(options.map(option => option.text())).toEqual(['自动识别', '人像', '风光', '运动'])
    expect(options[3]!.attributes('disabled')).toBeDefined()
    expect(options[0]!.attributes('disabled')).toBeUndefined()
  })

  it('v-model：初始值选中对应 option，选择后发出 update:modelValue 与 change', async () => {
    const wrapper = await mountSuspended(BaseSelect, { props: baseProps })
    const select = wrapper.find('select')
    expect(select.element.value).toBe('auto')

    await select.setValue('portrait')
    expect(wrapper.emitted('update:modelValue')).toEqual([['portrait']])
    expect(wrapper.emitted('change')).toEqual([['portrait']])
  })

  // FocusCompare 场景：option value 为图片索引，DOM 取值后需保留 number 类型
  it('number 值经 change 后保型为 number', async () => {
    const wrapper = await mountSuspended(BaseSelect, {
      props: {
        modelValue: 0,
        options: [
          { value: 0, label: '#1 · 第 1 张' },
          { value: 1, label: '#2 · 第 2 张' },
        ],
        label: '左侧照片',
      },
    })
    await wrapper.find('select').setValue('1')
    expect(wrapper.emitted('update:modelValue')).toEqual([[1]])
    expect(wrapper.emitted('change')).toEqual([[1]])
  })

  it('variant=plain 挂 plain 类且不属于 field 变体', async () => {
    const wrapper = await mountSuspended(BaseSelect, {
      props: { ...baseProps, variant: 'plain' as const },
    })
    const classes = wrapper.find('div').classes()
    expect(classes).toContain('control-field-plain')
    expect(classes).not.toContain('control-field-field')
  })

  it('disabled 时 select 禁用', async () => {
    const wrapper = await mountSuspended(BaseSelect, {
      props: { ...baseProps, disabled: true },
    })
    expect(wrapper.find('select').attributes('disabled')).toBeDefined()
  })

  it('error 态：错误文字 + aria-describedby 精确关联 + aria-invalid + 错误类', async () => {
    const wrapper = await mountSuspended(BaseSelect, {
      props: { ...baseProps, error: '请选择摄影门类' },
    })
    const select = wrapper.find('select')
    const error = wrapper.find('.control-error')
    expect(error.text()).toBe('请选择摄影门类')
    expect(error.attributes('id')).toBeTruthy()
    expect(select.attributes('aria-describedby')).toBe(error.attributes('id'))
    expect(select.attributes('aria-invalid')).toBe('true')
    expect(wrapper.find('div').classes()).toContain('control-field-error')
  })

  it('无 error 时不渲染错误元素与 aria 标记', async () => {
    const wrapper = await mountSuspended(BaseSelect, { props: baseProps })
    const select = wrapper.find('select')
    expect(wrapper.find('.control-error').exists()).toBe(false)
    expect(select.attributes('aria-describedby')).toBeUndefined()
    expect(select.attributes('aria-invalid')).toBeUndefined()
    expect(wrapper.find('div').classes()).not.toContain('control-field-error')
  })

  // 调用方 class 是既定的样式扩展点，不得被内部 class 覆盖（对齐 BaseCard 约定）
  it('调用方 class 与内部 class 合并', async () => {
    const wrapper = await mountSuspended(BaseSelect, {
      props: baseProps,
      attrs: { class: 'focus-left-select' },
    })
    const classes = wrapper.find('div').classes()
    expect(classes).toContain('control-field')
    expect(classes).toContain('focus-left-select')
  })
})
