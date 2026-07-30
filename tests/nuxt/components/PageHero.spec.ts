import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PageHero from '~/components/layout/PageHero.vue'

describe('PageHero', () => {
  it('默认渲染为 header.page-hero，title 进入 h1，可选元素缺席', async () => {
    const wrapper = await mountSuspended(PageHero, {
      props: { title: '单图美学评估' },
    })
    const root = wrapper.find('header')
    expect(root.exists()).toBe(true)
    expect(root.classes()).toEqual(['page-hero'])
    expect(wrapper.find('h1').text()).toBe('单图美学评估')
    expect(wrapper.find('.page-hero-eyebrow').exists()).toBe(false)
    expect(wrapper.find('.page-hero-lede').exists()).toBe(false)
  })

  it('三个 props 齐备时按 eyebrow → h1 → lede 顺序渲染（venus 源结构）', async () => {
    const wrapper = await mountSuspended(PageHero, {
      props: {
        eyebrow: 'SINGLE REVIEW',
        title: '单图美学评估',
        lede: '把作品放回观看的中心，从初评、质疑到仲裁，获得评分、判断依据与改进方向。',
      },
    })
    expect(wrapper.find('.page-hero-eyebrow').text()).toBe('SINGLE REVIEW')
    expect(wrapper.find('h1').text()).toBe('单图美学评估')
    expect(wrapper.find('.page-hero-lede').text())
      .toBe('把作品放回观看的中心，从初评、质疑到仲裁，获得评分、判断依据与改进方向。')

    const children = wrapper.find('.page-hero-copy').element.children
    expect(children[0]?.tagName).toBe('P')
    expect(children[0]?.className).toContain('page-hero-eyebrow')
    expect(children[1]?.tagName).toBe('H1')
    expect(children[2]?.tagName).toBe('P')
    expect(children[2]?.className).toContain('page-hero-lede')
  })

  it('eyebrow 单独缺席时不渲染，lede 照常', async () => {
    const wrapper = await mountSuspended(PageHero, {
      props: { title: '组图联合评估', lede: '把照片作为一个系列，分析整体叙事。' },
    })
    expect(wrapper.find('.page-hero-eyebrow').exists()).toBe(false)
    expect(wrapper.find('.page-hero-lede').text()).toBe('把照片作为一个系列，分析整体叙事。')
  })

  it('lede 单独缺席时不渲染，eyebrow 照常', async () => {
    const wrapper = await mountSuspended(PageHero, {
      props: { eyebrow: 'COMPARATIVE REVIEW', title: '组图对比评估' },
    })
    expect(wrapper.find('.page-hero-eyebrow').text()).toBe('COMPARATIVE REVIEW')
    expect(wrapper.find('.page-hero-lede').exists()).toBe(false)
  })

  // 调用方 class 是既定的语义扩展点，不得被内部 class 覆盖
  it('调用方 class 与内部 class 合并', async () => {
    const wrapper = await mountSuspended(PageHero, {
      props: { title: '单图美学评估' },
      attrs: { class: 'single-hero' },
    })
    const classes = wrapper.find('header').classes()
    expect(classes).toContain('page-hero')
    expect(classes).toContain('single-hero')
  })

  it('属性透传至根元素', async () => {
    const wrapper = await mountSuspended(PageHero, {
      props: { title: '单图美学评估' },
      attrs: { id: 'evaluation-hero' },
    })
    expect(wrapper.find('header').attributes('id')).toBe('evaluation-hero')
  })
})
