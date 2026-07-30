import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import StarMark from '~/components/ui/StarMark.vue'

// venus 源标记（四页导航/页脚逐字一致），作为图形保真的回归锚点
const SOURCE_PATH_D = 'M16 0L18.5 13.5L32 16L18.5 18.5L16 32L13.5 18.5L0 16L13.5 13.5L16 0Z'

describe('StarMark', () => {
  it('默认渲染为 22px 的 svg，viewBox 固定 32 网格', async () => {
    const wrapper = await mountSuspended(StarMark)
    const svg = wrapper.find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.attributes('width')).toBe('22')
    expect(svg.attributes('height')).toBe('22')
    expect(svg.attributes('viewBox')).toBe('0 0 32 32')
  })

  // venus 实际尺寸档：导航 24（首页）/ 22（评估页）、页脚 18（§4.1 最小值）
  it.each([24, 18])('size %d 同步映射 width/height，viewBox 不变', async (size) => {
    const wrapper = await mountSuspended(StarMark, { props: { size } })
    const svg = wrapper.find('svg')
    expect(svg.attributes('width')).toBe(String(size))
    expect(svg.attributes('height')).toBe(String(size))
    expect(svg.attributes('viewBox')).toBe('0 0 32 32')
  })

  // 图形保真：path 与 venus 源逐字相等，颜色只经 currentColor 继承（无 color prop）
  it('path 逐字复刻 venus 源标记且 fill 为 currentColor', async () => {
    const wrapper = await mountSuspended(StarMark)
    const path = wrapper.find('path')
    expect(path.attributes('d')).toBe(SOURCE_PATH_D)
    expect(path.attributes('fill')).toBe('currentColor')
  })

  // §14.4：装饰性星芒对屏幕阅读器隐藏
  it('aria-hidden="true" 恒在', async () => {
    const wrapper = await mountSuspended(StarMark)
    expect(wrapper.find('svg').attributes('aria-hidden')).toBe('true')
  })

  // 调用方 class 是既定的样式扩展点（如品牌区定位），不得被内部覆盖
  it('调用方 class 合并至根元素', async () => {
    const wrapper = await mountSuspended(StarMark, {
      attrs: { class: 'brand-mark' },
    })
    expect(wrapper.find('svg').classes()).toContain('brand-mark')
  })

  it('属性透传至根元素', async () => {
    const wrapper = await mountSuspended(StarMark, {
      attrs: { 'data-testid': 'brand-star' },
    })
    expect(wrapper.find('svg').attributes('data-testid')).toBe('brand-star')
  })
})
