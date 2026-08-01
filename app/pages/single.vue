<script setup lang="ts">
/**
 * 单图评估页（single.html → /single）。
 * 路由/SEO 壳（component-plan §2.4）：PageHero + SingleEvaluationFlow 编排。
 */
const { t } = useI18n()

useSeoMeta({
  title: () => t('single.seoTitle'),
  description: () => t('single.seoDescription'),
})
</script>

<template>
  <div class="evaluation-page">
    <LayoutPageHero
      :eyebrow="$t('single.heroEyebrow')"
      :title="$t('single.heroTitle')"
      :lede="$t('single.heroLede')"
    />

    <BusinessSingleEvaluationFlow />
  </div>
</template>
