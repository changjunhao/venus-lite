<script setup lang="ts">
import type {
  ArbitrationDecisionType,
  ArbitrationNotes,
  Suggestions,
} from '#shared/types/evaluation'

const props = withDefaults(
  defineProps<{
    /** 专业点评 Markdown；空则不渲染本章 */
    critique?: string
    /** 已结构化的独立改进建议；空数组则不渲染本章 */
    suggestions?: Suggestions
    /** 已结构化的最终仲裁说明；缺失则不渲染本章 */
    arbitrationNotes?: ArbitrationNotes
    /** compare 页无 CRITIQUE 章，调用方置 false */
    showCritique?: boolean
    critiqueTitle?: string
    suggestionsTitle?: string
    arbitrationTitle?: string
    sceneTypeRulingLabel?: string
    decisionsLabel?: string
    finalRationaleLabel?: string
    decisionAcceptLabel?: string
    decisionPartialLabel?: string
    decisionRejectLabel?: string
    decisionConsensusLabel?: string
  }>(),
  {
    critique: '',
    suggestions: () => [],
    arbitrationNotes: undefined,
    showCritique: true,
    critiqueTitle: '专业点评',
    suggestionsTitle: '改进建议',
    arbitrationTitle: '裁决说明',
    sceneTypeRulingLabel: '场景判定',
    decisionsLabel: '争议裁决',
    finalRationaleLabel: '最终理由',
    decisionAcceptLabel: '采纳',
    decisionPartialLabel: '部分采纳',
    decisionRejectLabel: '驳回',
    decisionConsensusLabel: '共识',
  },
)

const decisionLabels = computed<Record<ArbitrationDecisionType, string>>(() => ({
  accept: props.decisionAcceptLabel,
  partial: props.decisionPartialLabel,
  reject: props.decisionRejectLabel,
  consensus: props.decisionConsensusLabel,
}))
</script>

<template>
  <section class="editorial-report-body">
    <div v-if="props.showCritique && props.critique" class="report-chapter">
      <UiBaseSectionIndex>CRITIQUE</UiBaseSectionIndex>
      <h3 class="chapter-title">{{ props.critiqueTitle }}</h3>
      <div class="critique-text">
        <UiBaseMarkdown :content="props.critique" final />
      </div>
    </div>

    <div v-if="props.suggestions.length" class="report-chapter report-suggestions">
      <UiBaseSectionIndex>ACTION</UiBaseSectionIndex>
      <h3 class="chapter-title">{{ props.suggestionsTitle }}</h3>
      <ol class="suggestion-list">
        <li v-for="(suggestion, index) in props.suggestions" :key="index">
          {{ suggestion }}
        </li>
      </ol>
    </div>

    <div v-if="props.arbitrationNotes" class="report-chapter report-arbitration">
      <UiBaseSectionIndex>VERDICT</UiBaseSectionIndex>
      <h3 class="chapter-title">{{ props.arbitrationTitle }}</h3>
      <div class="arbitration-sections">
        <section class="arbitration-block">
          <h4>{{ props.sceneTypeRulingLabel }}</h4>
          <p>{{ props.arbitrationNotes.sceneTypeRuling }}</p>
        </section>

        <section v-if="props.arbitrationNotes.decisions.length" class="arbitration-block">
          <h4>{{ props.decisionsLabel }}</h4>
          <ol class="decision-list">
            <li v-for="(decision, index) in props.arbitrationNotes.decisions" :key="index">
              <div class="decision-heading">
                <span class="decision-target">{{ decision.target }}</span>
                <span class="decision-status" :data-decision="decision.decision">
                  {{ decisionLabels[decision.decision] }}
                </span>
              </div>
              <p>{{ decision.reason }}</p>
            </li>
          </ol>
        </section>

        <section class="arbitration-block arbitration-final">
          <h4>{{ props.finalRationaleLabel }}</h4>
          <p>{{ props.arbitrationNotes.finalRationale }}</p>
        </section>
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

.suggestion-list,
.arbitration-sections {
  color: var(--ink-body);
  font-size: 16px;
  line-height: 1.78;
  max-width: 42rem;
}

/* venus style.css L940：§9.12 仲裁说明 Display Serif 承载 */
.arbitration-sections {
  font-family: var(--font-display);
  font-size: 18px;
  line-height: 1.75;
}

.suggestion-list,
.decision-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.suggestion-list {
  counter-reset: suggestions;
  display: grid;
  gap: var(--space-4);
}

.suggestion-list li {
  align-items: baseline;
  counter-increment: suggestions;
  display: grid;
  gap: var(--space-3);
  grid-template-columns: 2rem 1fr;
}

.suggestion-list li::before {
  color: var(--amber);
  content: counter(suggestions, decimal-leading-zero);
  font-family: var(--font-data);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.arbitration-sections {
  display: grid;
  gap: var(--space-5);
}

.arbitration-block h4 {
  color: var(--ink-muted);
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.08em;
  margin: 0 0 var(--space-2);
  text-transform: uppercase;
}

.arbitration-block p {
  margin: 0;
}

.decision-list {
  display: grid;
  gap: var(--space-4);
}

.decision-list li {
  border-top: 1px solid var(--hairline);
  padding-top: var(--space-3);
}

.decision-heading {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.decision-target {
  color: var(--ink);
  font-family: var(--font-data);
  font-size: 13px;
  font-weight: 600;
}

.decision-status {
  border: 1px solid var(--hairline-strong);
  border-radius: 999px;
  color: var(--ink-muted);
  font-family: var(--font-ui);
  font-size: 11px;
  font-weight: 650;
  line-height: 1;
  padding: 4px 8px;
}

.decision-status[data-decision='accept'],
.decision-status[data-decision='consensus'] {
  border-color: var(--verdigris);
  color: var(--verdigris);
}

.decision-status[data-decision='partial'] {
  border-color: var(--amber);
  color: var(--amber);
}

.decision-status[data-decision='reject'] {
  border-color: var(--oxide);
  color: var(--oxide);
}

.arbitration-final {
  border-left: 2px solid var(--hairline-strong);
  padding-left: var(--space-4);
}

@media (max-width: 767px) {
  .report-suggestions {
    padding-left: 16px;
  }
}
</style>
