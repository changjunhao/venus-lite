<script setup lang="ts">
/**
 * 单图评估页（single.html → /single）。
 * 当前为路由/SEO 壳（component-plan §2.4）：PageHero 已就位，
 * 待 SingleEvaluationFlow 实现后插入 .evaluation-shell。
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

    <!-- TODO: SingleEvaluationFlow -->
  </div>
</template>
