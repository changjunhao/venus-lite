<script setup lang="ts">
/**
 * 最终排名列表：按 rank 排序 + entries 连接（component-plan L128），
 * 收敛 venus group.js L655-701 renderRanking 的排序/查表/遍历逻辑
 * 为声明式容器组件，单卡渲染委托 EvaluationRankingCard。
 *
 * - 排序归组件而非 Flow：排名域固有语义——源 group.js L657 即在
 *   渲染函数内排序；组件内排序保证「无论调用方传入顺序如何，渲染恒按
 *   rank 升序」的不变量；n≤10 开销可忽略。
 * - 单个 computed 完成排序 + 连接（DimensionList L37-49 单次遍历先例）：
 *   只随 items/entries 引用变更重算一次，替代源每次 renderRanking
 *   全量重排；RankingCard 保持无查找逻辑。
 * - :key="item.index"：schema 保证 0..n-1 唯一排列
 *   （venus-core schema/group.ts L96-110）；index 跨重评估稳定而 rank 可变。
 * - §9.8：2 列 grid + grid-auto-rows:1fr → 卡片等高 → 所有暗色视框
 *   同尺寸（style.css L1015-1016 源注释）；≤1279px 降 1 列，
 *   ≤767px 取消等高（L1074/L1175）。
 * - 不含 CardHeading——「FINAL RANKING / 最终排名」标题归 Flow 编排
 *   （group-compare.html L129 先例：heading 在 .comparison-report 卡壳内、
 *   ranking-list 外）。
 * - 空 items 不做 v-if——隐藏归 Flow（ContactSheet L26-27 先例）。
 * - 数据流单向：items 从 useEvaluationStream complete 事件 → Flow →
 *   本组件只读消费；entries 从 useImageSelection → Flow 只读消费。
 */
import type { RankingItem } from '#shared/types/evaluation'
import type { ImageEntry } from '~/composables/useImageSelection'

const props = withDefaults(
  defineProps<{
    /** 排名数据（GroupCompareEvaluationResult.ranking，原始顺序任意） */
    items: RankingItem[]
    /** 已选文件条目（useImageSelection().entries 只读消费，按 index 查找） */
    entries: ImageEntry[]
    /** 透传 RankingCard：rank=1 标题 */
    winnerTitle?: string
    /** 透传 RankingCard：名次标题模板 */
    rankTitleTemplate?: string
    /** 透传 RankingCard：照片索引标签模板 */
    photoLabelTemplate?: string
    /** 透传 RankingCard：缺图占位文案 */
    missingText?: string
    /** 透传 RankingCard：img alt 模板 */
    altTemplate?: string
  }>(),
  {
    winnerTitle: undefined,
    rankTitleTemplate: undefined,
    photoLabelTemplate: undefined,
    missingText: undefined,
    altTemplate: undefined,
  },
)

/** getEntryByIndex 等价（group.js L635-637）：越界/非整数 → null */
function resolveEntry(index: number): ImageEntry | null {
  return Number.isInteger(index) && index >= 0 && index < props.entries.length
    ? (props.entries[index] ?? null)
    : null
}

/** group.js L657-658：rank 升序排序 + entry 连接，单次派生 */
const cards = computed(() =>
  [...props.items]
    .sort((a, b) => Number(a.rank) - Number(b.rank))
    .map((item) => ({ item, entry: resolveEntry(Number(item.index)) })),
)
</script>

<template>
  <div class="ranking-list">
    <!-- group-compare.html L130：.ranking-list 容器 -->
    <EvaluationRankingCard
      v-for="card in cards"
      :key="card.item.index"
      :item="card.item"
      :entry="card.entry"
      :winner-title="props.winnerTitle"
      :rank-title-template="props.rankTitleTemplate"
      :photo-label-template="props.photoLabelTemplate"
      :missing-text="props.missingText"
      :alt-template="props.altTemplate"
    />
  </div>
</template>

<style scoped>
/* venus style.css L1015-1016：卡片等高 → 所有暗色视框等尺寸（§9.8） */
.ranking-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: 1fr;
  gap: var(--space-4);
}

/* venus style.css L1074：≤1279px 降 1 列 */
@media (max-width: 1279px) {
  .ranking-list {
    grid-template-columns: 1fr;
  }
}

/* venus style.css L1174-1175：单列堆叠时不再强制等高，
 * 避免短文本卡片拉出过高的视框 */
@media (max-width: 767px) {
  .ranking-list {
    grid-auto-rows: auto;
  }
}
</style>
