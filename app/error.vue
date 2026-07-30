<script setup lang="ts">
import type { NuxtError } from '#app'

// 全局错误页：只解释发生了什么与如何继续，不暴露实现细节（DESIGN.md §2.5）
const props = defineProps<{ error: NuxtError }>()

const { t } = useI18n()

// 错误页替代 app.vue 整棵渲染，html lang 需在此单独接管（同 app.vue）
const localeHead = useLocaleHead()
useHead(() => ({ htmlAttrs: { lang: localeHead.value.htmlAttrs?.lang } }))

const message = computed(() => {
  if (props.error.status === 404) return t('error.notFound')
  return t('error.generic')
})

function backHome() {
  clearError({ redirect: '/' })
}
</script>

<template>
  <main class="error-page container">
    <p class="eyebrow">ERROR</p>
    <h1 class="error-code">{{ error.status }}</h1>
    <p class="error-message">{{ message }}</p>
    <UiBaseButton @click="backHome">{{ $t('error.backHome') }}</UiBaseButton>
  </main>
</template>

<style scoped>
.error-page {
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-block: var(--space-9);
}

.error-code {
  font-family: var(--font-data);
  font-size: 64px;
  line-height: 1.02;
}

.error-message {
  color: var(--ink-body);
  font-size: 18px;
}
</style>
