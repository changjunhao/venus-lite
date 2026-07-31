import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ModeCard from '~/components/home/ModeCard.vue'

/** venus index.html L86-91 源首卡（SINGLE FRAME） */
const visuals = [
  { src: '/assets/editorial/forest.jpg', width: 1000, height: 666 },
]

const requiredProps = {
  number: '01',
  label: 'SINGLE FRAME',
  title: '单图评估',
  ctaLabel: '评估一张作品',
  to: '/single',
}

const fullProps = {
  ...requiredProps,
  description: '分析一张作品的构图、光影、主体、技术完成度与视觉影响力，给出完整裁决和可执行建议。',
  layout: 'single' as const,
  visuals,
}

describe('ModeCard', () => {
  it('渲染为 a.home-mode-card，href 指向 to', async () => {
    const wrapper = await mountSuspended(ModeCard, { props: requiredProps })
    const root = wrapper.find('a')
    expect(root.exists()).toBe(true)
    expect(root.classes()).toContain('home-mode-card')
    expect(root.attributes('href')).toBe('/single')
  })

  it('topline 两个 span 依次为 number / label', async () => {
    const wrapper = await mountSuspended(ModeCard, { props: fullProps })
    const spans = wrapper.find('.home-mode-topline').findAll('span')
    expect(spans.map(span => span.text())).toEqual(['01', 'SINGLE FRAME'])
  })

  it('视觉区 class 随 layout 切换，且整体 aria-hidden', async () => {
    for (const layout of ['single', 'series', 'compare'] as const) {
      const wrapper = await mountSuspended(ModeCard, {
        props: { ...fullProps, layout },
      })
      const visual = wrapper.find('.home-mode-visual')
      expect(visual.classes()).toContain(`mode-visual-${layout}`)
      expect(visual.attributes('aria-hidden')).toBe('true')
    }
  })

  it('visuals 渲染为装饰图，alt 为空并绑定 width/height 与懒加载属性', async () => {
    const wrapper = await mountSuspended(ModeCard, {
      props: {
        ...fullProps,
        layout: 'compare',
        visuals: [
          { src: '/assets/editorial/forest.jpg', width: 1000, height: 666 },
          { src: '/assets/editorial/water.jpg', width: 1000, height: 667 },
        ],
      },
    })
    const images = wrapper.findAll('.home-mode-visual img')
    expect(images).toHaveLength(2)
    expect(images.map(img => img.attributes('src')))
      .toEqual(['/assets/editorial/forest.jpg', '/assets/editorial/water.jpg'])
    images.forEach((img) => {
      expect(img.attributes('alt')).toBe('')
      expect(img.attributes('loading')).toBe('lazy')
      expect(img.attributes('decoding')).toBe('async')
    })
    expect(images[0]?.attributes('width')).toBe('1000')
    expect(images[0]?.attributes('height')).toBe('666')
  })

  it('visual 插槽提供时替换默认图片渲染', async () => {
    const wrapper = await mountSuspended(ModeCard, {
      props: fullProps,
      slots: { visual: () => 'CUSTOM VISUAL' },
    })
    const visual = wrapper.find('.home-mode-visual')
    expect(visual.text()).toBe('CUSTOM VISUAL')
    expect(visual.find('img').exists()).toBe(false)
  })

  it('featured 决定深色反相变体', async () => {
    const plain = await mountSuspended(ModeCard, { props: requiredProps })
    expect(plain.find('a').classes()).not.toContain('home-mode-featured')

    const featured = await mountSuspended(ModeCard, {
      props: { ...requiredProps, featured: true },
    })
    expect(featured.find('a').classes()).toContain('home-mode-featured')
  })

  it('title 渲染 h3，description 缺席时 p 不渲染', async () => {
    const full = await mountSuspended(ModeCard, { props: fullProps })
    expect(full.find('.home-mode-body h3').text()).toBe(fullProps.title)
    expect(full.find('.home-mode-body p').text()).toBe(fullProps.description)

    const bare = await mountSuspended(ModeCard, { props: requiredProps })
    expect(bare.find('.home-mode-body p').exists()).toBe(false)
  })

  it('CTA 渲染文案与装饰箭头', async () => {
    const wrapper = await mountSuspended(ModeCard, { props: fullProps })
    const cta = wrapper.find('strong')
    expect(cta.text()).toContain(fullProps.ctaLabel)
    expect(cta.find('span[aria-hidden="true"]').text()).toBe('→')
  })

  // 回归：反相卡的 CTA 曾因 `.home-mode-featured strong` 与 `.home-mode-card > strong`
  // 特异度相同、后者靠后声明而取到 --ink，在 --darkroom 上近乎不可见（§14.1）。
  // 变体组必须留在基础规则之后，故此处断言样式表内的声明顺序。
  it('featured 变体的颜色覆盖排在基础 strong 规则之后', async () => {
    const { default: source } = await import('~/components/home/ModeCard.vue?raw')
    const baseRule = source.indexOf('.home-mode-card > strong {')
    const featuredRule = source.indexOf('.home-mode-featured > strong')
    expect(baseRule).toBeGreaterThan(-1)
    expect(featuredRule).toBeGreaterThan(baseRule)
  })

  // 调用方 class 是既定的语义扩展点，不得被内部 class 覆盖
  it('调用方 class 与内部 class 合并', async () => {
    const wrapper = await mountSuspended(ModeCard, {
      props: requiredProps,
      attrs: { class: 'home-mode-single' },
    })
    const classes = wrapper.find('a').classes()
    expect(classes).toContain('home-mode-card')
    expect(classes).toContain('home-mode-single')
  })

  it('属性透传至根元素', async () => {
    const wrapper = await mountSuspended(ModeCard, {
      props: requiredProps,
      attrs: { id: 'mode-single' },
    })
    expect(wrapper.find('a').attributes('id')).toBe('mode-single')
  })
})
