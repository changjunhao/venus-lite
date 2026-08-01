import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ExifPanel from '~/components/evaluation/ExifPanel.vue'
import { EXIF_FIELD_ORDER } from '~/components/upload/ExifTagList.vue'
import type { ExifData } from '#shared/types/evaluation'

// 回归锚点：app.js L576-610 renderExifSection（结果区长标签 L584-593）
const fullExif: ExifData = {
  cameraModel: 'Canon EOS R5',
  lensModel: 'RF 50mm F1.2L',
  fNumber: 2.8,
  shutterSpeed: '1/125',
  iso: 100,
  focalLength: 35,
  dateTimeOriginal: '2024-01-15 10:30',
  flash: 'No Flash',
}

// 结果区长标签（对齐 app.js L584-593，与 upload.exif.* 短标签为有意双键集）
const resultLabels = {
  cameraModel: '相机型号',
  lensModel: '镜头型号',
  fNumber: '光圈',
  shutterSpeed: '快门速度',
  iso: 'ISO',
  focalLength: '焦距',
  dateTimeOriginal: '拍摄时间',
  flash: '闪光灯',
}

describe('ExifPanel', () => {
  // ── 边界（回归锚点：app.js L578-581 空则隐藏；DESIGN §2.5「为空时不显示容器」）──

  it('exif 为 null 时不渲染折叠壳', async () => {
    const wrapper = await mountSuspended(ExifPanel, {
      props: { exif: null, title: 'EXIF 拍摄信息', labels: resultLabels },
    })
    expect(wrapper.find('.collapsible').exists()).toBe(false)
  })

  it('exif 为空对象时不渲染折叠壳', async () => {
    const wrapper = await mountSuspended(ExifPanel, {
      props: { exif: {}, title: 'EXIF 拍摄信息', labels: resultLabels },
    })
    expect(wrapper.find('.collapsible').exists()).toBe(false)
  })

  it('全字段 null 时不渲染折叠壳', async () => {
    const wrapper = await mountSuspended(ExifPanel, {
      props: { exif: { iso: null as unknown as number }, title: 'EXIF 拍摄信息', labels: resultLabels },
    })
    expect(wrapper.find('.collapsible').exists()).toBe(false)
  })

  // ── 结构（回归锚点：single.html L166-171 #exif-section / app.js L595-608）──

  it('fullExif 渲染 8 个 exif-item，顺序为 EXIF_FIELD_ORDER', async () => {
    const wrapper = await mountSuspended(ExifPanel, {
      props: { exif: fullExif, title: 'EXIF 拍摄信息', labels: resultLabels },
    })
    const items = wrapper.findAll('.exif-item')
    expect(items).toHaveLength(8)
    items.forEach((item, index) => {
      const key = EXIF_FIELD_ORDER[index]!
      expect(item.find('.exif-label').text()).toBe(resultLabels[key])
    })
  })

  it('每项为 exif-label + exif-value 分离双行，文本独立', async () => {
    const wrapper = await mountSuspended(ExifPanel, {
      props: { exif: { cameraModel: 'Sony A7M4' }, title: 'EXIF 拍摄信息', labels: resultLabels },
    })
    const item = wrapper.find('.exif-item')
    expect(item.find('.exif-label').text()).toBe('相机型号')
    expect(item.find('.exif-value').text()).toBe('Sony A7M4')
  })

  it('fNumber 格式化为 f/x.x，focalLength 格式化为 xmm', async () => {
    const wrapper = await mountSuspended(ExifPanel, {
      props: { exif: { fNumber: 2.8, focalLength: 35 }, title: 'EXIF 拍摄信息', labels: resultLabels },
    })
    const values = wrapper.findAll('.exif-value')
    expect(values[0]!.text()).toBe('f/2.8')
    expect(values[1]!.text()).toBe('35mm')
  })

  it('title 渲染于 collapsible-title', async () => {
    const wrapper = await mountSuspended(ExifPanel, {
      props: { exif: fullExif, title: 'EXIF 拍摄信息', labels: resultLabels },
    })
    expect(wrapper.find('.collapsible-title').text()).toBe('EXIF 拍摄信息')
  })

  // 回归锚点：single.html L167 class="collapsible open" aria-expanded="true"
  it('默认展开', async () => {
    const wrapper = await mountSuspended(ExifPanel, {
      props: { exif: fullExif, title: 'EXIF 拍摄信息', labels: resultLabels },
    })
    expect(wrapper.find('.collapsible-header').attributes('aria-expanded')).toBe('true')
  })

  it('open: false 初始折叠', async () => {
    const wrapper = await mountSuspended(ExifPanel, {
      props: { exif: fullExif, title: 'EXIF 拍摄信息', labels: resultLabels, open: false },
    })
    expect(wrapper.find('.collapsible-header').attributes('aria-expanded')).toBe('false')
  })

  // ── 交互 ──

  it('点击 header 发出 update:open', async () => {
    const wrapper = await mountSuspended(ExifPanel, {
      props: { exif: fullExif, title: 'EXIF 拍摄信息', labels: resultLabels },
    })
    await wrapper.find('.collapsible-header').trigger('click')
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  // ── 回退与透传 ──

  // 回归锚点：app.js L598 labels[key] || key
  it('labels 缺键时回退原始字段名', async () => {
    const wrapper = await mountSuspended(ExifPanel, {
      props: { exif: { iso: 400 }, title: 'EXIF 拍摄信息', labels: {} },
    })
    expect(wrapper.find('.exif-label').text()).toBe('iso')
    expect(wrapper.find('.exif-value').text()).toBe('400')
  })

  it('属性透传至根元素', async () => {
    const wrapper = await mountSuspended(ExifPanel, {
      props: { exif: fullExif, title: 'EXIF 拍摄信息', labels: resultLabels },
      attrs: { id: 'exif-section' },
    })
    expect(wrapper.find('.collapsible').attributes('id')).toBe('exif-section')
  })
})
