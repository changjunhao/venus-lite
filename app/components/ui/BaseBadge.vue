<script setup lang="ts">
/**
 * 过程步骤徽章：Step Score / Step Tag / Severity 三类五变体（DESIGN.md §9.9），
 * 对应 venus `.step-score` / `.step-tag` / `.severity-tag`。
 *
 * - 纯文本补充信息（「评分：8.5」「质疑程度：高」），内容归调用方 default slot，
 *   severity 大写枚举（HIGH/MEDIUM/LOW）到 variant 的映射由调用方负责。
 * - severity 语义色遵循 §5.1：high→oxide（关键反驳）、medium→amber（当前状态）、
 *   low→中性，不用颜色单独承担语义（文案由调用方给出）。
 */
const props = withDefaults(
  defineProps<{
    variant?: 'step-score' | 'step-tag' | 'severity-low' | 'severity-medium' | 'severity-high'
  }>(),
  { variant: 'step-score' },
)

// severity 变体复合 venus 的 `severity-tag severity-*` 结构（class 归一为小写）
const classes = computed(() =>
  props.variant.startsWith('severity-') ? ['severity-tag', props.variant] : [props.variant],
)
</script>

<template>
  <span :class="classes"><slot /></span>
</template>

<style scoped>
/* venus .step-score/.step-tag/.severity-tag 基础样式。
 * inline-block 为对源的补充：源徽章依赖父级 .step-title 的 flex 布局，
 * 独立使用时保证 4px 纵向 padding 正常撑开。 */
.step-score,
.step-tag,
.severity-tag {
  border: 1px solid var(--hairline);
  border-radius: var(--radius-sm);
  color: var(--ink-muted);
  display: inline-block;
  flex-shrink: 0;
  font-family: var(--font-data);
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
  padding: 4px 7px;
}

/* §5.1 severity 语义色：仅覆盖边框与文字，随 Paper/Darkroom token 自动切换 */
.severity-high {
  border-color: var(--oxide);
  color: var(--oxide);
}

.severity-medium {
  border-color: var(--amber);
  color: var(--amber);
}

.severity-low {
  border-color: var(--hairline-strong);
  color: var(--ink-muted);
}
</style>
