import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ExifTagList, { EXIF_FIELD_ORDER, formatExifSummary, formatExifValue } from '~/components/upload/ExifTagList.vue'
import type { ExifData } from '#shared/types/evaluation'

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

const fullLabels = {
  cameraModel: '相机',
  lensModel: '镜头',
  fNumber: '光圈',
  shutterSpeed: '快门',
  iso: 'ISO',
  focalLength: '焦距',
  dateTimeOriginal: '拍摄',
  flash: '闪光灯',
}

describe('ExifTagList', () => {
  it('全字段 exif 渲染 8 个标签，顺序为 EXIF_FIELD_ORDER', async () => {
    const wrapper = await mountSuspended(ExifTagList, {
      props: { exif: fullExif, labels: fullLabels },
    })
    const tags = wrapper.findAll('.exif-tag')
    expect(tags).toHaveLength(8)
    // 标签顺序与 EXIF_FIELD_ORDER 一致（经 labels 映射验证）
    tags.forEach((tag, index) => {
      const key = EXIF_FIELD_ORDER[index]!
      expect(tag.text()).toContain(fullLabels[key])
    })
  })

  it('null 值字段被跳过', async () => {
    const wrapper = await mountSuspended(ExifTagList, {
      props: { exif: { cameraModel: 'Sony A7M4', iso: null as unknown as number }, labels: fullLabels },
    })
    const tags = wrapper.findAll('.exif-tag')
    expect(tags).toHaveLength(1)
    expect(tags[0]!.text()).toBe('相机 Sony A7M4')
  })

  it('fNumber 格式化为 f/x.x，focalLength 格式化为 xmm', async () => {
    const wrapper = await mountSuspended(ExifTagList, {
      props: { exif: { fNumber: 2.8, focalLength: 35 }, labels: fullLabels },
    })
    const tags = wrapper.findAll('.exif-tag')
    expect(tags[0]!.text()).toBe('光圈 f/2.8')
    expect(tags[1]!.text()).toBe('焦距 35mm')
  })

  it('labels 缺键时回退原始字段名', async () => {
    const wrapper = await mountSuspended(ExifTagList, {
      props: { exif: { iso: 400 }, labels: {} },
    })
    expect(wrapper.find('.exif-tag').text()).toBe('iso 400')
  })

  it('title 属性为「label value」', async () => {
    const wrapper = await mountSuspended(ExifTagList, {
      props: { exif: { shutterSpeed: '1/250' }, labels: { shutterSpeed: '快门' } },
    })
    expect(wrapper.find('.exif-tag').attributes('title')).toBe('快门 1/250')
  })

  it('空 exif 对象渲染空网格', async () => {
    const wrapper = await mountSuspended(ExifTagList, {
      props: { exif: {}, labels: fullLabels },
    })
    expect(wrapper.find('.exif-preview-grid').exists()).toBe(true)
    expect(wrapper.findAll('.exif-tag')).toHaveLength(0)
  })
})

describe('formatExifValue', () => {
  it('fNumber 数值格式化为 f/x.x', () => {
    expect(formatExifValue('fNumber', 2.8)).toBe('f/2.8')
    expect(formatExifValue('fNumber', 4)).toBe('f/4.0')
  })

  it('focalLength 数值格式化为 xmm', () => {
    expect(formatExifValue('focalLength', 35)).toBe('35mm')
  })

  it('其余字段原样转字符串', () => {
    expect(formatExifValue('iso', 100)).toBe('100')
    expect(formatExifValue('shutterSpeed', '1/125')).toBe('1/125')
    expect(formatExifValue('cameraModel', 'Canon EOS R5')).toBe('Canon EOS R5')
  })
})

describe('formatExifSummary', () => {
  it('全字段返回精确摘要串', () => {
    expect(formatExifSummary(fullExif)).toBe(' — Canon EOS R5 · f/2.8 · 1/125 · ISO100 · 35mm')
  })

  it('部分字段仅包含参与项', () => {
    expect(formatExifSummary({ cameraModel: 'Fujifilm X-T5', iso: 200 })).toBe(' — Fujifilm X-T5 · ISO200')
  })

  it('lensModel / dateTimeOriginal / flash 不参与摘要', () => {
    expect(formatExifSummary({ lensModel: 'RF 28-70mm', dateTimeOriginal: '2024-01-15', flash: 'Fired' })).toBe('')
  })

  it('null / undefined / 空对象返回空串', () => {
    expect(formatExifSummary(null)).toBe('')
    expect(formatExifSummary(undefined)).toBe('')
    expect(formatExifSummary({})).toBe('')
  })
})
