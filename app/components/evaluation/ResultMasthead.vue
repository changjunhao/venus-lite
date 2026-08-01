<script setup lang="ts">
/**
 * 结果区头：RESULT 索引 + 标题 + 门类·场景标签（component-plan L124），
 * 收敛 venus single.html L126-129 / group-joint.html L104 / group-compare.html L104
 * `.result-masthead` 静态结构与 app.js L536-539 / group.js L528-538 标签填充
 * 的 DOM 操作为声明式组件。
 *
 * - §4.2：RESULT 为结果区专属章节眉标（英文 ≤24 字符），硬编码于模板
 *   （先例 CritiqueReport 的 CRITIQUE/ACTION/VERDICT）。
 * - §15.1：门类与场景合并为单个标签，按"门类 · 场景"层级排列，不显示前缀词；
 *   tag 文本由调用方经 formatGenreSceneTag 组合后传入（纯 props 约定，
 *   先例 ScorePanel bandLabel）；compare 模式无系列场景，仅传门类
 *   （group.js L537 scene 为空串）。
 * - 标题为结果区一级章节标题，h2 级别固定：结果区直隶页面 h1（PageHero），
 *   venus 三页均为 h2（single.html L127 / group-joint.html L104）。
 * - 纯 props 组件不内嵌 $t()：标题由调用方解析 i18n result.title* 后传入。
 * - 纯展示：无状态、无 watcher，SSR 零额外客户端开销。
 */
const props = withDefaults(
  defineProps<{
    /** 结果标题（单图评估结果 / 组图联合评估结果 / 组图对比评估结果）；调用方解析 i18n result.title* 后传入 */
    title: string
    /** 门类·场景标签（调用方经 formatGenreSceneTag 组合，§15.1）；空则不渲染标签区 */
    tag?: string
  }>(),
  { tag: '' },
)
</script>

<template>
  <div class="result-masthead">
    <!-- single.html L127 / group-joint.html L104：section-index + h2 -->
    <div>
      <UiBaseSectionIndex>RESULT</UiBaseSectionIndex>
      <h2>{{ props.title }}</h2>
    </div>
    <!-- single.html L128 .photo-type-tag / group.js L535 #genre-tag：合并后的单个标签 -->
    <div v-if="props.tag" class="result-tags">
      <span class="result-tag">{{ props.tag }}</span>
    </div>
  </div>
</template>

<style scoped>
/* venus style.css L853-860 */
.result-masthead {
  align-items: flex-end;
  border-bottom: 1px solid var(--hairline-strong);
  display: flex;
  gap: var(--space-5);
  justify-content: space-between;
  padding: 0 0 var(--space-6);
}

/* venus style.css L615-621（.group-intro h2 共享规则）：§6.2 Section Display；
 * color/font-family/font-weight/text-wrap 由 main.css 全局 h1-h3 承担，不重复声明 */
.result-masthead h2 {
  font-size: clamp(30px, 3.3vw, 40px);
  line-height: 1.12;
  margin-top: var(--space-3);
}

/* venus style.css L861 */
.result-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: flex-end;
}

/* venus style.css L862-874：门类与场景合并标签使用中性表面；
 * Amber 保留给状态与主操作（§5.3）。font 简写拆开（BaseSectionIndex 先例）；
 * padding 0 10px 不在 §7.1 梯度内，贴源保留（先例 ResultSample frame-index） */
.result-tag {
  align-items: center;
  background: transparent;
  border: 1px solid var(--hairline-strong);
  border-radius: var(--radius-sm);
  color: var(--ink-body);
  display: inline-flex;
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  min-height: 32px;
  padding: 0 10px;
}

/* venus style.css L1164-1165：移动端纵向堆叠 */
@media (max-width: 767px) {
  .result-masthead {
    align-items: flex-start;
    flex-direction: column;
  }

  .result-tags {
    justify-content: flex-start;
  }
}
</style>
