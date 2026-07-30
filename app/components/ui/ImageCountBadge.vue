<script setup lang="ts">
/**
 * 已选数量徽章：大号 Data Mono 计数 + 小字标签（DESIGN.md §4.2 帧号/图像索引、§6.1 Data Mono），
 * 对应 venus `.image-count-badge`（style.css L625-634、L1150-1151；group.css L13-15）。
 *
 * - `group` 变体（group-joint/group-compare.html L54）：`n` + `/ 10 FRAMES`，
 *   计数贴源 group.js L236 `String(count)`——无补零、无 FRAME/FRAMES 单复数变化，
 *   span 文案静态；`max` 默认 10（group.js L46 MAX_GROUP_IMAGES），prop 化避免
 *   常量泄漏进基础组件，由未来 useImageSelection 消费方传入。
 * - `single` 变体（single.html L61-63）：完全静态 `01` + `ONE FRAME`，
 *   帧号为固定文案而非计数，故忽略 `count`/`max`。
 * - aria-label 按变体给默认值（逐字贴源），调用方 attrs 传入时经 fallthrough 覆盖；
 *   不加 aria-live：计数播报归父级 SelectionToolbar 的 live region（§14.5 避免重复朗读）。
 */
const props = withDefaults(
  defineProps<{
    variant?: 'group' | 'single'
    count?: number
    max?: number
  }>(),
  { variant: 'group', count: 0, max: 10 },
)

// single 复合 venus 的 `image-count-badge single-image-badge` 结构（同 BaseBadge severity 模式）
const classes = computed(() =>
  props.variant === 'single'
    ? ['image-count-badge', 'single-image-badge']
    : ['image-count-badge'],
)

const ariaLabel = computed(() => (props.variant === 'single' ? '单张照片' : '已选照片数量'))
</script>

<template>
  <div :class="classes" :aria-label="ariaLabel">
    <template v-if="props.variant === 'single'">
      <strong>01</strong><span>ONE FRAME</span>
    </template>
    <template v-else>
      <strong>{{ String(props.count) }}</strong><span>/ {{ props.max }} FRAMES</span>
    </template>
  </div>
</template>

<style scoped>
/* venus .image-count-badge 逐属性对齐（style.css L625-632）。
 * §8.2 交互控件级 1px Hairline Strong 边框；padding 20px 沿用源值
 * （非 §7.1 梯度管辖，贴源 style.css L627，先例同 CardHeading 的 10px）。 */
.image-count-badge {
  background: transparent;
  border: 1px solid var(--hairline-strong);
  border-radius: var(--radius-sm);
  min-width: 124px;
  padding: 20px;
  text-align: left;
}

/* venus .image-count-badge strong（style.css L633，font 简写拆开，同 BaseSectionIndex） */
.image-count-badge strong {
  color: var(--ink);
  display: block;
  font-family: var(--font-data);
  font-size: 46px;
  font-weight: 500;
  letter-spacing: -0.06em;
  line-height: 0.9;
}

/* venus .image-count-badge span（style.css L634）；margin-top 10px 沿用源值（非 §7.1 梯度管辖） */
.image-count-badge span {
  color: var(--ink-muted);
  display: block;
  font-family: var(--font-data);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.04em;
  line-height: 1;
  margin-top: 10px;
}

/* venus 单图变体覆盖（group.css L13-15） */
.single-image-badge {
  min-width: 112px;
}

/* venus 移动端覆盖（style.css L1150-1151，断点与源一致） */
@media (max-width: 767px) {
  .image-count-badge {
    align-items: baseline;
    display: flex;
    justify-content: space-between;
    width: 100%;
  }

  .image-count-badge span {
    margin: 0;
  }
}
</style>
