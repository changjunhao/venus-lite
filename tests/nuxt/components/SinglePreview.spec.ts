import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import SinglePreview from '~/components/upload/SinglePreview.vue'
import type { ExifData } from '#shared/types/evaluation'

const baseProps = {
  src: 'blob:https://localhost/mock-object-url',
  alt: '待评估照片预览',
  fileName: 'photo.jpg',
  fileSize: 1572864, // 1.5 MB
}

const sampleExif: ExifData = {
  cameraModel: 'Canon EOS R5',
  fNumber: 2.8,
  shutterSpeed: '1/125',
  iso: 100,
  focalLength: 35,
}

const sampleLabels = {
  cameraModel: '相机',
  fNumber: '光圈',
  shutterSpeed: '快门',
  iso: 'ISO',
  focalLength: '焦距',
}

describe('SinglePreview', () => {
  it('默认渲染：img src/alt/decoding、角标 SELECTED FRAME、信息行', async () => {
    const wrapper = await mountSuspended(SinglePreview, { props: baseProps })

    const img = wrapper.find('img.preview-image')
    expect(img.attributes('src')).toBe(baseProps.src)
    expect(img.attributes('alt')).toBe(baseProps.alt)
    expect(img.attributes('decoding')).toBe('async')

    const badge = wrapper.find('.single-preview-index')
    expect(badge.text()).toBe('SELECTED FRAME')
    expect(badge.attributes('aria-hidden')).toBe('true')

    expect(wrapper.find('.preview-info').text()).toBe('photo.jpg (1.5 MB)')
  })

  it('imageWidth / imageHeight 透传为 img 属性（防 CLS）', async () => {
    const wrapper = await mountSuspended(SinglePreview, {
      props: { ...baseProps, imageWidth: 6000, imageHeight: 4000 },
    })
    const img = wrapper.find('img.preview-image')
    expect(img.attributes('width')).toBe('6000')
    expect(img.attributes('height')).toBe('4000')
  })

  it('frameLabel 可覆盖（结果区 REVIEWED FRAME 变体）', async () => {
    const wrapper = await mountSuspended(SinglePreview, {
      props: { ...baseProps, frameLabel: 'REVIEWED FRAME' },
    })
    expect(wrapper.find('.single-preview-index').text()).toBe('REVIEWED FRAME')
  })

  it('FileName 截断结构存在且 title 为完整文件名（§13.2）', async () => {
    const wrapper = await mountSuspended(SinglePreview, { props: baseProps })
    const fileName = wrapper.find('.file-name')
    expect(fileName.exists()).toBe(true)
    expect(fileName.attributes('title')).toBe('photo.jpg')
    expect(wrapper.find('.file-stem').text()).toBe('photo')
    expect(wrapper.find('.file-ext').text()).toBe('.jpg')
  })

  it('exif 到达后信息行包含 EXIF 摘要', async () => {
    const wrapper = await mountSuspended(SinglePreview, {
      props: { ...baseProps, exif: sampleExif },
    })
    expect(wrapper.find('.preview-info').text())
      .toBe('photo.jpg (1.5 MB) — Canon EOS R5 · f/2.8 · 1/125 · ISO100 · 35mm')
  })

  it('exif 存在时渲染 ExifTagList 且 labels 透传', async () => {
    const wrapper = await mountSuspended(SinglePreview, {
      props: { ...baseProps, exif: sampleExif, exifLabels: sampleLabels },
    })
    expect(wrapper.find('.exif-preview').exists()).toBe(true)
    const tags = wrapper.findAll('.exif-tag')
    expect(tags).toHaveLength(5)
    expect(tags[0]!.text()).toBe('相机 Canon EOS R5')
  })

  it('exif 为 null 时不渲染 .exif-preview', async () => {
    const wrapper = await mountSuspended(SinglePreview, { props: baseProps })
    expect(wrapper.find('.exif-preview').exists()).toBe(false)
  })

  it('exif 全字段为 null 值时不渲染 .exif-preview', async () => {
    const wrapper = await mountSuspended(SinglePreview, {
      props: { ...baseProps, exif: { cameraModel: undefined, iso: undefined } },
    })
    expect(wrapper.find('.exif-preview').exists()).toBe(false)
  })

  it('exif 异步到达（setProps）后 ExifTagList 挂载且 img src 不变', async () => {
    const wrapper = await mountSuspended(SinglePreview, { props: baseProps })
    expect(wrapper.find('.exif-preview').exists()).toBe(false)

    await wrapper.setProps({ exif: sampleExif, exifLabels: sampleLabels })

    expect(wrapper.find('.exif-preview').exists()).toBe(true)
    expect(wrapper.findAll('.exif-tag')).toHaveLength(5)
    // img 元素不受 EXIF 到达影响（无 :key 重建）
    expect(wrapper.find('img.preview-image').attributes('src')).toBe(baseProps.src)
  })
})
