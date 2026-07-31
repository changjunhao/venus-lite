<script setup lang="ts">
/**
 * 总分面板：大数字 + /10 + 区间文字标签 + 0–10 刻度条
 * （component-plan L116），收敛 venus single.html L141-149 .score-display
 * 与 app.js L614-632 animateScore 的 DOM 操作为声明式组件。
 *
 * - §9.10：综合分数 64–76px Data Mono 真实文本，始终 Ink（§5.4 L238）；
 *   /10 与 caption 为邻近标签；水平刻度条与维度条同一图形语言（3px track）。
 * - §5.4：区间色只用于 .score-band 文字标签；band class 由 getScoreBand 派生
 *   （shared/utils/format.ts 单一来源，component-plan §4.3）。
 * - animateScore 等价：scale-fill width 从 0 过渡到 score×10%
 *   （app.js L628-631 requestAnimationFrame → Vue onMounted + rAF + CSS transition）。
 *   SSR 输出 width:0，客户端水合后播放一次入场过渡，无 hydration mismatch。
 * - 纯 props 组件不内嵌 $t()：band 文字由调用方解析 i18n 后传入
 *   （先例 ResultSample scoreBand prop）；未传时回退 band.label 中文标签。
 * - `/ 10` 与刻度端值 0/10 为评分制数字常量，硬编码于模板
 *   （先例 ResultSample.vue L22-23）。
 * - 不含 .score-sheet grid 布局——布局归 Flow 组件编排
 *   （与 venus 页面级结构分工一致：single.html L140 / group-joint.html L114）。
 * - §5.4「斜线纹理图例」属图例/维度条末端场景（DimensionList 职责），
 *   不在本组件范围——venus 原版亦未实现（style.css L906 仅着色）。
 */
const props = withDefaults(
  defineProps<{
    /** 综合分数 0–10（app.js L616-618 parseFloat + toFixed(1)） */
    score: number
    /** 分数说明标签（single.html L143「综合评分」/ group-joint.html L117「系列综合评分」）；空则不渲染 */
    caption?: string
    /** §5.4 区间文字标签（调用方按 getScoreBand(score).key 解析 i18n）；空则回退 band.label */
    bandLabel?: string
  }>(),
  { caption: '', bandLabel: '' },
)

// app.js L616-617：NaN 防御 → 0
const safeScore = computed(() => {
  const n = Number(props.score)
  return Number.isFinite(n) ? n : 0
})

// app.js L618：toFixed(1) 展示
const displayScore = computed(() => safeScore.value.toFixed(1))

// app.js L622-623：band class 派生（§5.4 单一来源）
const band = computed(() => getScoreBand(safeScore.value))

// app.js L629：clamp(0, 10) × 10%
const fillWidth = computed(() => `${Math.max(0, Math.min(10, safeScore.value)) * 10}%`)

// animateScore 动画等价（app.js L628-631）：
// 初始 width:0（CSS 基态），mounted 后 rAF 设目标值触发 CSS transition。
// reduced-motion 由 tokens.css L102-116 全局降为 1ms，组件零额外代码。
const animatedWidth = ref('0%')
onMounted(() => {
  requestAnimationFrame(() => {
    animatedWidth.value = fillWidth.value
  })
})
// score 变更时同步更新（重新评估不重挂载场景）
watch(fillWidth, (w) => {
  animatedWidth.value = w
})
</script>

<template>
  <div class="score-display">
    <!-- single.html L142：readout — §9.10 真实文本，恒 Ink -->
    <p class="score-readout">
      <span class="score-number">{{ displayScore }}</span>
      <span class="score-max">/ 10</span>
    </p>
    <!-- L143：caption 邻近标签 -->
    <p v-if="caption" class="score-caption">{{ caption }}</p>
    <!-- L144-147：0–10 水平刻度，aria-hidden（信息已由文本表达，§14.4 装饰性） -->
    <div class="score-scale" aria-hidden="true">
      <div class="score-scale-track">
        <div class="score-scale-fill" :style="{ width: animatedWidth }" />
      </div>
      <div class="score-scale-ends"><span>0</span><span>10</span></div>
    </div>
    <!-- L148 + app.js L621-624：区间文字标签 + 区间色（hidden → 始终渲染，组件仅在有结果时挂载） -->
    <p class="score-band" :class="band.colorClass">{{ bandLabel || band.label }}</p>
  </div>
</template>

<style scoped>
/* venus style.css L896 */
.score-display {
  min-width: 0;
  padding: 0;
}

/* venus style.css L897 */
.score-readout {
  align-items: baseline;
  display: flex;
  gap: 5px;
}

/* venus style.css L898：§9.10 分数 64–76px Data Mono；§5.4 L238 综合分数始终 Ink */
.score-number {
  color: var(--ink);
  font-family: var(--font-data);
  font-size: clamp(64px, 5.6vw, 76px);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  letter-spacing: -0.06em;
  line-height: 0.84;
}

/* venus style.css L899 */
.score-max {
  color: var(--ink-muted);
  font-family: var(--font-data);
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
}

/* venus style.css L900 */
.score-caption {
  color: var(--ink-muted);
  font-family: var(--font-data);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  line-height: 1;
  margin-top: 10px;
}

/* venus style.css L901 */
.score-scale {
  margin-top: var(--space-4);
}

/* venus style.css L902 */
.score-scale-track {
  background: var(--hairline);
  height: 3px;
  overflow: hidden;
}

/* venus style.css L903：宽度动画由 transition 驱动（app.js L628-631 的声明式等价） */
.score-scale-fill {
  background: var(--amber);
  height: 100%;
  transition: width var(--motion-slow) var(--ease-enter);
  width: 0;
}

/* venus style.css L904 */
.score-scale-ends {
  color: var(--ink-muted);
  display: flex;
  font-family: var(--font-data);
  font-size: 10px;
  font-weight: 500;
  justify-content: space-between;
  line-height: 1;
  margin-top: 5px;
}

/* venus style.css L905 */
.score-band {
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  margin-top: var(--space-4);
}

/* venus style.css L906-909：§5.4 四区间色——仅用于此小标签 */
.score-red {
  color: var(--ink-muted);
}

.score-orange {
  color: var(--ink-body);
}

.score-blue {
  color: var(--amber);
}

.score-green {
  color: var(--verdigris);
}
</style>
