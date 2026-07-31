<script setup lang="ts">
/**
 * 批判者质疑项列表：维度 → 建议分 / 问题 / 证据
 * （component-plan L121），收敛 venus app.js L707-715 与 group.js L944-964
 * 两份 challenge-list DOM 实现为声明式组件。
 *
 * - 语义化升级：<ul>/<li> 替代 venus 的 div 堆叠（质疑项为可数列表，
 *   StreamSteps <ol> 升级先例）；list-style: none 保持视觉一致。
 * - 维度名解析：resolveDimensionName（shared/utils/format.ts，DimensionList L42
 *   先例）——genre/metadata props 与 DimensionList L24-34 完全同构，
 *   metadata 缺省时回退原始 key（utils.js L94）。
 * - 建议分尾缀：取 group.js L952-954 健壮版——null/非有限值时不渲染箭头
 *   （修正 app.js L710 的 `'-'` 硬渲染），NaN 防御对齐 DimensionList L44 决策。
 * - issue/evidence 为纯文本插值（venus 源 L711-712 亦为 textContent，非 Markdown）。
 * - 纯 props 组件不内嵌 $t()：文案均为数据驱动，无固定文案。
 */
import type { ChallengeItem, GenreMetadata } from '#shared/types/evaluation'

const props = withDefaults(
  defineProps<{
    /** 质疑项列表（camelCase 归一后形状，Flow 映射层产出） */
    challenges: ChallengeItem[]
    /** 当前门类（resolveDimensionName 首选查找路径） */
    genre?: string
    /** 门类元数据（/api/metadata 响应；缺省时名称回退原始 key，venus utils.js L94） */
    metadata?: Record<string, GenreMetadata> | null
  }>(),
  { genre: '', metadata: null },
)

// group.js L947-961：单次遍历派生行数据
const items = computed(() =>
  props.challenges.map(challenge => {
    const score = challenge.suggestedScore
    return {
      dimensionLabel: resolveDimensionName(challenge.dimension, props.genre, props.metadata),
      // group.js L952-954：score != null 才渲染箭头；NaN 防御（DimensionList L44 先例）
      scoreSuffix: score != null && Number.isFinite(score) ? ` → ${score.toFixed(1)}` : '',
      issue: challenge.issue,
      evidence: challenge.evidence,
    }
  }),
)
</script>

<template>
  <ul v-if="challenges.length" class="challenge-list">
    <!-- group.js L944：challenges 为空时不渲染整个列表（注释置于根内，
      避免多根 fragment 破坏 attrs 透传——ScorePanel 先例） -->
    <li v-for="(item, index) in items" :key="index" class="challenge-item">
      <div class="challenge-dimension">{{ item.dimensionLabel }}{{ item.scoreSuffix }}</div>
      <div class="challenge-issue">{{ item.issue }}</div>
      <div class="challenge-evidence">{{ item.evidence }}</div>
    </li>
  </ul>
</template>

<style scoped>
/* venus style.css L972 */
.challenge-list {
  border-top: 1px solid var(--hairline);
  display: grid;
  gap: 0;
  list-style: none;
  margin-top: var(--space-4);
  min-width: 0;
}

/* venus style.css L973 */
.challenge-item {
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--hairline);
  min-width: 0;
  padding: var(--space-4) 0;
}

/* venus style.css L974：font 简写拆开为 family/size/weight/line-height（StreamSteps 先例） */
.challenge-dimension {
  color: var(--amber);
  font-family: var(--font-data);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
}

/* venus style.css L975 */
.challenge-issue {
  color: var(--ink);
  font-size: 14px;
  margin-top: 6px;
  overflow-wrap: anywhere;
}

/* venus style.css L976 */
.challenge-evidence {
  color: var(--ink-muted);
  font-size: 13px;
  margin-top: 6px;
  overflow-wrap: anywhere;
}
</style>
