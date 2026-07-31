import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import SelectionToolbar from '~/components/upload/SelectionToolbar.vue'

describe('SelectionToolbar', () => {
  const baseProps = {
    count: 2,
    statusEmpty: '请选择至少 2 张照片',
    statusOneMore: '再选择 1 张即可评估',
    statusReady: '已选择 2 张照片，可以开始评估',
    orderNote: '照片编号按当前顺序排列',
    clearLabel: '清空全部',
  }

  it('默认渲染：根 .selection-toolbar、status 文案、· 后缀、清空按钮', async () => {
    const wrapper = await mountSuspended(SelectionToolbar, { props: baseProps })
    const toolbar = wrapper.find('.selection-toolbar')
    expect(toolbar.exists()).toBe(true)

    expect(wrapper.find('.selection-status').text()).toBe('已选择 2 张照片，可以开始评估')
    expect(wrapper.find('p').text()).toContain('· 照片编号按当前顺序排列')

    const button = wrapper.find('.text-button')
    expect(button.exists()).toBe(true)
    expect(button.text()).toBe('清空全部')
  })

  // 回归锚点：group.js L240-242 三态派生
  it('count=1 时渲染 statusOneMore', async () => {
    const wrapper = await mountSuspended(SelectionToolbar, {
      props: { ...baseProps, count: 1, statusReady: '已选择 1 张照片，可以开始评估' },
    })
    expect(wrapper.find('.selection-status').text()).toBe('再选择 1 张即可评估')
  })

  it('count>=2 时渲染调用方预插值的 statusReady', async () => {
    const wrapper = await mountSuspended(SelectionToolbar, {
      props: { ...baseProps, count: 5, statusReady: '已选择 5 张照片，可以开始评估' },
    })
    expect(wrapper.find('.selection-status').text()).toBe('已选择 5 张照片，可以开始评估')
  })

  // 回归锚点：group.js L237 selectionToolbar.hidden = count === 0
  it('count=0 时根节点不渲染', async () => {
    const wrapper = await mountSuspended(SelectionToolbar, {
      props: { ...baseProps, count: 0 },
    })
    expect(wrapper.find('.selection-toolbar').exists()).toBe(false)
  })

  // §14.5 收窄：aria-live 仅在 status span，静态后缀不参与播报
  it('aria-live="polite" 仅在 .selection-status span 上', async () => {
    const wrapper = await mountSuspended(SelectionToolbar, { props: baseProps })
    expect(wrapper.find('.selection-status').attributes('aria-live')).toBe('polite')
    expect(wrapper.find('p').attributes('aria-live')).toBeUndefined()
  })

  // 回归锚点：group.js L1109 clearSelection click → clearFiles()
  it('点击清空按钮 emit clear 恰好一次', async () => {
    const wrapper = await mountSuspended(SelectionToolbar, { props: baseProps })
    await wrapper.find('.text-button').trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  // 回归锚点：group.js L1042 clearSelection.disabled = loading
  it('disabled=true 时按钮禁用且点击不 emit', async () => {
    const wrapper = await mountSuspended(SelectionToolbar, {
      props: { ...baseProps, disabled: true },
    })
    const button = wrapper.find('.text-button')
    expect(button.attributes('disabled')).toBeDefined()

    await button.trigger('click')
    expect(wrapper.emitted('clear')).toBeUndefined()
  })

  it('orderNote 为空时不渲染 · 分隔符', async () => {
    const wrapper = await mountSuspended(SelectionToolbar, {
      props: { ...baseProps, orderNote: '' },
    })
    expect(wrapper.find('p').text()).not.toContain('·')
  })

  it('属性透传至根元素', async () => {
    const wrapper = await mountSuspended(SelectionToolbar, {
      props: baseProps,
      attrs: { 'data-testid': 'selection-toolbar' },
    })
    expect(wrapper.find('.selection-toolbar').attributes('data-testid')).toBe('selection-toolbar')
  })
})
