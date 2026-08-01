<script setup lang="ts">
/**
 * 分差块：差值 + 双评分条（component-plan L131），收敛 venus
 * group.js L779-795 renderFocusCompareGrid delta 段的 innerHTML 拼接
 * 为声明式组件（:style 绑定替代模板字符串，天然 XSS 免疫）。
 *
 * - §11.3：并列水平条 + 明确数值 + 差值，不用面积图或雷达图重叠。
 * - 评分条静态宽度、无 transition（忠实源 group.css L340-344）：
 *   pair 切换时仅两个 width 样式更新，零动画开销。
 * - NaN 防御取健壮版（ScorePanel L36-39 先例，修正源 L779-781 无防御）。
 * - 纯 props 组件不内嵌 $t()：文案由调用方解析 i18n 后传入，
 *   未传时回退中文默认（CritiqueReport L20-21 先例）。
 * - 沉浸态配色消费 FocusCompare 下发的 --cmp-* 自定义属性
 *   （缺省回退基态 token，脱离 FocusCompare 独立使用时行为不变）。
 */
const props = withDefaults(
  defineProps<{
    /** 左侧照片综合分（group.js L779） */
    leftScore: number
    /** 右侧照片综合分（group.js L780） */
    rightScore: number
    /** 差值标题（group.js L786「综合评分差值」） */
    headingLabel?: string
    /** 评分条容器 aria-label（group.js L789） */
    barsAriaLabel?: string
    /** 左条标签模板，{score} 插值（group.js L790「左侧 X.X」） */
    leftBarTemplate?: string
    /** 右条标签模板，{score} 插值（group.js L791「右侧 X.X」） */
    rightBarTemplate?: string
    /** 脚注（group.js L793） */
    footnote?: string
  }>(),
  {
    headingLabel: '综合评分差值',
    barsAriaLabel: '两张照片综合评分对比',
    leftBarTemplate: '左侧 {score}',
    rightBarTemplate: '右侧 {score}',
    footnote: '差异来源请结合两侧"优势与限制"逐项核对；综合分不替代照片本身与文字依据。',
  },
)

// group.js L779-780 + ScorePanel L36-39 NaN 防御
const safeLeft = computed(() => {
  const n = Number(props.leftScore)
  return Number.isFinite(n) ? n : 0
})
const safeRight = computed(() => {
  const n = Number(props.rightScore)
  return Number.isFinite(n) ? n : 0
})

// group.js L781：delta = left - right
const deltaText = computed(() => {
  const d = safeLeft.value - safeRight.value
  // group.js L787：非负显式 '+' 前缀
  return `${d >= 0 ? '+' : ''}${d.toFixed(1)}`
})

// group.js L790-791：clamp(0, 10) × 10%（DimensionList L46 先例）
const fillWidth = (score: number) => `${Math.max(0, Math.min(10, score)) * 10}%`

// 标签模板插值
const leftLabel = computed(() =>
  props.leftBarTemplate.replace('{score}', safeLeft.value.toFixed(1)),
)
const rightLabel = computed(() =>
  props.rightBarTemplate.replace('{score}', safeRight.value.toFixed(1)),
)
</script>

<template>
  <div class="compare-focus-delta">
    <!-- group.js L782-795：div.compare-focus-delta 三段结构 -->
    <!-- group.js L785-788：标题 + 有符号差值 -->
    <div class="compare-delta-heading">
      <span>{{ props.headingLabel }}</span>
      <strong>{{ deltaText }}</strong>
    </div>
    <!-- group.js L789-792：双侧评分条 -->
    <div class="compare-score-bars" :aria-label="props.barsAriaLabel">
      <div>
        <span>{{ leftLabel }}</span>
        <i><b :style="{ width: fillWidth(safeLeft) }" /></i>
      </div>
      <div>
        <span>{{ rightLabel }}</span>
        <i><b :style="{ width: fillWidth(safeRight) }" /></i>
      </div>
    </div>
    <!-- group.js L793：脚注 -->
    <p>{{ props.footnote }}</p>
  </div>
</template>

<style scoped>
/* venus group.css L296-302：跨列 + 2px amber 左边线（§9.12 关键证据标记语言）。
 * 沉浸态配色经 --cmp-* 自定义属性继承（FocusCompare 下发，缺省回退基态 token）。 */
.compare-focus-delta {
  grid-column: 1 / -1;
  padding: var(--space-5);
  border: 1px solid var(--cmp-hairline, var(--hairline));
  border-left: 2px solid var(--amber);
  background: var(--cmp-surface, var(--paper-raised));
}

/* venus group.css L304-311 */
.compare-delta-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
  color: var(--cmp-ink, var(--ink));
  font-weight: 600;
}

/* venus group.css L313-316：§6.2 分数 tabular-nums；font 简写拆开 */
.compare-delta-heading strong {
  color: var(--amber);
  font-family: var(--font-data);
  font-size: 28px;
  font-weight: 600;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

/* venus group.css L318-322 */
.compare-score-bars {
  margin: var(--space-4) 0;
  display: grid;
  gap: 12px;
}

/* venus group.css L324-331；font 简写拆开 */
.compare-score-bars > div {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  align-items: center;
  gap: var(--space-3);
  color: var(--cmp-body, var(--ink-body));
  font-family: var(--font-data);
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

/* venus group.css L333-338：6px 轨道。
 * 沉浸态轨色由 --cmp-bar-track 覆盖（源 L402-404 #3d3832） */
.compare-score-bars i {
  height: 6px;
  display: block;
  overflow: hidden;
  background: var(--cmp-bar-track, var(--hairline));
}

/* venus group.css L340-344：静态填充，无 transition（忠实源） */
.compare-score-bars b {
  height: 100%;
  display: block;
  background: var(--amber);
}

/* venus group.css L346-350 */
.compare-focus-delta p {
  max-width: 42rem;
  color: var(--cmp-muted, var(--ink-muted));
  font-size: 13px;
  margin: 0;
}

/* venus group.css L505-507：≤479px 单列时不再跨列 */
@media (max-width: 479px) {
  .compare-focus-delta {
    grid-column: 1;
  }
}
</style>
