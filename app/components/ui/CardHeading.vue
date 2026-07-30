<script setup lang="ts">
/**
 * 卡片标题：mono 眉标 + h3（DESIGN.md §4.2 章节眉标、§6.2 Eyebrow），
 * 对应 venus `.card-heading`（style.css L281-286、L1004-1005）。
 *
 * - 眉标走 `eyebrow` prop 而非 slot（偏离「零内部文案」惯例的原因）：
 *   眉标恒为单行短字符串（§6.2 ≤24 字符约束归调用方），prop 使条件渲染
 *   无需 `$slots` 判断，先例同 BaseErrorMessage 的 `message`。
 * - 标题内容归 default slot（零内部文案，同 BaseSectionIndex）；
 *   h3 硬编码：venus 全部 8 处实例均为 h3，层级 prop 属无消费方的投机设计。
 * - 上下文覆盖归调用方 class（BaseCard 既定边界）：
 *   `.comparison-report` 的 margin 收紧、`.compare-focus-heading` flex 变体、
 *   `.joint-contact-column` 暗色列覆盖（其 `--on-dark` 不在 tokens.css）均不在此实现。
 */
const props = withDefaults(
  defineProps<{
    eyebrow?: string
  }>(),
  { eyebrow: '' },
)
</script>

<template>
  <div class="card-heading">
    <span v-if="props.eyebrow">{{ props.eyebrow }}</span>
    <h3><slot /></h3>
  </div>
</template>

<style scoped>
/* venus .card-heading 逐属性对齐（style.css L1004）。
 * §8.2：1px Hairline 分隔线；间距取自 §7.1 梯度。 */
.card-heading {
  border-bottom: 1px solid var(--hairline);
  margin: 0 0 var(--space-5);
  padding-bottom: var(--space-4);
}

/* venus .card-heading > span 逐属性对齐（font 简写拆开，同 BaseSectionIndex）。
 * §6.2 Eyebrow：11px Mono、0.08em 字距；amber 随 Paper/Darkroom token 自动切换。 */
.card-heading > span {
  color: var(--amber);
  font-family: var(--font-data);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  line-height: 1.4;
  text-transform: uppercase;
}

/* 眉标与标题上下相邻，不向两端分离（源注释）；10px 沿用源值（style.css L1005），
 * 非 §7.1 padding 梯度管辖。相邻选择器是对 venus 的唯一有意收紧：
 * 眉标缺席时标题不悬空 10px。 */
.card-heading > span + h3 {
  margin-top: 10px;
}

/* venus .card-heading h3 逐属性对齐（style.css L1005）。26px 为源值，
 * 介于 §6.2 Title Large 24 与 Result Lead 30 之间。
 * 颜色 --ink 与 margin 归零由全局 reset/排版承担，不重复声明。 */
.card-heading h3 {
  font-family: var(--font-display);
  font-size: 26px;
  font-weight: 500;
  line-height: 1.2;
}
</style>
