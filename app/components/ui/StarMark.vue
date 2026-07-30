<script setup lang="ts">
/**
 * 品牌星芒：四向星芒 SVG 标识（DESIGN.md §4.1），
 * 对应 venus 四页导航/页脚重复内联 SVG（index.html L30/L155、
 * single/group-joint/group-compare.html L31），path 与
 * share-image.js `drawNorthStarMark` 的 points 坐标同源。
 *
 * - 颜色不进组件：venus 事实是父级经 `color` 控制
 *   （style.css L188-190 `.site-brand svg { color: var(--amber) }`，
 *   分享图页脚用 ink），`fill="currentColor"` 继承即可，故无 color prop。
 * - `aria-hidden="true"` 硬编码：venus 全部 5 处实例均为装饰性星芒
 *   （§14.4），prop 化属无消费方的投机设计。
 * - §4.1 尺寸约束归调用方：最小 18px（页脚），导航推荐 22–24px；
 *   默认 22 取 venus 出现频次最高值（三个评估页导航），
 *   不做运行时校验（同 CardHeading 将 ≤24 字符约束归调用方的先例）。
 */
const props = withDefaults(
  defineProps<{
    size?: number
  }>(),
  { size: 22 },
)
</script>

<template>
  <!-- viewBox 固定 32 网格，width/height 随 size 缩放不失真（贴源，非 CSS 变量间接层） -->
  <svg :width="props.size" :height="props.size" viewBox="0 0 32 32" aria-hidden="true">
    <path d="M16 0L18.5 13.5L32 16L18.5 18.5L16 32L13.5 18.5L0 16L13.5 13.5L16 0Z" fill="currentColor" />
  </svg>
</template>
