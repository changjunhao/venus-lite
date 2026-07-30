import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import { useNuxtApp } from '#imports'
import LocaleToggle from '~/components/layout/LocaleToggle.vue'

// 用例间共享同一 Nuxt 实例，i18n locale 会跨用例残留；
// 且 happy-dom 的 navigator.language（en-US）可能使初始 locale 漂移，
// 故每次挂载前显式固定为 zh（同 ThemeToggle.spec.ts 的处理）。
const Host = defineComponent({
  async setup() {
    await useNuxtApp().$i18n.setLocale('zh')
    return () => h(LocaleToggle)
  },
})

describe('LocaleToggle', () => {
  beforeEach(() => {
    // setLocale 会写 venus-locale cookie，清掉避免用例间互相影响
    document.cookie = 'venus-locale=; Max-Age=0; path=/'
  })

  it('中文态渲染 pill 按钮，aria-label 指向目标语言', async () => {
    const wrapper = await mountSuspended(Host)
    const button = wrapper.find('button')

    expect(button.attributes('type')).toBe('button')
    expect(button.classes()).toContain('locale-toggle')
    expect(button.attributes('aria-label')).toBe('Switch to English')
    expect(button.text()).toContain('中文')
  })

  it('点击切换到 en：locale 翻转且文案随之变化', async () => {
    const wrapper = await mountSuspended(Host)
    const button = wrapper.find('button')

    // setLocale 异步（懒加载消息 + 写 cookie），需等待切换完成
    await button.trigger('click')
    await vi.waitFor(() => {
      expect(useNuxtApp().$i18n.locale.value).toBe('en')
    })

    expect(button.attributes('aria-label')).toBe('切换到中文')
    expect(button.text()).toContain('EN')
  })

  it('再次点击切回 zh', async () => {
    const wrapper = await mountSuspended(Host)
    const button = wrapper.find('button')

    await button.trigger('click')
    await vi.waitFor(() => {
      expect(useNuxtApp().$i18n.locale.value).toBe('en')
    })
    await button.trigger('click')
    await vi.waitFor(() => {
      expect(useNuxtApp().$i18n.locale.value).toBe('zh')
    })

    expect(button.attributes('aria-label')).toBe('Switch to English')
  })
})
