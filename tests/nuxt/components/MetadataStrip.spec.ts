import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MetadataStrip from '~/components/evaluation/MetadataStrip.vue'

/** 组图场景 4 项（group-joint.html L157-160） */
const groupItems = [
  { label: '照片数量', value: '4' },
  { label: '评估耗时', value: '12.3 秒' },
  { label: '评估轮次', value: '2' },
  { label: '评估时间', value: '07/31 14:30' },
]

/** 单图场景 3 项（single.html L175-177） */
const singleItems = [
  { label: '评估耗时', value: '450 毫秒' },
  { label: '评估轮次', value: '-' },
  { label: '评估时间', value: '07/31 14:30' },
]

describe('MetadataStrip', () => {
  // ── 结构回归（锚点 single.html L173-185 / group-joint.html L156-161）──

  it('渲染 .metadata-strip 根节点与完整网格结构', async () => {
    const wrapper = await mountSuspended(MetadataStrip, {
      props: { items: groupItems },
    })
    expect(wrapper.classes()).toContain('metadata-strip')
    expect(wrapper.find('.metadata').exists()).toBe(true)
    expect(wrapper.findAll('.meta-item')).toHaveLength(4)
    expect(wrapper.find('.meta-value').exists()).toBe(true)
    expect(wrapper.find('.meta-label').exists()).toBe(true)
  })

  it('每个 meta-item 含 value 与 label，value 在前（venus HTML 顺序）', async () => {
    const wrapper = await mountSuspended(MetadataStrip, {
      props: { items: groupItems },
    })
    const first = wrapper.find('.meta-item')
    const children = first.findAll('div')
    expect(children).toHaveLength(2)
    expect(children[0]!.classes()).toContain('meta-value')
    expect(children[1]!.classes()).toContain('meta-label')
  })

  // ── 按传入项渲染（component-plan L125）──

  it('组图场景渲染 4 项且值/标签文本正确', async () => {
    const wrapper = await mountSuspended(MetadataStrip, {
      props: { items: groupItems },
    })
    const items = wrapper.findAll('.meta-item')
    expect(items).toHaveLength(4)
    expect(items[0]!.find('.meta-value').text()).toBe('4')
    expect(items[0]!.find('.meta-label').text()).toBe('照片数量')
    expect(items[1]!.find('.meta-value').text()).toBe('12.3 秒')
    expect(items[1]!.find('.meta-label').text()).toBe('评估耗时')
    expect(items[2]!.find('.meta-value').text()).toBe('2')
    expect(items[2]!.find('.meta-label').text()).toBe('评估轮次')
    expect(items[3]!.find('.meta-value').text()).toBe('07/31 14:30')
    expect(items[3]!.find('.meta-label').text()).toBe('评估时间')
  })

  it('单图场景仅渲染 3 项', async () => {
    const wrapper = await mountSuspended(MetadataStrip, {
      props: { items: singleItems },
    })
    const items = wrapper.findAll('.meta-item')
    expect(items).toHaveLength(3)
    expect(items[0]!.find('.meta-label').text()).toBe('评估耗时')
  })

  // ── 边界（DESIGN §2.5「为空时不显示容器」）──

  it('items 为空数组时不渲染', async () => {
    const wrapper = await mountSuspended(MetadataStrip, {
      props: { items: [] },
    })
    expect(wrapper.find('.metadata-strip').exists()).toBe(false)
  })

  // ── 尾部操作 slot（single.html L179-184 .share-action）──

  it('提供 actions slot 时渲染 .metadata-actions 与 slot 内容', async () => {
    const wrapper = await mountSuspended(MetadataStrip, {
      props: { items: singleItems },
      slots: { actions: '<button id="share-btn">生成分享图</button>' },
    })
    const actions = wrapper.find('.metadata-actions')
    expect(actions.exists()).toBe(true)
    expect(actions.find('#share-btn').text()).toBe('生成分享图')
  })

  it('未提供 actions slot 时不渲染 .metadata-actions（组图页场景）', async () => {
    const wrapper = await mountSuspended(MetadataStrip, {
      props: { items: groupItems },
    })
    expect(wrapper.find('.metadata-actions').exists()).toBe(false)
  })

  // ── attrs 透传（先例 ResultMasthead.spec.ts）──

  it('attrs 落根元素', async () => {
    const wrapper = await mountSuspended(MetadataStrip, {
      props: { items: groupItems },
      attrs: { id: 'result-metadata', class: 'extra' },
    })
    expect(wrapper.attributes('id')).toBe('result-metadata')
    expect(wrapper.classes()).toContain('extra')
    expect(wrapper.classes()).toContain('metadata-strip')
  })
})
