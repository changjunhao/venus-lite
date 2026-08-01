<script setup lang="ts">
/**
 * 逐图明细网格：按 index 排序 + entries 连接（component-plan L132），
 * 收敛 venus group.js L852-895 renderPerImage 的排序/查表/遍历逻辑
 * 为声明式容器组件，单卡渲染委托 EvaluationPerImageCard。
 *
 * - 排序归组件而非 Flow：逐图明细域固有语义——源 group.js L857 即在
 *   渲染函数内排序；组件内排序保证「无论调用方传入顺序如何，渲染恒按
 *   index 升序」的不变量；n≤10 开销可忽略。
 * - 单个 computed 完成排序 + 连接（RankingList L62-66 同构先例）：
 *   只随 items/entries 引用变更重算一次，替代源每次 renderPerImage
 *   全量重建；PerImageCard 保持无查找逻辑。
 * - :key="detail.index"：schema 保证 0..n-1 唯一排列
 *   （venus-core schema/group.ts）；index 跨重评估稳定。
 * - §9.14：perImage 缺失或为空时不渲染整个逐图明细区域——该守卫归
 *   Flow 编排（v-if 优于 hidden：零 DOM 零 markstream 实例）；
 *   本组件空 items 时仅渲染空容器（RankingList L21 先例）。
 * - 不含 section 外壳（.per-image-section margin/border，style.css L1032）
 *   与 CardHeading（PER IMAGE / 逐图明细）——归 Flow 编排
 *   （group-joint.html L141-143 先例：外壳与 heading 在 grid 外）。
 * - 数据流单向：items 从 useEvaluationStream complete 事件 → Flow →
 *   本组件只读消费；entries 从 useImageSelection → Flow 只读消费。
 */
import type { PerImageDetail } from '#shared/types/evaluation'
import type { ImageEntry } from '~/composables/useImageSelection'

const props = withDefaults(
  defineProps<{
    /** 逐图明细数据（GroupJointEvaluationResult.perImage / GroupCompareEvaluationResult.perImage，原始顺序任意） */
    items: PerImageDetail[]
    /** 已选文件条目（useImageSelection().entries 只读消费，按 index 查找） */
    entries: ImageEntry[]
    /** 透传 PerImageCard：img alt 模板 */
    altTemplate?: string
    /** 透传 PerImageCard：缺图回退名模板 */
    fallbackNameTemplate?: string
  }>(),
  {
    altTemplate: undefined,
    fallbackNameTemplate: undefined,
  },
)

/** getEntryByIndex 等价（group.js L859）：越界/非整数 → null */
function resolveEntry(index: number): ImageEntry | null {
  return Number.isInteger(index) && index >= 0 && index < props.entries.length
    ? (props.entries[index] ?? null)
    : null
}

/** group.js L857：index 升序排序 + entry 连接，单次派生 */
const cards = computed(() =>
  [...props.items]
    .sort((a, b) => Number(a.index) - Number(b.index))
    .map((detail) => ({ detail, entry: resolveEntry(Number(detail.index)) })),
)
</script>

<template>
  <div class="per-image-grid">
    <!-- group-joint.html L142：.per-image-grid 容器 -->
    <EvaluationPerImageCard
      v-for="card in cards"
      :key="card.detail.index"
      :detail="card.detail"
      :entry="card.entry"
      :alt-template="props.altTemplate"
      :fallback-name-template="props.fallbackNameTemplate"
    />
  </div>
</template>

<style scoped>
/* venus style.css L1033：2 列 grid + 等高行（卡片等高 → 所有暗色
 * 视框同尺寸，§9.8）；区别于 ranking-list 在 ≤1279px 降 1 列——
 * per-image 卡片更紧凑（160px media），2 列保持至 ≤767px */
.per-image-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: 1fr;
  gap: var(--space-4);
}

/* venus style.css L1175-1176：≤767px 降 1 列 + 取消等高，
 * 避免短文本卡片拉出过高的视框 */
@media (max-width: 767px) {
  .per-image-grid {
    grid-template-columns: 1fr;
    grid-auto-rows: auto;
  }
}
</style>
