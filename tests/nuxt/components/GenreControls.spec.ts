import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import GenreControls from '~/components/upload/GenreControls.vue'

describe('GenreControls', () => {
  const genreOptions = [
    { value: 'auto', label: '自动识别' },
    { value: 'portrait', label: '人像' },
    { value: 'landscape', label: '风光' },
  ]

  const baseProps = {
    genreOptions,
    genreLabel: '摄影门类',
  }

  // ── 渲染 ──

  // 回归锚点：single.html L66-76 .single-controls.input-sheet-controls
  it('默认渲染：根 .input-sheet-controls + single 修饰类 + BaseSelect 收到 options/label', async () => {
    const wrapper = await mountSuspended(GenreControls, { props: baseProps })
    const root = wrapper.find('.input-sheet-controls')
    expect(root.exists()).toBe(true)
    expect(root.classes()).toContain('input-sheet-controls-single')

    // BaseSelect field 变体壳与标签
    expect(wrapper.find('.control-field').exists()).toBe(true)
    expect(wrapper.find('.control-label').text()).toBe('摄影门类')

    // options 渲染
    const options = wrapper.findAll('option')
    expect(options).toHaveLength(3)
    expect(options[0]!.text()).toBe('自动识别')
    expect(options[1]!.text()).toBe('人像')
  })

  // single 页无逐图明细开关（single.html L66-76 仅含门类下拉）
  it('showPerImage=false（默认）时不渲染 .detail-switch', async () => {
    const wrapper = await mountSuspended(GenreControls, { props: baseProps })
    expect(wrapper.find('.detail-switch').exists()).toBe(false)
  })

  // 回归锚点：group-joint.html L64-68 detail-switch
  it('showPerImage=true 时渲染 BaseSwitch，strong/small 落入 title/description 文案', async () => {
    const wrapper = await mountSuspended(GenreControls, {
      props: {
        ...baseProps,
        showPerImage: true,
        perImageTitle: '包含逐图明细',
        perImageDescription: '开启后，将为每张照片补充评分和点评，评估时间会相应增加',
      },
    })
    const sw = wrapper.find('.detail-switch')
    expect(sw.exists()).toBe(true)
    expect(sw.find('strong').text()).toBe('包含逐图明细')
    expect(sw.find('small').text()).toBe('开启后，将为每张照片补充评分和点评，评估时间会相应增加')

    // group 模式移除 single 修饰类（双列网格）
    expect(wrapper.find('.input-sheet-controls-single').exists()).toBe(false)
  })

  // ── 事件 ──

  // 回归锚点：group.js L1083-1086 genreSelect change → state.genre + invalidateResult
  it('门类变更同时发射 update:genre 与 genreChange', async () => {
    const wrapper = await mountSuspended(GenreControls, {
      props: { ...baseProps, genre: 'auto' },
    })
    await wrapper.find('select').setValue('portrait')

    expect(wrapper.emitted('update:genre')).toBeTruthy()
    expect(wrapper.emitted('update:genre')![0]).toEqual(['portrait'])
    expect(wrapper.emitted('genreChange')).toBeTruthy()
    expect(wrapper.emitted('genreChange')![0]).toEqual(['portrait'])
  })

  // 回归锚点：group.js L1087 includePerImage change → invalidateResult
  it('逐图明细切换同时发射 update:includePerImage 与 includePerImageChange', async () => {
    const wrapper = await mountSuspended(GenreControls, {
      props: { ...baseProps, showPerImage: true, includePerImage: false },
    })
    await wrapper.find('input[type="checkbox"]').setValue(true)

    expect(wrapper.emitted('update:includePerImage')).toBeTruthy()
    expect(wrapper.emitted('update:includePerImage')![0]).toEqual([true])
    expect(wrapper.emitted('includePerImageChange')).toBeTruthy()
    expect(wrapper.emitted('includePerImageChange')![0]).toEqual([true])
  })

  // ── disabled 透传 ──

  // 回归锚点：group.js L1040-1041 loading 时禁用 genreSelect + includePerImage
  it('disabled=true 时 select 与 checkbox 均禁用', async () => {
    const wrapper = await mountSuspended(GenreControls, {
      props: { ...baseProps, showPerImage: true, disabled: true },
    })
    expect(wrapper.find('select').attributes('disabled')).toBeDefined()
    expect(wrapper.find('input[type="checkbox"]').attributes('disabled')).toBeDefined()
  })

  // ── 默认值 ──

  // 回归锚点：single.html L70 <option value="auto" selected>
  it('genre 缺省为 auto（不传 v-model 时 select 值为 auto）', async () => {
    const wrapper = await mountSuspended(GenreControls, { props: baseProps })
    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('auto')
  })

  // §9.3：开关默认关闭
  it('includePerImage 缺省为 false（checkbox 未选中）', async () => {
    const wrapper = await mountSuspended(GenreControls, {
      props: { ...baseProps, showPerImage: true },
    })
    expect((wrapper.find('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(false)
  })

  // ── 属性透传 ──

  it('属性透传至根元素', async () => {
    const wrapper = await mountSuspended(GenreControls, {
      props: baseProps,
      attrs: { 'data-testid': 'genre-controls' },
    })
    expect(wrapper.find('.input-sheet-controls').attributes('data-testid')).toBe('genre-controls')
  })
})
