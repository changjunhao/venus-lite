import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import SharePreviewModal from '~/components/share/SharePreviewModal.vue'

// venus single.html L191-198 #share-preview 的真实文案
const label = '分享图预览'

// Teleport 渲染进 body 后 wrapper 查询不到，统一 stub 保留在原位（先例 BaseModal.spec L10）
const global = { stubs: { teleport: true } }

const url = 'blob:http://localhost/fake-object-url'

describe('SharePreviewModal', () => {
  it('open 时渲染 header/body/actions 三段，panel 合并 share-preview-panel class', async () => {
    const wrapper = await mountSuspended(SharePreviewModal, {
      props: { open: true, url },
      global,
    })
    const panel = wrapper.find('.modal-panel')
    expect(panel.classes()).toContain('share-preview-panel')

    expect(wrapper.find('.share-preview-header').exists()).toBe(true)
    expect(wrapper.find('.share-preview-title').text()).toBe(label)
    expect(wrapper.find('.share-preview-body').exists()).toBe(true)
    expect(wrapper.find('.share-preview-actions').exists()).toBe(true)
    wrapper.unmount()
  })

  it('open=false 时不渲染任何内容（BaseModal v-if 懒渲染）', async () => {
    const wrapper = await mountSuspended(SharePreviewModal, {
      props: { open: false, url },
      global,
    })
    expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    wrapper.unmount()
  })

  it('img src/alt 绑定 url/imgAlt', async () => {
    const wrapper = await mountSuspended(SharePreviewModal, {
      props: { open: true, url, imgAlt: '生成的分享海报' },
      global,
    })
    const img = wrapper.find('.share-preview-body img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe(url)
    expect(img.attributes('alt')).toBe('生成的分享海报')
    wrapper.unmount()
  })

  it('url=null 时不渲染 img（对齐 app.js L94 removeAttribute src）', async () => {
    const wrapper = await mountSuspended(SharePreviewModal, {
      props: { open: true, url: null },
      global,
    })
    expect(wrapper.find('.share-preview-body img').exists()).toBe(false)
    wrapper.unmount()
  })

  it('下载按钮 emit download', async () => {
    const wrapper = await mountSuspended(SharePreviewModal, {
      props: { open: true, url },
      global,
    })
    const buttons = wrapper.findAll('.share-preview-actions button')
    expect(buttons[0]!.text()).toBe('下载图片')
    await buttons[0]!.trigger('click')
    expect(wrapper.emitted('download')).toHaveLength(1)
    wrapper.unmount()
  })

  it('取消按钮触发 update:open false 与 close', async () => {
    const wrapper = await mountSuspended(SharePreviewModal, {
      props: { open: true, url },
      global,
    })
    const buttons = wrapper.findAll('.share-preview-actions button')
    expect(buttons[1]!.text()).toBe('取消')
    await buttons[1]!.trigger('click')
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('× 关闭按钮触发 update:open false 与 close，aria-label 正确', async () => {
    const wrapper = await mountSuspended(SharePreviewModal, {
      props: { open: true, url },
      global,
    })
    const close = wrapper.find('.share-preview-close')
    expect(close.attributes('aria-label')).toBe('关闭预览')
    await close.trigger('click')
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('panel aria-label 与 dialog 语义来自 BaseModal', async () => {
    const wrapper = await mountSuspended(SharePreviewModal, {
      props: { open: true, url },
      global,
    })
    const panel = wrapper.find('.modal-panel')
    expect(panel.attributes('role')).toBe('dialog')
    expect(panel.attributes('aria-modal')).toBe('true')
    expect(panel.attributes('aria-label')).toBe(label)
    wrapper.unmount()
  })

  it('i18n labels 由调用方传入覆盖默认值', async () => {
    const wrapper = await mountSuspended(SharePreviewModal, {
      props: {
        open: true,
        url,
        label: 'Share image preview',
        downloadLabel: 'Download image',
        cancelLabel: 'Cancel',
        closeAria: 'Close preview',
      },
      global,
    })
    expect(wrapper.find('.share-preview-title').text()).toBe('Share image preview')
    const buttons = wrapper.findAll('.share-preview-actions button')
    expect(buttons[0]!.text()).toBe('Download image')
    expect(buttons[1]!.text()).toBe('Cancel')
    expect(wrapper.find('.share-preview-close').attributes('aria-label')).toBe('Close preview')
    wrapper.unmount()
  })
})
