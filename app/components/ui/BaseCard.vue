<script setup lang="ts">
/**
 * 卡片外壳：Panel / Plain 两个变体（DESIGN.md §8）。
 *
 * - `panel` 为 §8 标准面板（paper-raised 表面 + Hairline + radius-md），对应 venus
 *   `.input-sheet` / `.group-input-card` 一类输入与摘要卡。
 * - `plain` 只保留结构，对应 venus 报告分节（`.score-sheet` / `.report-disclosure`
 *   / `.group-metadata-card`）：表面为空，分隔线归各分节组件自己声明。
 * - 边框/圆角的个别偏移（如系列摘要卡的 amber 左边线）由调用方传 class 覆盖，
 *   不在此加 props。
 */
const props = withDefaults(
  defineProps<{
    as?: 'section' | 'article' | 'div' | 'aside'
    variant?: 'panel' | 'plain'
  }>(),
  { as: 'section', variant: 'panel' },
)

const classes = computed(() =>
  props.variant === 'panel' ? ['card', 'card-panel'] : ['card'],
)
</script>

<template>
  <component :is="props.as" :class="classes">
    <slot />
  </component>
</template>

<style scoped>
/* 常作 grid/flex 子项，min-width 归零避免长内容撑破 320px（§13.2） */
.card {
  min-width: 0;
}

/* §8：层级由表面色差、Hairline 与留白建立，普通卡片不得有阴影（§8.3）。
 * padding 取自间距梯度（§7.1），故为 24→48px 而非 venus 的 28→48px。 */
.card-panel {
  background: var(--paper-raised);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-md);
  padding: clamp(var(--space-5), 4vw, var(--space-7));
}
</style>
