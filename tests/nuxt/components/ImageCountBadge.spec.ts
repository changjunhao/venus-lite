import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ImageCountBadge from '~/components/ui/ImageCountBadge.vue'

describe('ImageCountBadge', () => {
  it('默认渲染为 group 变体：0 / 10 FRAMES', async () => {
    const wrapper = await mountSuspended(ImageCountBadge)
    const badge = wrapper.find('div')
    expect(badge.exists()).toBe(true)
    expect(badge.classes()).toEqual(['image-count-badge'])
    expect(badge.attributes('aria-label')).toBe('已选照片数量')
    expect(wrapper.find('strong').text()).toBe('0')
    expect(wrapper.find('span').text()).toBe('/ 10 FRAMES')
  })

  // 回归锚点：venus group.js L236 为 String(count)，无补零
  it('count 渲染为原始数字，不补零', async () => {
    const wrapper = await mountSuspended(ImageCountBadge, { props: { count: 7 } })
    expect(wrapper.find('strong').text()).toBe('7')
  })

  it('max 驱动标签文案', async () => {
    const wrapper = await mountSuspended(ImageCountBadge, { props: { max: 6 } })
    expect(wrapper.find('span').text()).toBe('/ 6 FRAMES')
  })

  // venus single.html L61-63：完全静态，count/max 不参与输出
  it('single 变体静态输出 01 ONE FRAME，忽略 count', async () => {
    const wrapper = await mountSuspended(ImageCountBadge, {
      props: { variant: 'single', count: 5 },
    })
    const badge = wrapper.find('div')
    expect(badge.classes()).toContain('image-count-badge')
    expect(badge.classes()).toContain('single-image-badge')
    expect(badge.attributes('aria-label')).toBe('单张照片')
    expect(wrapper.find('strong').text()).toBe('01')
    expect(wrapper.find('span').text()).toBe('ONE FRAME')
  })

  // 调用方 class 是既定的样式扩展点，不得被内部 class 覆盖
  it('调用方 class 与内部 class 合并', async () => {
    const wrapper = await mountSuspended(ImageCountBadge, {
      attrs: { class: 'sheet-badge' },
    })
    const classes = wrapper.find('div').classes()
    expect(classes).toContain('image-count-badge')
    expect(classes).toContain('sheet-badge')
  })

  it('属性透传至根元素，aria-label 可被调用方覆盖', async () => {
    const wrapper = await mountSuspended(ImageCountBadge, {
      attrs: { 'data-testid': 'count-badge', 'aria-label': '已选作品数量' },
    })
    const badge = wrapper.find('div')
    expect(badge.attributes('data-testid')).toBe('count-badge')
    expect(badge.attributes('aria-label')).toBe('已选作品数量')
  })
})
