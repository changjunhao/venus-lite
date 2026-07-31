import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import UploadZone from '~/components/upload/UploadZone.vue'

describe('UploadZone', () => {
  const baseProps = {
    title: '拖入一张照片，或点击选择',
    hint: '4K 以下支持 JPEG、PNG、WebP、BMP、TIFF 和 HEIC；4K–8K 仅支持 JPEG 或 PNG',
  }

  it('默认渲染：role="button"、tabindex="0"、aria-describedby 关联 hint、隐藏 input 存在', async () => {
    const wrapper = await mountSuspended(UploadZone, { props: baseProps })
    const zone = wrapper.find('.upload-zone')
    expect(zone.attributes('role')).toBe('button')
    expect(zone.attributes('tabindex')).toBe('0')

    const hint = wrapper.find('.upload-hint')
    expect(hint.exists()).toBe(true)
    expect(zone.attributes('aria-describedby')).toBe(hint.attributes('id'))

    const input = wrapper.find('input[type="file"]')
    expect(input.exists()).toBe(true)
    expect(input.attributes('multiple')).toBeUndefined()
  })

  it('hint 缺省时不渲染 p 且不带 aria-describedby', async () => {
    const wrapper = await mountSuspended(UploadZone, {
      props: { title: baseProps.title },
    })
    expect(wrapper.find('.upload-hint').exists()).toBe(false)
    expect(wrapper.find('.upload-zone').attributes('aria-describedby')).toBeUndefined()
  })

  it('multiple 与 accept 透传至 input', async () => {
    const wrapper = await mountSuspended(UploadZone, {
      props: { ...baseProps, multiple: true, accept: 'image/jpeg,image/png' },
    })
    const input = wrapper.find('input[type="file"]')
    expect(input.attributes('multiple')).toBeDefined()
    expect(input.attributes('accept')).toBe('image/jpeg,image/png')
  })

  it('accept 默认值包含 image/jpeg', async () => {
    const wrapper = await mountSuspended(UploadZone, { props: baseProps })
    expect(wrapper.find('input[type="file"]').attributes('accept')).toContain('image/jpeg')
  })

  it('点击区域触发 input.click', async () => {
    const wrapper = await mountSuspended(UploadZone, { props: baseProps })
    const input = wrapper.find('input[type="file"]').element as HTMLInputElement
    const clickSpy = vi.spyOn(input, 'click')
    await wrapper.find('.upload-zone').trigger('click')
    expect(clickSpy).toHaveBeenCalledOnce()
  })

  it.each(['Enter', ' '])('键盘 %s 触发 input.click', async (key) => {
    const wrapper = await mountSuspended(UploadZone, { props: baseProps })
    const input = wrapper.find('input[type="file"]').element as HTMLInputElement
    const clickSpy = vi.spyOn(input, 'click')
    await wrapper.find('.upload-zone').trigger('keydown', { key })
    expect(clickSpy).toHaveBeenCalledOnce()
  })

  it('其他按键不触发 input.click', async () => {
    const wrapper = await mountSuspended(UploadZone, { props: baseProps })
    const input = wrapper.find('input[type="file"]').element as HTMLInputElement
    const clickSpy = vi.spyOn(input, 'click')
    await wrapper.find('.upload-zone').trigger('keydown', { key: 'Tab' })
    expect(clickSpy).not.toHaveBeenCalled()
  })

  it('dragEnter 添加 drag-over class；拖经子元素（计数未归零）时 class 保留', async () => {
    const wrapper = await mountSuspended(UploadZone, { props: baseProps })
    const zone = wrapper.find('.upload-zone')

    await zone.trigger('dragenter')
    expect(zone.classes()).toContain('drag-over')

    // 子元素进出：再次 dragenter 后一次 dragleave，深度计数仍 > 0
    await zone.trigger('dragenter')
    await zone.trigger('dragleave')
    expect(zone.classes()).toContain('drag-over')
  })

  it('dragLeave 归零后移除 drag-over class', async () => {
    const wrapper = await mountSuspended(UploadZone, { props: baseProps })
    const zone = wrapper.find('.upload-zone')

    await zone.trigger('dragenter')
    await zone.trigger('dragleave')
    expect(zone.classes()).not.toContain('drag-over')
  })

  it('drop 发射 files 快照数组并清除 drag-over', async () => {
    const wrapper = await mountSuspended(UploadZone, { props: baseProps })
    const zone = wrapper.find('.upload-zone')
    const file = new File([''], 'photo.jpg', { type: 'image/jpeg' })

    await zone.trigger('dragenter')
    await zone.trigger('drop', { dataTransfer: { files: [file] } })

    expect(zone.classes()).not.toContain('drag-over')
    const emitted = wrapper.emitted('files')
    expect(emitted).toHaveLength(1)
    expect(Array.isArray(emitted?.[0]?.[0])).toBe(true)
    expect(emitted?.[0]?.[0]).toEqual([file])
  })

  it('drop 空文件列表不发射事件', async () => {
    const wrapper = await mountSuspended(UploadZone, { props: baseProps })
    await wrapper.find('.upload-zone').trigger('drop', { dataTransfer: { files: [] } })
    expect(wrapper.emitted('files')).toBeUndefined()
  })

  it('input change 发射 files 并重置 value（允许重选同一文件）', async () => {
    const wrapper = await mountSuspended(UploadZone, { props: baseProps })
    const input = wrapper.find('input[type="file"]')
    const file = new File([''], 'photo.png', { type: 'image/png' })

    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')

    const emitted = wrapper.emitted('files')
    expect(emitted).toHaveLength(1)
    expect(emitted?.[0]?.[0]).toEqual([file])
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('disabled 时 click / keydown / drop 均不触发，aria-disabled 标记', async () => {
    const wrapper = await mountSuspended(UploadZone, {
      props: { ...baseProps, disabled: true },
    })
    const zone = wrapper.find('.upload-zone')
    expect(zone.attributes('aria-disabled')).toBe('true')

    const input = wrapper.find('input[type="file"]').element as HTMLInputElement
    const clickSpy = vi.spyOn(input, 'click')

    await zone.trigger('click')
    await zone.trigger('keydown', { key: 'Enter' })
    expect(clickSpy).not.toHaveBeenCalled()

    const file = new File([''], 'photo.jpg', { type: 'image/jpeg' })
    await zone.trigger('drop', { dataTransfer: { files: [file] } })
    expect(wrapper.emitted('files')).toBeUndefined()
  })

  it('disabled 时 dragenter 不添加 drag-over', async () => {
    const wrapper = await mountSuspended(UploadZone, {
      props: { ...baseProps, disabled: true },
    })
    const zone = wrapper.find('.upload-zone')
    await zone.trigger('dragenter')
    expect(zone.classes()).not.toContain('drag-over')
  })

  it('拖拽态标题切换为 dragTitle，离开后恢复 title', async () => {
    const wrapper = await mountSuspended(UploadZone, {
      props: { ...baseProps, dragTitle: '松开以添加照片' },
    })
    const zone = wrapper.find('.upload-zone')
    const title = wrapper.find('.upload-title')

    expect(title.text()).toBe(baseProps.title)
    await zone.trigger('dragenter')
    expect(title.text()).toBe('松开以添加照片')
    await zone.trigger('dragleave')
    expect(title.text()).toBe(baseProps.title)
  })

  it('dragTitle 缺省时拖拽态保持 title', async () => {
    const wrapper = await mountSuspended(UploadZone, { props: baseProps })
    await wrapper.find('.upload-zone').trigger('dragenter')
    expect(wrapper.find('.upload-title').text()).toBe(baseProps.title)
  })

  it('icon slot 自定义内容渲染', async () => {
    const wrapper = await mountSuspended(UploadZone, {
      props: baseProps,
      slots: { icon: '<svg class="custom-icon" />' },
    })
    expect(wrapper.find('.upload-icon .custom-icon').exists()).toBe(true)
  })

  it('默认渲染 32px 相机 SVG，容器 aria-hidden', async () => {
    const wrapper = await mountSuspended(UploadZone, { props: baseProps })
    const icon = wrapper.find('.upload-icon')
    expect(icon.attributes('aria-hidden')).toBe('true')
    expect(icon.find('svg').attributes('width')).toBe('32')
    expect(icon.find('svg').attributes('height')).toBe('32')
  })
})
