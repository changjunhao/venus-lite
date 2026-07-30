import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import { clearNuxtState, useNuxtApp } from '#imports'
import SiteNav from '~/components/layout/SiteNav.vue'

type MediaListener = (event: { matches: boolean }) => void

// SiteNav 内嵌 ThemeToggle（触达 useTheme 的 useState），挂载前重置主题相关 state；
// locale 显式固定 zh（同 ThemeToggle.spec.ts / LocaleToggle.spec.ts 的处理）。
function makeHost(variant: 'home' | 'evaluation') {
  return defineComponent({
    async setup() {
      clearNuxtState(['venus-theme', 'venus-theme-system', 'venus-theme-client'])
      await useNuxtApp().$i18n.setLocale('zh')
      return () => h(SiteNav, { variant })
    },
  })
}

/** 可控的 matchMedia（不依赖 happy-dom 实现，同 ThemeToggle.spec.ts） */
function stubMatchMedia(prefersDark: boolean) {
  const listeners = new Set<MediaListener>()
  const query = {
    matches: prefersDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, listener: MediaListener) => listeners.add(listener),
    removeEventListener: (_: string, listener: MediaListener) => listeners.delete(listener),
  }
  vi.stubGlobal('matchMedia', () => query)
}

describe('SiteNav', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    stubMatchMedia(false)
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.cookie = 'venus-locale=; Max-Age=0; path=/'
  })

  it('home 变体：主导航语义 + 三个锚点链接', async () => {
    const wrapper = await mountSuspended(makeHost('home'))
    const nav = wrapper.find('nav.site-nav')

    expect(nav.attributes('aria-label')).toBe('主导航')

    const links = nav.findAll('.nav-links a')
    expect(links.map(link => link.attributes('href'))).toEqual(['#modes', '#process', '#sample'])
    expect(links.map(link => link.text())).toEqual(['评估模式', '工作方式', '结果示例'])
  })

  it('evaluation 变体：模式导航语义 + 三模式路由链接，非激活路由无 aria-current', async () => {
    const wrapper = await mountSuspended(makeHost('evaluation'))
    const nav = wrapper.find('nav.site-nav')

    expect(nav.attributes('aria-label')).toBe('评估模式导航')

    const links = nav.findAll('.nav-links a')
    expect(links.map(link => link.attributes('href')))
      .toEqual(['/single', '/group-joint', '/group-compare'])
    expect(links.map(link => link.text())).toEqual(['单图评估', '组图联合评估', '组图对比评估'])
    // 测试路由为 /：aria-current 由 NuxtLink 对精确激活路由自动附加，此处应全部缺席
    for (const link of links) {
      expect(link.attributes('aria-current')).toBeUndefined()
    }
  })

  it('品牌链接：星芒 + VENUS 字标成组，aria-label 恒存在且随变体切换', async () => {
    const home = await mountSuspended(makeHost('home'))
    const homeBrand = home.find('.nav-brand')
    expect(homeBrand.attributes('href')).toBe('/')
    expect(homeBrand.attributes('aria-label')).toBe('Venus 首页')
    expect(homeBrand.find('svg').exists()).toBe(true)
    expect(homeBrand.text()).toContain('VENUS')

    const evaluation = await mountSuspended(makeHost('evaluation'))
    expect(evaluation.find('.nav-brand').attributes('aria-label')).toBe('返回 Venus 产品介绍')
  })

  it('右侧控件组：主题与语言切换按钮就位', async () => {
    const wrapper = await mountSuspended(makeHost('home'))

    expect(wrapper.find('.nav-actions .theme-toggle').exists()).toBe(true)
    expect(wrapper.find('.nav-actions .locale-toggle').exists()).toBe(true)
  })
})
