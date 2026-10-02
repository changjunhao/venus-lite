import { beforeEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import { useNuxtApp } from '#imports'
import SiteFooter from '~/components/layout/SiteFooter.vue'

// SiteFooter 纯静态、不内嵌 ThemeToggle：无需 matchMedia stub 与主题 state 清理；
// locale 显式固定（同 SiteNav.spec.ts 的处理）。
function makeHost(locale: 'zh' | 'en' = 'zh') {
  return defineComponent({
    async setup() {
      await useNuxtApp().$i18n.setLocale(locale)
      return () => h(SiteFooter)
    },
  })
}

describe('SiteFooter', () => {
  beforeEach(() => {
    document.cookie = 'venus-locale=; Max-Age=0; path=/'
  })

  it('根元素为 footer.site-footer（contentinfo 语义由标签承担）', async () => {
    const wrapper = await mountSuspended(makeHost())

    expect(wrapper.find('footer.site-footer').exists()).toBe(true)
  })

  it('品牌链接：星芒 18px + VENUS 字标成组，aria-label 恒存在', async () => {
    const wrapper = await mountSuspended(makeHost())
    const brand = wrapper.find('.footer-brand')

    expect(brand.attributes('href')).toBe('/')
    expect(brand.attributes('aria-label')).toBe('Venus 首页')
    expect(brand.find('svg').attributes('width')).toBe('18')
    expect(brand.text()).toContain('VENUS')
  })

  it('标语段落渲染中文文案', async () => {
    const wrapper = await mountSuspended(makeHost())

    expect(wrapper.find('.footer-tagline').text()).toBe('摄影美学评估系统 · 数字接触印样')
  })

  it('en locale：tagline 与 aria-label 输出英文文案', async () => {
    const wrapper = await mountSuspended(makeHost('en'))

    expect(wrapper.find('.footer-tagline').text())
      .toBe('Photography aesthetic evaluation · Digital contact sheet')
    expect(wrapper.find('.footer-brand').attributes('aria-label')).toBe('Venus home')
  })

  it('相关链接区：站内使用分析链接 + 5 个带安全属性的外链按序渲染', async () => {
    const wrapper = await mountSuspended(makeHost())
    const nav = wrapper.find('nav.footer-links')

    expect(nav.attributes('aria-label')).toBe('相关链接')

    const analyticsLink = nav.find('a[href="/admin/analytics"]')
    expect(analyticsLink.text()).toBe('使用分析')
    expect(analyticsLink.attributes('target')).toBeUndefined()

    const links = nav.findAll('a').filter(link => link.attributes('href') !== '/admin/analytics')
    expect(links.map(link => link.attributes('href'))).toEqual([
      'https://www.ifable.cn/',
      'https://github.com/changjunhao/venus-core',
      'https://github.com/changjunhao/venus-lite',
      'https://blog.ifable.cn/2026/06/13/venus-ai-photography-evaluation/',
      'https://blog.ifable.cn/2026/06/14/venus-ai-photography-engineering/',
    ])
    for (const link of links) {
      expect(link.attributes('target')).toBe('_blank')
      expect(link.attributes('rel')).toBe('noopener noreferrer')
    }
    expect(links[0]!.text()).toBe('作者主页')
  })

  it('en locale：外链文案与 nav aria-label 输出英文', async () => {
    const wrapper = await mountSuspended(makeHost('en'))
    const nav = wrapper.find('nav.footer-links')

    expect(nav.attributes('aria-label')).toBe('Related links')
    expect(nav.find('a[href="/admin/analytics"]').text()).toBe('Analytics')
    expect(nav.findAll('a').filter(link => link.attributes('href') !== '/admin/analytics')[0]!.text()).toBe('Author')
  })
})
