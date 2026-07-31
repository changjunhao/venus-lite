<script setup lang="ts">
/**
 * 组图联合评估页（group-joint.html → /group-joint）。
 * 当前为路由/SEO 壳（component-plan §2.4）：PageHero 已就位，
 * 待 JointEvaluationFlow 实现后插入 .evaluation-shell。
 */
const { t } = useI18n()

useSeoMeta({
  title: () => t('groupJoint.seoTitle'),
  description: () => t('groupJoint.seoDescription'),
})
</script>

<template>
  <div class="evaluation-page">
    <LayoutPageHero
      :eyebrow="$t('groupJoint.heroEyebrow')"
      :title="$t('groupJoint.heroTitle')"
      :lede="$t('groupJoint.heroLede')"
    />

    <!-- TODO: JointEvaluationFlow -->
  </div>
</template>
