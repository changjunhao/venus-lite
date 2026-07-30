import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { h, nextTick } from 'vue'
import BaseModal from '~/components/ui/BaseModal.vue'

// venus single.html 分享图预览弹窗的真实文案
const label = '分享图预览'

// Teleport 渲染进 body 后 wrapper 查询不到，统一 stub 保留在原位
const global = { stubs: { teleport: true } }

// venus 分享弹窗操作区的两个按钮，兼作 focus trap 的首/末 focusable
const slots = {
  default: () => [
    h('button', { type: 'button', class: 'action-download' }, '下载图片'),
    h('button', { type: 'button', class: 'action-cancel' }, '取消'),
  ],
}

describe('BaseModal', () => {
  it('open 时渲染 dialog 语义：role/aria-modal/aria-label/tabindex，backdrop aria-hidden', async () => {
    const wrapper = await mountSuspended(BaseModal, {
      props: { open: true, label },
      slots,
      global,
    })
    const panel = wrapper.find('.modal-panel')
    expect(panel.attributes('role')).toBe('dialog')
    expect(panel.attributes('aria-modal')).toBe('true')
    expect(panel.attributes('aria-label')).toBe(label)
    expect(panel.attributes('tabindex')).toBe('-1')

    const backdrop = wrapper.find('.modal-backdrop')
    expect(backdrop.attributes('aria-hidden')).toBe('true')
    wrapper.unmount()
  })

  it('open=false 时不渲染任何内容（v-if 懒渲染）', async () => {
    const wrapper = await mountSuspended(BaseModal, {
      props: { open: false, label },
      slots,
      global,
    })
    expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    wrapper.unmount()
  })

  it('default slot 渲染进 panel，作用域插槽 close 触发 update:open 与 close', async () => {
    const wrapper = await mountSuspended(BaseModal, {
      props: { open: true, label },
      slots: {
        default: ({ close }: { close: () => void }) =>
          h('button', { type: 'button', class: 'via-close', onClick: close }, '取消'),
      },
      global,
    })
    const button = wrapper.find('.modal-panel .via-close')
    expect(button.text()).toBe('取消')

    await button.trigger('click')
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('点击 backdrop 关闭，点击 panel 内部不关闭', async () => {
    const inert = await mountSuspended(BaseModal, {
      props: { open: true, label },
      slots,
      global,
    })
    await inert.find('.modal-panel').trigger('click')
    expect(inert.emitted('update:open')).toBeUndefined()
    expect(inert.emitted('close')).toBeUndefined()
    inert.unmount()

    const wrapper = await mountSuspended(BaseModal, {
      props: { open: true, label },
      slots,
      global,
    })
    await wrapper.find('.modal-backdrop').trigger('click')
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('document 上的 Escape 关闭弹层', async () => {
    const wrapper = await mountSuspended(BaseModal, {
      props: { open: true, label },
      slots,
      global,
    })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  // 调用方 class 是既定的样式扩展点（对齐 BaseCard/BaseSelect/BaseSwitch 约定），落在 panel 上
  it('调用方 class 与 panel 内部 class 合并', async () => {
    const wrapper = await mountSuspended(BaseModal, {
      props: { open: true, label },
      slots,
      global,
      attrs: { class: 'share-preview-panel' },
    })
    const classes = wrapper.find('.modal-panel').classes()
    expect(classes).toContain('modal-panel')
    expect(classes).toContain('share-preview-panel')
    wrapper.unmount()
  })

  it('focus trap：打开聚焦首个 focusable，Tab 在首末之间循环', async () => {
    // focus/activeElement 只对文档内元素生效，本用例需挂进真实 document；
    // 挂载后再打开（真实交互路径），避开 Suspense 首次渲染重建 DOM 导致的焦点丢失
    const wrapper = await mountSuspended(BaseModal, {
      props: { open: false, label },
      slots,
      global,
      attachTo: document.body,
    })
    await wrapper.setProps({ open: true })
    await nextTick()
    await nextTick()
    const first = wrapper.find('.action-download').element as HTMLButtonElement
    const last = wrapper.find('.action-cancel').element as HTMLButtonElement
    expect(document.activeElement).toBe(first)

    // 末位 Tab → 回首位
    last.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
    expect(document.activeElement).toBe(first)

    // 首位 Shift+Tab → 到末位
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }))
    expect(document.activeElement).toBe(last)
    wrapper.unmount()
  })
})
