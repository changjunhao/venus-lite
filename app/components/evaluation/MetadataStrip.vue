<script setup lang="ts">
/**
 * 元数据条：照片数/耗时/轮次/时间，按传入项渲染 + 尾部操作 slot
 * （component-plan L125），收敛 venus single.html L173-185 /
 * group-joint.html L156-161 / group-compare.html L167-172 `.metadata`
 * 静态结构与 app.js L558-562 / group.js L563-567 的 DOM 填充为声明式组件。
 *
 * - 单图页 3 项（耗时/轮次/时间）与组图页 4 项（照片数量/耗时/轮次/时间）
 *   的差异由调用方传入项决定——组件不硬编码条目（「按传入项渲染」）。
 * - value 为调用方预格式化字符串：formatDuration（耗时）/
 *   formatDateTime（时间）/ String（照片数、轮次）；rounds 缺失时 '-'
 *   回退归 Flow 映射层（app.js L561 `meta.rounds || '-'`），组件纯展示。
 * - labels 由调用方解析 i18n（result.meta.* 键）后传入——纯 props
 *   组件不内嵌 $t()（先例 ResultMasthead title / ExifPanel labels）。
 * - 尾部 actions slot 对应 single.html L179-184 `.share-action`
 *   （分享按钮）；组图页无操作区（group-joint.html L156-161），
 *   未提供 slot 时容器不渲染。
 * - 根级 v-if="items.length"：空项不渲染（DESIGN §2.5「为空时不显示容器」）。
 * - 不含 .card 外壳——卡片归 Flow 以 BaseCard variant="plain" 包裹
 *   （BaseCard L7-8 注释已锚定 `.group-metadata-card` 为 plain 先例）；
 *   分隔线（border-top）归本分节组件自己声明（BaseCard L8 约定）。
 * - 纯展示：无状态、无 watcher、无 computed——items 即最终展示形态，
 *   v-for 直渲染，SSR 零额外客户端开销。
 */

/** 元数据条单项（value 为调用方预格式化字符串） */
interface MetadataStripItem {
  /** 条目标签（调用方解析 i18n result.meta.* 后传入） */
  label: string
  /** 条目值（调用方经 formatDuration/formatDateTime/String 格式化） */
  value: string
}

const props = defineProps<{
  /** 元数据条目序列（单图 3 项 / 组图 4 项，按传入项渲染） */
  items: MetadataStripItem[]
}>()
</script>

<template>
  <div v-if="props.items.length" class="metadata-strip">
    <!-- venus style.css L987：4 列 1px gap hairline 网格 -->
    <div class="metadata">
      <!-- venus HTML 顺序：value 在上、label 在下（single.html L175-177）；
           :key 取 label——同一条内标签天然唯一（照片数量/评估耗时/评估轮次/评估时间） -->
      <div v-for="item in props.items" :key="item.label" class="meta-item">
        <div class="meta-value">{{ item.value }}</div>
        <div class="meta-label">{{ item.label }}</div>
      </div>
    </div>
    <!-- single.html L179-184 .share-action：尾部操作区（分享按钮），未提供时不渲染 -->
    <div v-if="$slots.actions" class="metadata-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
/* venus style.css L985-986 .report-metadata：分隔线与间距归分节组件声明 */
.metadata-strip {
  border-top: 1px solid var(--hairline);
  margin-top: var(--space-5);
  padding: var(--space-5) 0;
}

/* venus style.css L987：gap + background 形成 1px hairline 分隔网格 */
.metadata {
  background: var(--hairline);
  border: 1px solid var(--hairline);
  display: grid;
  gap: 1px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

/* venus style.css L988；padding 14px 不在 §7.1 梯度内，贴源保留（ResultMasthead L73 先例） */
.meta-item {
  background: var(--paper);
  min-width: 0;
  padding: 14px;
  text-align: left;
}

/* venus style.css L989-990：font 简写拆开（DimensionList L146 先例）；
 * §6.2 分数/耗时启用 tabular-nums */
.meta-value {
  color: var(--ink);
  font-family: var(--font-data);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  line-height: 1.3;
}

/* venus style.css L991-992；margin-top 5px 贴源保留 */
.meta-label {
  color: var(--ink-muted);
  font-family: var(--font-data);
  font-size: 10px;
  font-weight: 500;
  line-height: 1.4;
  margin-top: 5px;
}

/* venus style.css L993 .share-action */
.metadata-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-4);
}

/* venus style.css L1170 —— ≤767px 两列 */
@media (max-width: 767px) {
  .metadata {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* DESIGN.md §13.1「元数据：横向单行 → 两列 → 单列」——venus 源码仅实现到两列，
 * 此规则为规范对齐补充（§19：规范为视觉与交互的目标基准） */
@media (max-width: 479px) {
  .metadata {
    grid-template-columns: 1fr;
  }
}
</style>
