import { THEME_INIT_SCRIPT } from './shared/theme'
import { createHash } from 'node:crypto'

// CSP img-src 白名单：
// - OSS 签名 URL：上传后的图片经 signatureUrl 展示（useOssUpload），
//   需把 Bucket 域名加入 img-src，否则默认 CSP（'self' + data:）会拦截；
//   Bucket 未配置（如本地开发）时不追加，data: 回退路径不受影响。
// - blob:：选图即时预览（useImageSelection）与分享图预览（useShareImage）
//   均经 URL.createObjectURL 产生 blob URL。
const ossRegion = process.env.NUXT_OSS_REGION || ''
const ossBucket = process.env.NUXT_OSS_BUCKET || ''
const ossImgOrigin = ossBucket && ossRegion ? `https://${ossBucket}.${ossRegion}.aliyuncs.com` : ''

// CSRF 加密密钥归一：uncsrf 直接把 encryptSecret 的 UTF-8 字节用作 aes-256-cbc 密钥，
// 必须恰好 32 字节（长度不符会抛 ERR_CRYPTO_INVALID_KEYLEN 致 SSR 500）。
// 用户配置任意长度随机串均可，此处经 SHA-256 派生固定 32 字节；未配置时留空，
// 由 csurf 运行时生成随机密钥（与模块缺省行为一致，但重启后失效）。
const rawCsrfSecret = process.env.NUXT_SECURITY_CSRF_SECRET || ''
const csrfEncryptSecret = rawCsrfSecret
  ? createHash('sha256').update(rawCsrfSecret).digest('base64').slice(0, 32)
  : undefined

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxt/fonts', '@nuxt/a11y', '@nuxt/eslint', '@nuxt/test-utils/module', '@nuxtjs/i18n', 'nuxt-security'],

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
  // security.rateLimiter 为 nuxt-security 按路由限流分档（令牌桶，内存 lruCache 驱动）：
  // evaluate 直烧 LLM 配额最严；oss/sts 防凭证收割；metadata 宽松。
  routeRules: {
    '/': { ssr: true },
    '/api/evaluate/**': { security: { rateLimiter: { tokensPerInterval: 5, interval: 60000 } } },
    '/api/oss/sts': { security: { rateLimiter: { tokensPerInterval: 10, interval: 300000 } } },
    '/api/metadata': { security: { rateLimiter: { tokensPerInterval: 60, interval: 300000 } } },
  },

  // 应用层安全防护（nuxt-security，OWASP/Helmet 风格）。
  // 与 Nginx 边缘层分工：Nginx 管 TLS/边缘限流/嗅探拦截/静态缓存，
  // 安全响应头由本模块统一负责，避免双层重复头。
  security: {
    headers: {
      contentSecurityPolicy: {
        // 仅覆盖 img-src，其余指令沿用模块默认（含 nonce + strict-dynamic 的 script-src）
        'img-src': ["'self'", 'data:', 'blob:', ...(ossImgOrigin ? [ossImgOrigin] : [])],
      },
    },
    rateLimiter: {
      // 本机健康检查/监控放行；全局档位用默认 150 次/5min
      whiteList: ['127.0.0.1'],
    },
    csrf: {
      // 固定加密密钥（NUXT_SECURITY_CSRF_SECRET，任意长度随机串，如 openssl rand -hex 32）：
      // 缺省随机密钥在 PM2 重启后失效，存量页面 token 会全部 403。
      // 底层 nuxt-csurf 将其并入 runtimeConfig.csurf，亦可用 NUXT_CSURF_ENCRYPT_SECRET 运行时覆盖
      // （注意：该运行时覆盖不经过 SHA-256 归一，必须自行提供恰好 32 字节的串）。
      encryptSecret: csrfEncryptSecret,
    },
    // 保留客户端 console 便于排障（默认为 true 会移除）
    removeLoggers: false,
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
    // ── Venus Engine 全局配置（NUXT_VENUS_*，仅服务端可见）──
    venusProviderType: 'openai-chat', // openai-chat | openai-responses | anthropic | gemini
    venusProviderBaseUrl: '',
    venusProviderApiKey: '',
    venusProviderModel: '',
    venusProviderTimeout: 60000,
    venusMaxRetries: 3,
    venusReasoningEnabled: true,
    venusReasoningEffort: '', // none | minimal | low | medium | high | max | xhigh
    venusReasoningBudgetTokens: 0,
    // ── Venus Engine 每 Agent 独立 Provider（NUXT_VENUS_<AGENT>_*）──
    // genreDetector
    venusGenreDetectorProviderType: '',
    venusGenreDetectorBaseUrl: '',
    venusGenreDetectorApiKey: '',
    venusGenreDetectorModel: '',
    venusGenreDetectorTimeout: 0,
    venusGenreDetectorReasoningEffort: '',
    venusGenreDetectorReasoningBudgetTokens: 0,
    // proposer
    venusProposerProviderType: '',
    venusProposerBaseUrl: '',
    venusProposerApiKey: '',
    venusProposerModel: '',
    venusProposerTimeout: 0,
    venusProposerReasoningEffort: '',
    venusProposerReasoningBudgetTokens: 0,
    // critic
    venusCriticProviderType: '',
    venusCriticBaseUrl: '',
    venusCriticApiKey: '',
    venusCriticModel: '',
    venusCriticTimeout: 0,
    venusCriticReasoningEffort: '',
    venusCriticReasoningBudgetTokens: 0,
    // arbiter
    venusArbiterProviderType: '',
    venusArbiterBaseUrl: '',
    venusArbiterApiKey: '',
    venusArbiterModel: '',
    venusArbiterTimeout: 0,
    venusArbiterReasoningEffort: '',
    venusArbiterReasoningBudgetTokens: 0,
    // revision（修正轮，默认沿用 proposer 配置）
    venusRevisionProviderType: '',
    venusRevisionBaseUrl: '',
    venusRevisionApiKey: '',
    venusRevisionModel: '',
    venusRevisionTimeout: 0,
    venusRevisionReasoningEffort: '',
    venusRevisionReasoningBudgetTokens: 0,
    // 客户端可见（NUXT_PUBLIC_SITE_NAME）
    public: {
      siteName: 'Venus',
    },
  },
})
