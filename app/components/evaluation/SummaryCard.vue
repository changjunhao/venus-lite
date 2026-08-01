<script setup lang="ts">
/**
 * 分析摘要卡：系列整体分析 / 对比总结（component-plan L127），收敛 venus
 * group-joint.html L127-130 与 group-compare.html L146-149 两处
 * `#summary-text` + group.js L545/L555 renderMarkdown → innerHTML 为声明式组件。
 *
 * - 自包含卡片表面（偏离 ScorePanel/CritiqueReport 的「外壳归 Flow」模式）：
 *   源 `.group-summary-card` 为独立卡片——自带 paper-raised + hairline +
 *   2px amber 左边线 + radius-sm + clamp padding（style.css L1012），
 *   与 BaseCard panel 变体在 padding/radius/左边线三处偏移；
 *   若拆给 Flow 以 BaseCard + 覆盖 class 包裹，视觉规则需跨组件维护。
 * - variant 排版切换（替代源祖先选择器 group.css L132-135）：
 *   series → Display Serif clamp(19px,2vw,24px)/1.7（style.css L1013，
 *   §2.3「Serif 用于叙事与判断」）；
 *   comparison → font-ui 16px（group.css L132-135 `.group-results-compare`
 *   上下文覆盖的 prop 化，Flow 显式传 variant="comparison"）。
 * - 眉标 SERIES ANALYSIS / COMPARISON SUMMARY 为 §4.2 摄影语义常量
 *   （英文 ≤24 字符），硬编码于组件（CritiqueReport L14-15 先例）。
 * - 纯 props 组件不内嵌 $t()：标题由调用方解析 i18n 后传入；
 *   未传时按 variant 回退中文默认标签（CritiqueReport L20-21 先例）。
 * - v-if="content" 守卫：空内容不实例化 markstream-vue
 *   （CritiqueReport L59 章节判空先例）。
 * - compare 上下文 margin-top: space-7（group.css L128-130）归 Flow 编排。
 */
const props = withDefaults(
  defineProps<{
    /** Markdown 正文（joint: groupAnalysis / compare: comparisonSummary，useEvaluationStream 已归一） */
    content?: string
    /** 排版变体：series 联合评估 / comparison 对比评估 */
    variant?: 'series' | 'comparison'
    /** 眉标（§4.2 常量）；空则按 variant 派生 */
    eyebrow?: string
    /** 卡标题；空则按 variant 派生中文默认 */
    title?: string
  }>(),
  { content: '', variant: 'series', eyebrow: '', title: '' },
)

/** group-joint.html L128 / group-compare.html L147 眉标常量 */
const resolvedEyebrow = computed(() =>
  props.eyebrow || (props.variant === 'series' ? 'SERIES ANALYSIS' : 'COMPARISON SUMMARY'),
)

/** group-joint.html L128 / group-compare.html L147 标题 */
const resolvedTitle = computed(() =>
  props.title || (props.variant === 'series' ? '系列整体分析' : '对比总结'),
)

/** group-joint.html L127 series-summary / group-compare.html L146 comparison-summary */
const variantClass = computed(() =>
  props.variant === 'series' ? 'series-summary' : 'comparison-summary',
)
</script>

<template>
  <section class="group-summary-card" :class="variantClass">
    <UiCardHeading :eyebrow="resolvedEyebrow">{{ resolvedTitle }}</UiCardHeading>
    <!-- group.js L545/L555：renderMarkdown(summary) → editorial-copy -->
    <div class="editorial-copy" :class="{ 'editorial-copy--comparison': props.variant === 'comparison' }">
      <UiBaseMarkdown v-if="props.content" :content="props.content" final />
    </div>
  </section>
</template>

<style scoped>
/* venus style.css L1012：独立卡片表面——paper-raised + hairline +
 * 2px amber 左边线（§9.12 关键证据标记语言）+ radius-sm + clamp padding。
 * clamp(28px,4vw,48px) 为源值，有意偏离 BaseCard panel 的 token 梯度
 * （BaseCard L9 注释已划定此边界）。 */
.group-summary-card {
  background: var(--paper-raised);
  border: 1px solid var(--hairline);
  border-left: 2px solid var(--amber);
  border-radius: var(--radius-sm);
  padding: clamp(28px, 4vw, 48px);
}

/* venus style.css L1013：§2.3 Serif 用于叙事与判断——
 * Result Lead 层级 clamp(19px,2vw,24px)，宽松行距 1.7 */
.editorial-copy {
  font-family: var(--font-display);
  font-size: clamp(19px, 2vw, 24px);
  line-height: 1.7;
}

/* venus group.css L132-135：compare 上下文覆盖为 UI Sans 16px
 * （对比总结为结构性归纳而非叙事判断，降级为 Sans 承载） */
.editorial-copy--comparison {
  font-family: var(--font-ui);
  font-size: 16px;
}

/* venus group.css L436-452：首尾子元素 margin 修剪——
 * MarkdownRender 输出无 scoped attribute，经 :deep() 施加
 * （BaseMarkdown L72-76 :deep(strong) 先例） */
.editorial-copy :deep(> :first-child) {
  margin-top: 0;
}

.editorial-copy :deep(> :last-child) {
  margin-bottom: 0;
}
</style>
