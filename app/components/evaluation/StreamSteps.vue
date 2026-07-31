<script setup lang="ts">
import type { StreamStepItem } from '#shared/types/evaluation'

/**
 * Agent 步骤轨道：评审记录式水平步骤条（component-plan L114），
 * 收敛 venus single.html L113-118 #stream-steps 与 app.js L487-512 的
 * ensureRevisionStep / updateStreamSteps 逻辑为纯渲染。
 *
 * - 四固定步（门类识别/提案者初评/批判者质疑/仲裁者裁决）+ 条件插入
 *   「提案者修正」——条件步骤由调用方在 steps 数组中插入（DESIGN §9.9
 *   「条件步骤只在真正发生时插入，不预先展示为永不点亮的占位」），
 *   组件本身不含插入逻辑（app.js L487-495 ensureRevisionStep 归
 *   useEvaluationStream）。
 * - 三态渲染对齐 DESIGN §9.9：pending = Ink Muted + 空心圆；
 *   active = Amber + 2px 实心标记；done = Verdigris + 对勾。
 *   §9.9 的 error 态由父级文案表达（app.js L500 failed 时不更新步骤）。
 * - 语义化升级：venus 用 <span> 堆叠 → <ol> 有序列表（评审记录语义）。
 * - 纯展示组件：无内部状态、无事件发射，steps 由 Flow/composable 计算传入。
 */
defineProps<{
  /** 有序步骤列表（app.js L503 querySelectorAll('.stream-step') 的响应式等价） */
  steps: StreamStepItem[]
}>()
</script>

<template>
  <ol class="stream-steps">
    <li
      v-for="step in steps"
      :key="step.agent"
      class="stream-step"
      :class="step.status"
      :data-agent="step.agent"
    >
      {{ step.label }}
    </li>
  </ol>
</template>

<style scoped>
/* venus style.css L822 —— 步骤数量可变：提案者修正仅在发生时插入 */
.stream-steps {
  display: grid;
  gap: 0;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  list-style: none;
  margin: 0;
  padding: 0;
}

/* venus style.css L823-833（font 简写拆开，同 SelectionToolbar 先例） */
.stream-step {
  background: transparent;
  border: 0;
  color: var(--ink-muted);
  font-family: var(--font-ui);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.35;
  min-height: 44px;
  min-width: 0;
  padding: 24px 8px 0;
  position: relative;
  text-align: center;
  transition: color var(--motion-fast) var(--ease-standard);
}

/* venus style.css L834 —— 空心圆标记 */
.stream-step::before {
  background: var(--paper-raised);
  border: 1px solid var(--hairline-strong);
  border-radius: 50%;
  content: "";
  height: 10px;
  left: calc(50% - 5px);
  position: absolute;
  top: 7px;
  transition:
    background-color var(--motion-fast) var(--ease-standard),
    border-color var(--motion-fast) var(--ease-standard),
    box-shadow var(--motion-fast) var(--ease-standard);
  width: 10px;
  z-index: 2;
}

/* venus style.css L835-837 —— 连接线，首/尾项半宽 */
.stream-step::after {
  background: var(--hairline);
  content: "";
  height: 1px;
  left: 0;
  position: absolute;
  top: 12px;
  width: 100%;
}

.stream-step:first-child::after {
  left: 50%;
  width: 50%;
}

.stream-step:last-child::after {
  width: 50%;
}

/* venus style.css L838-839 —— 当前：Amber + 2px 实心标记（§9.9） */
.stream-step.active {
  color: var(--ink);
}

.stream-step.active::before {
  background: var(--amber);
  border-color: var(--amber);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--amber) 15%, transparent);
}

/* venus style.css L840-841 —— 完成：Verdigris + 对勾 */
.stream-step.done {
  color: var(--verdigris);
}

.stream-step.done::before {
  background: var(--verdigris);
  border-color: var(--verdigris);
  color: var(--paper-raised);
  content: "✓";
  display: grid;
  font-family: var(--font-ui);
  font-size: 9px;
  font-weight: 600;
  height: 14px;
  left: calc(50% - 7px);
  line-height: 1;
  place-items: center;
  top: 5px;
  width: 14px;
}

/* venus style.css L1161-1162 —— ≤767px 改 2 列网格、隐藏连线 */
@media (max-width: 767px) {
  .stream-steps {
    grid-auto-flow: row;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: 16px;
  }

  .stream-step::after,
  .stream-step:first-child::after,
  .stream-step:last-child::after {
    display: none;
  }
}
</style>
