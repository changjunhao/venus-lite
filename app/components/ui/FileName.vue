<script setup lang="ts">
/**
 * 文件名截断展示：主体可截断、扩展名保留（DESIGN.md §13.2），
 * 对应 venus `createFileNameElement`（group.js L499-L515）与
 * `.file-name`/`.file-stem`/`.file-ext`（style.css L795-L797）。
 *
 * - 拆分逻辑归 `shared/utils/format.ts#splitFileName`（component-plan.md §2.5），
 *   排名/对比/逐图明细等后续组件共同复用。
 * - `title` 归组件根而非调用方父元素（对源的唯一收敛）：venus 各调用点
 *   自行在 strong/h4 上挂 title，组件化后完整名的可访问出口应随组件走，
 *   调用方不再重复负担；不加 aria-label——无 role 的 span 上不被 AT 可靠支持。
 * - 字体/颜色不进组件：venus 源三条规则均为纯结构样式，排版由
 *   `.preview-meta strong`、`.compare-focus-score h4` 等调用上下文承担。
 */
const props = defineProps<{
  name: string
}>()

const parts = computed(() => splitFileName(props.name))
</script>

<template>
  <span class="file-name" :title="props.name">
    <span class="file-stem">{{ parts.stem }}</span>
    <span v-if="parts.ext" class="file-ext">{{ parts.ext }}</span>
  </span>
</template>

<style scoped>
/* venus .file-name/.file-stem/.file-ext 逐属性对齐（style.css L795-L797）。
 * 纯 CSS 截断：零 JS 开销、容器 resize 自适应、无 hydration 风险。 */
.file-name {
  align-items: baseline;
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
}

/* 主体承担全部收缩，ellipsis 只发生在这里 */
.file-stem {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 扩展名不收缩不换行（§13.2：截断时保留扩展名） */
.file-ext {
  flex-shrink: 0;
  white-space: nowrap;
}
</style>
