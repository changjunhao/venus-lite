<script setup lang="ts">
import type { HealthStatus } from '#shared/types/api'

const config = useRuntimeConfig()
const { t, localeProperties } = useI18n()

useSeoMeta({
  title: config.public.siteName,
  description: () => t('home.seoDescription'),
})

// SSR 取数示例：服务端渲染时完成请求，View Source 可见数据
const { data: health } = await useFetch<HealthStatus>('/api/health')
</script>

<template>
  <div class="home container">
    <section class="hero">
      <p class="eyebrow">Nuxt 4 Skeleton</p>
      <h1 class="hero-title">{{ config.public.siteName }}</h1>
    </section>

    <section class="status" :aria-label="$t('home.statusSection')">
      <h2 class="status-title">{{ $t('home.statusSection') }}</h2>
      <dl v-if="health" class="status-grid">
        <div class="status-item">
          <dt>{{ $t('home.statusLabel') }}</dt>
          <dd class="status-ok">{{ health.status === 'ok' ? $t('home.statusOk') : health.status }}</dd>
        </div>
        <div class="status-item">
          <dt>{{ $t('home.version') }}</dt>
          <dd>{{ health.version }}</dd>
        </div>
        <div class="status-item">
          <dt>{{ $t('home.serverTime') }}</dt>
          <dd>{{ formatDateTime(health.time, localeProperties.language) }}</dd>
        </div>
      </dl>
      <p v-else class="status-empty">{{ $t('home.statusEmpty') }}</p>
    </section>
  </div>
</template>

<style scoped>
.hero {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-block: var(--space-8) var(--space-7);
}

.hero-title {
  font-size: 52px;
  line-height: 0.98;
}

@media (min-width: 768px) {
  .hero-title {
    font-size: 88px;
  }
}

.hero-lead {
  font-size: 18px;
  line-height: 1.72;
}

.hero-actions {
  margin-top: var(--space-2);
}

.status {
  border-top: 1px solid var(--hairline);
  padding-block: var(--space-6);
}

.status-title {
  font-size: 24px;
  margin-bottom: var(--space-5);
}

.status-grid {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  max-width: 640px;
}

.status-item dt {
  color: var(--ink-muted);
  font-size: 12px;
  font-family: var(--font-data);
  letter-spacing: 0.08em;
  margin-bottom: var(--space-1);
}

.status-item dd {
  color: var(--ink);
  font-family: var(--font-data);
  font-size: 16px;
}

.status-ok {
  color: var(--verdigris);
}

.status-empty {
  color: var(--ink-muted);
}
</style>
