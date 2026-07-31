<script setup lang="ts">
import type { HealthStatus } from '#shared/types/api'
import type { ContactSheetFrame } from '~/components/home/HomeContactSheet.vue'
import type { ModeCardItem } from '~/components/home/ModeCard.vue'

const config = useRuntimeConfig()
const { t, localeProperties } = useI18n()

useSeoMeta({
  title: config.public.siteName,
  description: () => t('home.seoDescription'),
})

// venus index.html L57-74 源三帧：caption 品牌 mono 恒英文不入 i18n，
// alt 随 locale 切换故用 computed；width/height 为原始像素尺寸防 CLS
const heroFrames = computed<ContactSheetFrame[]>(() => [
  {
    src: '/assets/editorial/landscape.jpg',
    alt: t('home.hero.frameLandscapeAlt'),
    caption: 'LANDSCAPE',
    width: 1200,
    height: 1800,
  },
  {
    src: '/assets/editorial/forest.jpg',
    alt: t('home.hero.frameForestAlt'),
    caption: 'LIGHT',
    width: 1000,
    height: 666,
  },
  {
    src: '/assets/editorial/water.jpg',
    alt: t('home.hero.frameWaterAlt'),
    caption: 'RHYTHM',
    width: 1000,
    height: 667,
  },
])

// venus index.html L85-110 源三卡：label 为品牌 mono 恒英文不入 i18n（先例 heroFrames.caption），
// 编号由 ModeCardGrid 按顺序派生；visual 为装饰图（alt=""），width/height 为原始像素尺寸防 CLS
const modes = computed<ModeCardItem[]>(() => [
  {
    label: 'SINGLE FRAME',
    title: t('home.modes.single.title'),
    description: t('home.modes.single.description'),
    ctaLabel: t('home.modes.single.cta'),
    to: '/single',
    layout: 'single',
    featured: true,
    visuals: [
      { src: '/assets/editorial/forest.jpg', width: 1000, height: 666 },
    ],
  },
  {
    label: 'SERIES REVIEW',
    title: t('home.modes.joint.title'),
    description: t('home.modes.joint.description'),
    ctaLabel: t('home.modes.joint.cta'),
    to: '/group-joint',
    layout: 'series',
    visuals: [
      { src: '/assets/editorial/landscape.jpg', width: 1200, height: 1800 },
      { src: '/assets/editorial/forest.jpg', width: 1000, height: 666 },
      { src: '/assets/editorial/water.jpg', width: 1000, height: 667 },
    ],
  },
  {
    label: 'COMPARATIVE REVIEW',
    title: t('home.modes.compare.title'),
    description: t('home.modes.compare.description'),
    ctaLabel: t('home.modes.compare.cta'),
    to: '/group-compare',
    layout: 'compare',
    visuals: [
      { src: '/assets/editorial/forest.jpg', width: 1000, height: 666 },
      { src: '/assets/editorial/water.jpg', width: 1000, height: 667 },
    ],
  },
])

// SSR 取数示例：服务端渲染时完成请求，View Source 可见数据
const { data: health } = await useFetch<HealthStatus>('/api/health')
</script>

<template>
  <div class="home container">
    <HomeHero
      :eyebrow="$t('home.hero.eyebrow')"
      :title="$t('home.hero.title')"
      :subtitle="$t('home.hero.subtitle')"
      :tagline="$t('home.hero.tagline')"
      :lede="$t('home.hero.lede')"
      :primary-label="$t('home.hero.ctaPrimary')"
      :secondary-label="$t('home.hero.ctaSecondary')"
      :frames="heroFrames"
      :sheet-aria-label="$t('home.hero.sheetAria')"
      :sheet-note-label="$t('home.hero.sheetNoteLabel')"
      :sheet-note-text="$t('home.hero.sheetNoteText')"
    />

    <HomeModeCardGrid
      id="modes"
      :eyebrow="$t('home.modes.eyebrow')"
      :title="$t('home.modes.title')"
      :description="$t('home.modes.description')"
      :modes="modes"
    />

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
