<script setup lang="ts">
/**
 * 维度评分列表：水平维度条 + 名称解析 + 进度条延迟动画
 * （component-plan L117），收敛 venus app.js L641-660 renderDimensions
 * 与 group.js L608-633 两份实现的 DOM 操作为声明式组件。
 *
 * - §9.11：水平维度条，Hairline 轨与 Amber 填充，行间细线分隔，
 *   分数 tabular-nums 右对齐，维度名称完整中文。
 * - §5.4：区间色只用于小型标签与维度条末端——venus 原版填充恒为 Amber
 *   （style.css L924），末端区间色属已知缺口（先例 ScorePanel L20-21 注释）。
 * - 两版归一决策：NaN 防御（显示 '-'）与 clamp(0,10) 取 group.js L628/L631
 *   健壮版本（修正 app.js L653/L657 无防御缺陷）；交错延迟取 app.js L656-658
 *   的 setTimeout(100 + index×100) 节奏（group.js L615 animationDelay 为死代码）。
 * - 动画等价：CSS 基态 width:0，mounted 后单个 rAF 翻转 animated，
 *   各行 transition-delay 内联（100 + i×100 ms）——零定时器、SSR 安全
 *   （ScorePanel L50-58 rAF 范式）。
 * - 名称解析：resolveDimensionName（shared/utils/format.ts，逐行移植
 *   venus utils.js L79-95）；metadata 缺省时回退原始 key（utils.js L94）。
 * - 纯 props 组件不内嵌 $t()：aria-label 由调用方经 attrs 传入
 *   （页面差异：single.html L150「维度评分」/ group-joint.html L124「系列维度评分」）。
 */
import type { GenreMetadata } from '#shared/types/evaluation'

const props = withDefaults(
  defineProps<{
    /** 维度评分映射（API 原始形状 Record<key, score>，app.js L644 Object.entries 遍历） */
    dimensions: Record<string, number>
    /** 当前门类（resolveDimensionName 首选查找路径） */
    genre?: string
    /** 门类元数据（/api/metadata 响应；缺省时名称回退原始 key，venus utils.js L94） */
    metadata?: Record<string, GenreMetadata> | null
  }>(),
  { genre: '', metadata: null },
)

// app.js L644-654 + group.js L611-628：单次遍历派生行数据
const items = computed(() =>
  Object.entries(props.dimensions).map(([key, rawValue]) => {
    const value = Number(rawValue)
    return {
      key,
      label: resolveDimensionName(key, props.genre, props.metadata),
      // group.js L628：NaN 防御 → '-'
      displayScore: Number.isFinite(value) ? value.toFixed(1) : '-',
      // group.js L631：clamp(0, 10) × 10%
      fillWidth: `${Math.max(0, Math.min(10, Number.isFinite(value) ? value : 0)) * 10}%`,
    }
  }),
)

// app.js L656-658 setTimeout(100 + index×100) 的声明式等价：
// 初始 width:0（CSS 基态），mounted 后 rAF 翻转 animated，
// 各行 transition-delay 内联，CSS transition 自动交错播放。
// reduced-motion：duration 由 tokens.css L102-116 全局降为 1ms，
// delay 需组件补丁（scoped style 内 prefers-reduced-motion 归零）。
const animated = ref(false)
let rafId = 0
onMounted(() => {
  rafId = requestAnimationFrame(() => {
    animated.value = true
  })
})
onBeforeUnmount(() => cancelAnimationFrame(rafId))
// dimensions 变更时同步更新（重新评估不重挂载场景，ScorePanel L59-62 先例）
watch(() => props.dimensions, () => {
  animated.value = true
})
</script>

<template>
  <div class="dimension-list">
    <!-- app.js L644-654：每行 label + bar + score 三列结构 -->
    <div v-for="(item, index) in items" :key="item.key" class="dimension-item">
      <span class="dimension-label">{{ item.label }}</span>
      <!-- §14.4：bar 为装饰性重复编码，信息已由 label + score 文本表达 -->
      <div class="dimension-bar" aria-hidden="true">
        <div
          class="dimension-fill"
          :style="{
            width: animated ? item.fillWidth : '0%',
            transitionDelay: `${100 + index * 100}ms`,
          }"
        />
      </div>
      <span class="dimension-score">{{ item.displayScore }}</span>
    </div>
  </div>
</template>

<style scoped>
/* venus style.css L910 */
.dimension-list {
  display: grid;
  min-width: 0;
}

/* venus style.css L911-919：三列 grid + 行间 hairline 分隔 */
.dimension-item {
  align-items: center;
  border-bottom: 1px solid var(--hairline);
  display: grid;
  gap: var(--space-4);
  grid-template-columns: minmax(0, 5.5rem) minmax(40px, 1fr) 2.25rem;
  min-width: 0;
  padding: 11px 0;
}

/* venus style.css L920-921 */
.dimension-item:first-child {
  padding-top: 0;
}

.dimension-item:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

/* venus style.css L922 */
.dimension-label {
  color: var(--ink-body);
  font-size: 13px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* venus style.css L923：3px Hairline 轨 */
.dimension-bar {
  background: var(--hairline);
  border-radius: 0;
  height: 3px;
  min-width: 0;
  overflow: hidden;
}

/* venus style.css L924：Amber 填充 + width transition（app.js L656-658 的声明式等价） */
.dimension-fill {
  background: var(--amber);
  border-radius: 0;
  height: 100%;
  transition: width var(--motion-slow) var(--ease-enter);
  width: 0;
}

/* venus style.css L925：font 简写拆开为 family/size/weight/line-height（StreamSteps 先例） */
.dimension-score {
  color: var(--ink);
  font-family: var(--font-data);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  line-height: 1;
  text-align: right;
}

/* §12.5 补丁：tokens.css L102-116 只压 duration 不压 delay，交错延迟需显式归零 */
@media (prefers-reduced-motion: reduce) {
  .dimension-fill {
    transition-delay: 0ms !important;
  }
}
</style>
