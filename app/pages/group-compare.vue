<script setup lang="ts">
/**
 * 组图对比评估页（group-compare.html → /group-compare）。
 * 路由/SEO 壳（component-plan §2.4）：PageHero + CompareEvaluationFlow 编排。
 */
const { t } = useI18n()

useSeoMeta({
  title: () => t('groupCompare.seoTitle'),
  description: () => t('groupCompare.seoDescription'),
})
</script>

<template>
  <div class="evaluation-page">
    <LayoutPageHero
      :eyebrow="$t('groupCompare.heroEyebrow')"
      :title="$t('groupCompare.heroTitle')"
      :lede="$t('groupCompare.heroLede')"
    />

    <BusinessCompareEvaluationFlow />
  </div>
</template>
