import { defineVitestConfig } from '@nuxt/test-utils/config'

// 组件测试统一走 nuxt 环境（NuxtLink、自动导入可用），DOM 由 happy-dom 提供
export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    include: ['tests/**/*.spec.ts'],
  },
})
