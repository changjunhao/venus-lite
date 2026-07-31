<script setup lang="ts">
/**
 * 点评三章：CRITIQUE / ACTION / VERDICT 编辑报告
 * （component-plan L118），收敛 venus single.html L153-157 三章静态 HTML
 * 与 app.js L544-550 renderMarkdown → innerHTML 的 DOM 操作为声明式组件。
 *
 * - §9.12：报告固定顺序——专业点评 → 改进建议 → 仲裁说明；
 *   主体最大宽度 42rem；仲裁说明 Display Serif 承载；
 *   改进建议 2px Amber 左边线（关键证据标记，不整段高亮）。
 * - 章节显隐由内容驱动（v-if 判空）+ showCritique 显式守卫：
 *   compare 页无 CRITIQUE 章（group-compare.html L156-160 无该 DOM），
 *   等价于 group.js L546 `if (elements.critiqueText)` 元素存在性检查——
 *   即使 API 返回 critique 字段，调用方置 false 即不渲染。
 * - 眉标 CRITIQUE/ACTION/VERDICT 为 §4.2 摄影语义常量（英文 ≤24 字符），
 *   硬编码于模板（先例 review.index "REVIEW IN PROGRESS" 在 zh locale 保持英文）。
 * - h3 从 venus 实现 Display Serif 25px/500（style.css L931-932）——
 *   DESIGN.md §9.12「子标题使用 UI Sans 18px/600」指章内子标题，
 *   章节标题属 §2.3「Serif 用于叙事与判断」范畴；
 *   与 ScorePanel/DimensionList/StreamSteps 忠实移植范式一致。
 * - 纯 props 组件不内嵌 $t()：章节标题由调用方解析 i18n 后传入
 *   （先例 ScorePanel L14 bandLabel）；未传时回退中文默认标签。
 * - 不含 .card 外壳——卡片归 Flow 组件以 BaseCard variant="plain" 包裹
 *   （ScorePanel L18 先例；venus 根为 section.card.critique-section）。
 * - strong 样式已由 BaseMarkdown :deep(strong) 覆盖（style.css L936-938），
 *   无需重复移植。
 */
const props = withDefaults(
  defineProps<{
    /** 专业点评 Markdown（app.js L545 data.critique）；空则不渲染本章 */
    critique?: string
    /** 改进建议 Markdown（app.js L546 data.suggestions）；空则不渲染本章 */
    suggestions?: string
    /** 仲裁说明 Markdown（app.js L547 arbitrationNotes || arbitration_notes）；空则不渲染本章 */
    arbitrationNotes?: string
    /** compare 页无 CRITIQUE 章（group-compare.html L156-160），调用方置 false */
    showCritique?: boolean
    /** CRITIQUE 章标题（调用方解析 i18n result.chapterCritique 后传入） */
    critiqueTitle?: string
    /** ACTION 章标题（调用方解析 i18n result.chapterSuggestions 后传入） */
    suggestionsTitle?: string
    /** VERDICT 章标题（调用方解析 i18n result.chapterArbitration 后传入） */
    arbitrationTitle?: string
  }>(),
  {
    critique: '',
    suggestions: '',
    arbitrationNotes: '',
    showCritique: true,
    critiqueTitle: '专业点评',
    suggestionsTitle: '改进建议',
    arbitrationTitle: '裁决说明',
  },
)
</script>

<template>
  <section class="editorial-report-body">
    <!-- CRITIQUE 章：single.html L154 / group-joint.html L146；compare 页不渲染 -->
    <div v-if="props.showCritique && props.critique" class="report-chapter">
      <UiBaseSectionIndex>CRITIQUE</UiBaseSectionIndex>
      <h3 class="chapter-title">{{ props.critiqueTitle }}</h3>
      <div class="critique-text">
        <UiBaseMarkdown :content="props.critique" final />
      </div>
    </div>
    <!-- ACTION 章：single.html L155 / group-compare.html L158；style.css L939 左边线 -->
    <div v-if="props.suggestions" class="report-chapter report-suggestions">
      <UiBaseSectionIndex>ACTION</UiBaseSectionIndex>
      <h3 class="chapter-title">{{ props.suggestionsTitle }}</h3>
      <div class="critique-text">
        <UiBaseMarkdown :content="props.suggestions" final />
      </div>
    </div>
    <!-- VERDICT 章：single.html L156 / group-compare.html L159；style.css L940 Display Serif -->
    <div v-if="props.arbitrationNotes" class="report-chapter report-arbitration">
      <UiBaseSectionIndex>VERDICT</UiBaseSectionIndex>
      <h3 class="chapter-title">{{ props.arbitrationTitle }}</h3>
      <div class="critique-text">
        <UiBaseMarkdown :content="props.arbitrationNotes" final />
      </div>
    </div>
  </section>
</template>

<style scoped>
/* venus style.css L927-928 */
.editorial-report-body {
  padding-top: var(--space-6);
}

/* venus style.css L929 */
.report-chapter {
  border-bottom: 1px solid var(--hairline);
  padding: var(--space-6) 0;
}

/* venus style.css L930 */
.report-chapter:first-child {
  padding-top: 0;
}

/* 末章收口（DimensionList L113-116 先例） */
.report-chapter:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

/* venus style.css L931-932：章节标题 Display Serif（§2.3 Serif 用于叙事与判断） */
.chapter-title {
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 25px;
  font-weight: 500;
  line-height: 1.3;
  margin: 10px 0 var(--space-4);
}

/* venus style.css L933-935：§9.12 主体最大宽度 42rem，长文本自然换行不截断 */
.critique-text {
  color: var(--ink-body);
  font-size: 16px;
  line-height: 1.78;
  max-width: 42rem;
}

/* venus style.css L939：§9.12 改进建议 2px Amber 左边线 */
.report-suggestions {
  border-left: 2px solid var(--amber);
  padding-left: var(--space-5);
}

/* venus style.css L940：§9.12 仲裁说明 Display Serif 承载 */
.report-arbitration .critique-text {
  font-family: var(--font-display);
  font-size: 18px;
  line-height: 1.75;
}

/* venus style.css L1199：移动端左边线收窄 */
@media (max-width: 767px) {
  .report-suggestions {
    padding-left: 16px;
  }
}
</style>
