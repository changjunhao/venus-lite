import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import HomeHero from '~/components/home/HomeHero.vue'
import HomeContactSheet from '~/components/home/HomeContactSheet.vue'

/** venus index.html L57-74 源三帧 */
const frames = [
  {
    src: '/assets/editorial/landscape.jpg',
    alt: '山脉与云层的风光摄影示例',
    caption: 'LANDSCAPE',
    width: 1200,
    height: 1800,
  },
  {
    src: '/assets/editorial/forest.jpg',
    alt: '森林光影摄影示例',
    caption: 'LIGHT',
    width: 1000,
    height: 666,
  },
  {
    src: '/assets/editorial/water.jpg',
    alt: '水面纹理摄影示例',
    caption: 'RHYTHM',
    width: 1000,
    height: 667,
  },
]

const requiredProps = {
  title: 'Venus',
  frames,
  sheetAriaLabel: '摄影作品接触印样示例',
}

/** venus index.html L44-54 源文案全集 */
const fullProps = {
  ...requiredProps,
  eyebrow: 'PHOTOGRAPHIC AESTHETICS / REVIEWED WITH RIGOR',
  subtitle: '摄影美学评估系统',
  tagline: '基于多智能体对抗的专业摄影美学评估',
  lede: '从一张照片到一个系列，Venus 通过提案、质疑与仲裁，给出评分、点评、改进建议和可核对的判断依据。',
  primaryLabel: '开始单图评估',
  secondaryLabel: '选择评估模式',
  sheetNoteLabel: 'CONTACT / 01—03',
  sheetNoteText: '先看见照片之间的关系，再形成判断。',
}

describe('HomeHero', () => {
  it('渲染为 header.home-hero', async () => {
    const wrapper = await mountSuspended(HomeHero, { props: requiredProps })
    const root = wrapper.find('header')
    expect(root.exists()).toBe(true)
    expect(root.classes()).toContain('home-hero')
  })

  it('文案区渲染 eyebrow / h1 双行 / tagline / lede', async () => {
    const wrapper = await mountSuspended(HomeHero, { props: fullProps })
    expect(wrapper.find('.home-eyebrow').text()).toBe(fullProps.eyebrow)
    expect(wrapper.find('h1 span').text()).toBe('Venus')
    expect(wrapper.find('h1 strong').text()).toBe(fullProps.subtitle)
    expect(wrapper.find('.home-hero-tagline').text()).toBe(fullProps.tagline)
    expect(wrapper.find('.home-lede').text()).toBe(fullProps.lede)
  })

  it('可选文案缺席时对应节点不渲染', async () => {
    const wrapper = await mountSuspended(HomeHero, { props: requiredProps })
    expect(wrapper.find('.home-eyebrow').exists()).toBe(false)
    expect(wrapper.find('h1 strong').exists()).toBe(false)
    expect(wrapper.find('.home-hero-tagline').exists()).toBe(false)
    expect(wrapper.find('.home-lede').exists()).toBe(false)
    expect(wrapper.find('.home-hero-actions').exists()).toBe(false)
  })

  it('双 CTA 渲染文案与默认链接目标，主 CTA 含装饰箭头', async () => {
    const wrapper = await mountSuspended(HomeHero, { props: fullProps })
    const primary = wrapper.find('.home-primary-link')
    expect(primary.text()).toContain(fullProps.primaryLabel)
    expect(primary.attributes('href')).toBe('/single')
    expect(primary.find('span[aria-hidden="true"]').text()).toBe('→')
    const secondary = wrapper.find('.home-text-link')
    expect(secondary.text()).toBe(fullProps.secondaryLabel)
    expect(secondary.attributes('href')).toBe('#modes')
  })

  it('primaryTo / secondaryTo 覆盖默认链接目标', async () => {
    const wrapper = await mountSuspended(HomeHero, {
      props: { ...fullProps, primaryTo: '/single-review', secondaryTo: '#evaluation-modes' },
    })
    expect(wrapper.find('.home-primary-link').attributes('href')).toBe('/single-review')
    expect(wrapper.find('.home-text-link').attributes('href')).toBe('#evaluation-modes')
  })

  it('HomeContactSheet 收到透传 props', async () => {
    const wrapper = await mountSuspended(HomeHero, { props: fullProps })
    const sheet = wrapper.findComponent(HomeContactSheet)
    expect(sheet.exists()).toBe(true)
    expect(sheet.props('frames')).toEqual(frames)
    expect(sheet.props('ariaLabel')).toBe(fullProps.sheetAriaLabel)
    expect(sheet.props('noteLabel')).toBe(fullProps.sheetNoteLabel)
    expect(sheet.props('noteText')).toBe(fullProps.sheetNoteText)
  })

  // 调用方 class 是既定的语义扩展点，不得被内部 class 覆盖
  it('调用方 class 与内部 class 合并', async () => {
    const wrapper = await mountSuspended(HomeHero, {
      props: requiredProps,
      attrs: { class: 'home-masthead' },
    })
    const classes = wrapper.find('header').classes()
    expect(classes).toContain('home-hero')
    expect(classes).toContain('home-masthead')
  })

  it('属性透传至根元素', async () => {
    const wrapper = await mountSuspended(HomeHero, {
      props: requiredProps,
      attrs: { id: 'home-hero' },
    })
    expect(wrapper.find('header').attributes('id')).toBe('home-hero')
  })
})
