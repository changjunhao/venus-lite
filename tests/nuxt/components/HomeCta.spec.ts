import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import HomeCta from '~/components/home/HomeCta.vue'

/** venus index.html L145-150 源文案 */
const fullProps = {
  eyebrow: 'READY',
  title: '从一张照片开始。',
  lede: '上传作品，查看从初评、质疑到仲裁的完整评估结果。',
  ctaLabel: '开始单图评估',
}

const requiredProps = {
  title: '从一张照片开始。',
}

describe('HomeCta', () => {
  it('渲染为 section.home-cta，aria-labelledby 指向章节标题', async () => {
    const wrapper = await mountSuspended(HomeCta, { props: fullProps })
    const root = wrapper.find('section')
    expect(root.exists()).toBe(true)
    expect(root.classes()).toContain('home-cta')
    // useId() 生成值不可预期，故断言指向关系而非字面量
    const titleId = wrapper.find('h2').attributes('id')
    expect(titleId).toBeTruthy()
    expect(root.attributes('aria-labelledby')).toBe(titleId)
  })

  it('渲染眉标 / h2 / 说明 / CTA 链接', async () => {
    const wrapper = await mountSuspended(HomeCta, { props: fullProps })
    expect(wrapper.find('.section-index').text()).toBe(fullProps.eyebrow)
    expect(wrapper.find('h2').text()).toBe(fullProps.title)
    expect(wrapper.find('p').text()).toBe(fullProps.lede)
    const cta = wrapper.find('.home-primary-link')
    expect(cta.exists()).toBe(true)
    expect(cta.text()).toContain(fullProps.ctaLabel)
  })

  it('可选文案缺席时对应节点不渲染', async () => {
    const wrapper = await mountSuspended(HomeCta, { props: requiredProps })
    expect(wrapper.find('.section-index').exists()).toBe(false)
    expect(wrapper.find('p').exists()).toBe(false)
    expect(wrapper.find('.home-primary-link').exists()).toBe(false)
  })

  it('CTA 链接默认指向 /single', async () => {
    const wrapper = await mountSuspended(HomeCta, { props: fullProps })
    expect(wrapper.find('.home-primary-link').attributes('href')).toBe('/single')
  })

  it('ctaTo 覆盖默认链接目标', async () => {
    const wrapper = await mountSuspended(HomeCta, {
      props: { ...fullProps, ctaTo: '/group-joint' },
    })
    expect(wrapper.find('.home-primary-link').attributes('href')).toBe('/group-joint')
  })

  it('箭头为装饰性 aria-hidden', async () => {
    const wrapper = await mountSuspended(HomeCta, { props: fullProps })
    const arrow = wrapper.find('.home-primary-link span[aria-hidden="true"]')
    expect(arrow.exists()).toBe(true)
    expect(arrow.text()).toBe('→')
  })

  // 调用方 class 是既定的语义扩展点，不得被内部 class 覆盖
  it('调用方 class 与内部 class 合并', async () => {
    const wrapper = await mountSuspended(HomeCta, {
      props: requiredProps,
      attrs: { class: 'home-section' },
    })
    const classes = wrapper.find('section').classes()
    expect(classes).toContain('home-cta')
    expect(classes).toContain('home-section')
  })

  // 锚点 id 归页面信息架构，经 attrs 透传而非组件内硬编码
  it('属性透传至根元素', async () => {
    const wrapper = await mountSuspended(HomeCta, {
      props: requiredProps,
      attrs: { id: 'cta' },
    })
    expect(wrapper.find('section').attributes('id')).toBe('cta')
  })
})
