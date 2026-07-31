import { THEME_INIT_SCRIPT } from './shared/theme'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxt/fonts', '@nuxt/a11y', '@nuxt/eslint', '@nuxt/test-utils/module', '@nuxtjs/i18n'],

  // 全局样式：Design Tokens 先于基础样式加载。
  // markstream-vue 置于 main.css 之前：其 dist CSS 残留未限定作用域的 .container 规则
  // （width:100% + 五档断点 max-width，最大 1536px），main.css 后声明的
  // .container{max-width:1280px}（§7.2）在同特异度下获胜，中和宽屏泄漏；
  // main.css 的通配 reset 特异度为 0，排在库 CSS 之后不会覆盖其 class 规则。
  css: ['~/assets/css/tokens.css', 'markstream-vue/index.css', '~/assets/css/main.css'],

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
      // html lang 由 i18n 接管（app.vue 的 useLocaleHead），不在此硬编码
      title: 'Venus',
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
      // 主题初始化：首绘前同步执行，仅搬运 localStorage 里的显式覆盖。
      // 置于 config 而非 composable，以覆盖 error.vue 与预渲染路径。
      script: [{ textContent: THEME_INIT_SCRIPT, tagPosition: 'head' }],
    },
  },

  // 国际化：no_prefix 策略（URL 不变），语言偏好经 cookie 持久化，SSR 首屏即正确
  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'zh',
    baseUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    locales: [
      { code: 'zh', language: 'zh-CN', name: '中文', file: 'zh.json' },
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'venus-locale', // 与 venus-theme 命名风格一致，无冲突
      redirectOn: 'root',
      fallbackLocale: 'zh',
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
    // OSS / STS（NUXT_OSS_*）—— 仅服务端可见，用于签发 STS 临时凭证
    ossRegion: '',
    ossBucket: '',
    ossStsRoleArn: '',
    ossStsAccessKeyId: '',
    ossStsAccessKeySecret: '',
    ossStsSessionDurationSeconds: 900,
    // 客户端可见（NUXT_PUBLIC_SITE_NAME）
    public: {
      siteName: 'Venus',
    },
  },
})
