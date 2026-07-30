<script setup lang="ts">
/**
 * 章节索引标签：`INPUT` / `RESULT` / `MODES` 等章节眉标（DESIGN.md §4.2、§6.2 Eyebrow），
 * 对应 venus `.section-index` / `.home-section-index`。
 *
 * - 两个源 class 在 venus 中共享同一条 CSS 规则、视觉完全相同，故不设 variant，
 *   统一输出 `.section-index`；调用方如需语义区分可经 attrs 追加 class（自动合并）。
 * - 内容归调用方 default slot（零内部文案）；§6.2 的「不超过 24 个字符」约束归调用方。
 * - 与标题的间距归父容器（venus 由兄弟 `h2 { margin-top: var(--space-3) }` 承担），
 *   组件不带 margin。
 */
</script>

<template>
  <span class="section-index"><slot /></span>
</template>

<style scoped>
/* venus .section-index/.home-section-index 逐属性对齐（font 简写拆开）。
 * §6.2 Eyebrow：11px Mono、0.08em 字距；amber 随 Paper/Darkroom token 自动切换。 */
.section-index {
  color: var(--amber);
  font-family: var(--font-data);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  line-height: 1.4;
  text-transform: uppercase;
}
</style>
