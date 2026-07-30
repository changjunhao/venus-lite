import { THEME_INIT_SCRIPT } from './shared/theme'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxt/fonts', '@nuxt/a11y', '@nuxt/eslint', '@nuxt/test-utils/module'],

  // 全局样式：Design Tokens 先于基础样式加载
  css: ['~/assets/css/tokens.css', '~/assets/css/main.css'],

  // 字体：禁用 Google 提供源（fonts.google.com 网络不可达，启动时反复重试拖慢冷启动）
  // tokens.css 的字体栈均有本地回退（PingFang SC / Songti SC / system-ui 等），渲染不受影响
  fonts: {
    providers: {
      google: false,
      googleicons: false,
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      title: 'Venus Lite',
      link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
      // 主题初始化：首绘前同步执行，仅搬运 localStorage 里的显式覆盖。
      // 置于 config 而非 composable，以覆盖 error.vue 与预渲染路径。
      script: [{ textContent: THEME_INIT_SCRIPT, tagPosition: 'head' }],
    },
  },

  // 路由级渲染策略（骨架示例均走 SSR；后续页面可按需追加 prerender/swr 等规则）
  routeRules: {
    '/': { ssr: true },
    '/notes': { ssr: true },
  },

  // 环境变量体系：运行时经 NUXT_ 前缀覆盖（见 .env.example）
  runtimeConfig: {
    // 服务端私有（NUXT_APP_VERSION）
    appVersion: '',
    // 客户端可见（NUXT_PUBLIC_SITE_NAME）
    public: {
      siteName: 'Venus Lite',
    },
  },
})
