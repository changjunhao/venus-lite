import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { Component } from 'vue'
import type { ImageEntry } from '~/composables/useImageSelection'
import PreviewGrid from '~/components/upload/PreviewGrid.vue'

/** nuxt vitest 环境默认 stub TransitionGroup；本组件以 TransitionGroup 为根，
 * 测试需真实渲染（tag="div" + 焦点管理），统一在此解除。 */
function mountGrid(options: Parameters<typeof mountSuspended>[1] = {}) {
  return mountSuspended(PreviewGrid as Component, {
    ...options,
    global: { stubs: { TransitionGroup: false }, ...options?.global },
  })
}

function createEntry(id: string, name = `${id}.jpg`): ImageEntry {
  const file = new File([new ArrayBuffer(1024)], name, { type: 'image/jpeg', lastModified: 1000 })
  return {
    id,
    identity: `${name}:1024:1000`,
    file,
    objectURL: `blob:${id}`,
    width: 3840,
    height: 2160,
  }
}

const threeEntries = [createEntry('image-1'), createEntry('image-2'), createEntry('image-3')]

const baseProps = {
  entries: threeEntries,
  variant: 'joint' as const,
  altTemplate: '第 {index} 张照片：{name}',
  removeLabelTemplate: '移除第 {index} 张照片',
  moveBackLabelTemplate: '将第 {index} 张照片前移',
  moveForwardLabelTemplate: '将第 {index} 张照片后移',
  moveBackText: '前移',
  moveForwardText: '后移',
}

describe('PreviewGrid', () => {
  // 回归锚点：group-joint.html L82 class="group-preview-grid contact-sheet"
  it('joint 变体：根 div 渲染 .group-preview-grid.contact-sheet', async () => {
    const wrapper = await mountGrid({ props: baseProps })
    const root = wrapper.find('div.group-preview-grid')
    expect(root.exists()).toBe(true)
    expect(root.classes()).toContain('contact-sheet')
  })

  // 回归锚点：group-compare.html L82 class="group-preview-grid comparison-grid"
  it('compare 变体：根 div 渲染 .group-preview-grid.comparison-grid', async () => {
    const wrapper = await mountGrid({
      props: { ...baseProps, variant: 'compare' },
    })
    const root = wrapper.find('div.group-preview-grid')
    expect(root.exists()).toBe(true)
    expect(root.classes()).toContain('comparison-grid')
    expect(root.classes()).not.toContain('contact-sheet')
  })

  // 回归锚点：group.js L245-298 forEach 逐卡渲染
  it('3 条 entries 渲染 3 张卡片，编号按序 01/02/03', async () => {
    const wrapper = await mountGrid({ props: baseProps })
    const cards = wrapper.findAll('.group-preview-card')
    expect(cards).toHaveLength(3)

    const numbers = wrapper.findAll('.preview-number').map(n => n.text())
    expect(numbers).toEqual(['01', '02', '03'])
  })

  it('entries 为空时渲染零卡片（空状态语义归 UploadZone）', async () => {
    const wrapper = await mountGrid({
      props: { ...baseProps, entries: [] },
    })
    expect(wrapper.find('.group-preview-grid').exists()).toBe(true)
    expect(wrapper.findAll('.group-preview-card')).toHaveLength(0)
  })

  // 回归锚点：group.js L267 removeFile(entry.id)
  it('remove 事件中继：卡片移除按钮 → emit("remove", id)', async () => {
    const wrapper = await mountGrid({ props: baseProps })
    const cards = wrapper.findAll('.group-preview-card')
    await cards[1]!.find('.preview-remove').trigger('click')
    expect(wrapper.emitted('remove')?.[0]).toEqual(['image-2'])
  })

  // 回归锚点：group.js L285/L292 moveFile(entry.id, direction)
  it('move 事件中继：后移按钮 → emit("move", id, 1)', async () => {
    const wrapper = await mountGrid({ props: baseProps })
    const cards = wrapper.findAll('.group-preview-card')
    await cards[0]!.find('[data-move="forward"]').trigger('click')
    expect(wrapper.emitted('move')?.[0]).toEqual(['image-1', 1])
  })

  it('move 事件中继：前移按钮 → emit("move", id, -1)', async () => {
    const wrapper = await mountGrid({ props: baseProps })
    const cards = wrapper.findAll('.group-preview-card')
    await cards[2]!.find('[data-move="back"]').trigger('click')
    expect(wrapper.emitted('move')?.[0]).toEqual(['image-3', -1])
  })

  // 模板插值：{index} → 1-based，{name} → 文件名
  it('altTemplate 插值：第 N 张照片 + 文件名', async () => {
    const wrapper = await mountGrid({ props: baseProps })
    const alts = wrapper.findAll('.preview-media img').map(img => img.attributes('alt'))
    expect(alts).toEqual([
      '第 1 张照片：image-1.jpg',
      '第 2 张照片：image-2.jpg',
      '第 3 张照片：image-3.jpg',
    ])
  })

  it('aria-label 模板插值：移除/前移/后移', async () => {
    const wrapper = await mountGrid({ props: baseProps })
    const card = wrapper.findAll('.group-preview-card')[2]!
    expect(card.find('.preview-remove').attributes('aria-label')).toBe('移除第 3 张照片')
    expect(card.find('[data-move="back"]').attributes('aria-label')).toBe('将第 3 张照片前移')
    expect(card.find('[data-move="forward"]').attributes('aria-label')).toBe('将第 3 张照片后移')
  })

  // 回归锚点：group.js L266/L283/L290 isLoading 全禁用
  it('disabled=true 透传至所有卡片按钮', async () => {
    const wrapper = await mountGrid({
      props: { ...baseProps, disabled: true },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBeGreaterThan(0)
    for (const button of buttons) {
      expect(button.attributes('disabled')).toBeDefined()
    }
  })

  // 回归锚点：group.js L222 移动后焦点管理
  it('移动后焦点落在目标位置卡片的首个移动按钮（贴源 querySelector 语义）', async () => {
    const wrapper = await mountGrid({
      props: baseProps,
      attachTo: document.body,
    })

    // 点击第 2 张（index=1）的后移按钮 → 焦点应落在 children[2] 的前移按钮
    const cards = wrapper.findAll('.group-preview-card')
    await cards[1]!.find('[data-move="forward"]').trigger('click')

    const active = document.activeElement as HTMLElement | null
    expect(active?.getAttribute('data-move')).toBe('back')
    // 目标为网格中第 3 个位置的卡片的按钮
    const gridChildren = wrapper.find('.group-preview-grid').element.children
    expect(gridChildren[2]?.contains(active)).toBe(true)

    wrapper.unmount()
  })

  it('属性透传至 TransitionGroup 根 div', async () => {
    const wrapper = await mountGrid({
      props: baseProps,
      attrs: { 'data-testid': 'preview-grid' },
    })
    expect(wrapper.find('.group-preview-grid').attributes('data-testid')).toBe('preview-grid')
  })
})
