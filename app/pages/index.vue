<script setup lang="ts">
import type { ContactSheetFrame } from '~/components/home/HomeContactSheet.vue'
import type { ModeCardItem } from '~/components/home/ModeCard.vue'
import type { ProcessStepItem } from '~/components/home/ProcessSection.vue'
import type { ResultProofItem } from '~/components/home/ResultSample.vue'

const { t } = useI18n()

// 首页标题走 i18n（品牌 + 定位，对齐 venus index.html L9 标题格式），
// siteName 仅作全局 fallback 与 og:site_name
useSeoMeta({
  title: () => t('home.seoTitle'),
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

// venus index.html L119-124 源四步：方法论步骤为真实评审环节（§4.2），
// 编号由 ProcessSection 按顺序派生
const processSteps = computed<ProcessStepItem[]>(() => [
  {
    title: t('home.process.genre.title'),
    description: t('home.process.genre.description'),
  },
  {
    title: t('home.process.proposal.title'),
    description: t('home.process.proposal.description'),
  },
  {
    title: t('home.process.challenge.title'),
    description: t('home.process.challenge.description'),
  },
  {
    title: t('home.process.verdict.title'),
    description: t('home.process.verdict.description'),
  },
])

// venus index.html L137-141 源三组依据：评分系统的输出示例
const sampleProofs = computed<ResultProofItem[]>(() => [
  { term: t('home.sample.strength.term'), detail: t('home.sample.strength.detail') },
  { term: t('home.sample.improve.term'), detail: t('home.sample.improve.detail') },
  { term: t('home.sample.basis.term'), detail: t('home.sample.basis.detail') },
])
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

    <HomeProcessSection
      id="process"
      :eyebrow="$t('home.process.eyebrow')"
      :title="$t('home.process.title')"
      :lede="$t('home.process.lede')"
      :steps="processSteps"
    />

    <HomeResultSample
      id="sample"
      :eyebrow="$t('home.sample.eyebrow')"
      :title="$t('home.sample.title')"
      :score="8.2"
      :score-caption="$t('home.sample.scoreCaption')"
      :score-band="$t('home.sample.scoreBand')"
      :lede="$t('home.sample.lede')"
      :proofs="sampleProofs"
      image-src="/assets/editorial/forest.jpg"
      :image-alt="$t('home.sample.imageAlt')"
      :image-width="1000"
      :image-height="666"
      frame-label="FRAME 02 / REVIEWED"
    />

    <HomeCta
      :eyebrow="$t('home.cta.eyebrow')"
      :title="$t('home.cta.title')"
      :lede="$t('home.cta.lede')"
      :cta-label="$t('home.cta.cta')"
    />
  </div>
</template>
