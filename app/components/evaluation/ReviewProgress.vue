<script setup lang="ts">
import type { ReasoningBlock, StreamStepItem } from '#shared/types/evaluation'

/**
 * 流式进度卡：评估处理中的进度标记、状态文案与步骤/推理区
 * （component-plan L113），收敛 venus single.html L106-120 #loading-section
 * 与 app.js L860-896 setLoading / setLoadingText 的 DOM 操作为声明式组件。
 *
 * - 可见性 v-if="active" 对应 app.js L862 `.classList.toggle('active', loading)`。
 *   有意偏差：venus 用 CSS class 切换 display；v-if 移除 DOM 后 aria-live
 *   区域不会意外播报旧内容，对屏幕阅读器更安全。
 * - aria-live="polite" 仅在 .review-progress-copy（与 venus single.html L108
 *   一致，§14.5）；StreamReasoning 的持续变化文本不入 Live Region。
 * - progress-marker 带 aria-hidden="true"（装饰性旋转环，§14.4）。
 * - 直接组合 EvaluationStreamSteps + EvaluationStreamReasoning
 *   （component-plan L113 定义），文案/步骤/推理块全部纯 props，
 *   由 Flow 业务组件从 useEvaluationStream 透传。
 * - §15.4：等待文案说明当前正在完成什么以及用户需要等待，
 *   不显示内部流式协议或字符数。
 */
withDefaults(
  defineProps<{
    /** 可见性（app.js L862 .toggle('active', loading)） */
    active: boolean
    /** 主文案（app.js L889 .loading-text，如「提案者初评中」） */
    text: string
    /** 副文案（app.js L891 .loading-subtext，空/未传时不渲染） */
    subtext?: string
    /** 章节索引标签（single.html L109 section-index） */
    indexLabel?: string
    /** 步骤轨道数据 → EvaluationStreamSteps */
    steps: StreamStepItem[]
    /** 推理块数据 → EvaluationStreamReasoning */
    blocks: ReasoningBlock[]
    /** 推理块标题后缀（透传 StreamReasoning；Flow 传 t('review.reasoningSuffix')） */
    reasoningSuffix?: string
  }>(),
  {
    subtext: undefined,
    indexLabel: 'REVIEW IN PROGRESS',
    reasoningSuffix: '',
  },
)
</script>

<template>
  <section v-if="active" class="review-progress">
    <!-- single.html L107 旋转进度标记（§12.5 reduced-motion 下静止） -->
    <div class="progress-marker" aria-hidden="true"><span /></div>

    <!-- single.html L108-112 文案区：aria-live 播报范围仅此处 -->
    <div class="review-progress-copy" aria-live="polite">
      <UiBaseSectionIndex>{{ indexLabel }}</UiBaseSectionIndex>
      <p class="loading-text">{{ text }}</p>
      <p v-if="subtext" class="loading-subtext">{{ subtext }}</p>
    </div>

    <EvaluationStreamSteps :steps="steps" class="review-progress-steps" />
    <EvaluationStreamReasoning :blocks="blocks" :suffix="reasoningSuffix" class="review-progress-reasoning" />
  </section>
</template>

<style scoped>
/* venus style.css L804-815（.loading-overlay.active → .review-progress，
 * 显隐改由 v-if 控制，无需 display:none 基态） */
.review-progress {
  align-items: center;
  background: var(--paper-raised);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-md);
  display: grid;
  gap: var(--space-5);
  grid-template-columns: auto minmax(180px, 0.7fr) minmax(420px, 1.3fr);
  margin-top: var(--space-5);
  padding: var(--space-6);
  text-align: left;
}

/* venus style.css L816 —— 外环 */
.progress-marker {
  border: 1px solid var(--hairline-strong);
  border-radius: 50%;
  height: 42px;
  padding: 5px;
  width: 42px;
}

/* venus style.css L817 —— 内环旋转 */
.progress-marker span {
  animation: spin 1s linear infinite;
  border: 2px solid var(--hairline);
  border-radius: 50%;
  border-top-color: var(--amber);
  display: block;
  height: 100%;
  width: 100%;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* venus style.css L819 */
.loading-text {
  color: var(--ink);
  font-size: 18px;
  font-weight: 600;
  margin: 4px 0 0;
}

/* venus style.css L820 */
.loading-subtext {
  color: var(--ink-muted);
  font-size: 13px;
}

/* grid item min-width 归零：内容 min-content 不得撑宽 1fr 轨道冲破卡片
 * （BaseCard L32-34 §13.2 先例；子组件根节点经 class 合并承接本作用域） */
.review-progress-copy,
.review-progress-steps,
.review-progress-reasoning {
  min-width: 0;
}

/* style.css L842 的 grid-column 归此设置（StreamReasoning 自身不含列信息） */
.review-progress-reasoning {
  grid-column: 1 / -1;
}

/* venus style.css L1095-1096 —— ≤1023px 两列，步骤跨列 */
@media (max-width: 1023px) {
  .review-progress {
    grid-template-columns: auto 1fr;
  }

  .review-progress-steps {
    grid-column: 1 / -1;
  }
}

/* venus style.css L1160 —— ≤767px 紧凑 padding */
@media (max-width: 767px) {
  .review-progress {
    grid-template-columns: auto 1fr;
    padding: 24px 20px;
  }
}

/* venus style.css L1193-1195 —— ≤479px 单列，隐藏 spinner */
@media (max-width: 479px) {
  .review-progress {
    grid-template-columns: 1fr;
  }

  .progress-marker {
    display: none;
  }

  .review-progress-steps {
    grid-column: 1;
  }
}

/* venus style.css L1209 —— §12.5 spinner 改为静态进度标记 */
@media (prefers-reduced-motion: reduce) {
  .progress-marker span {
    animation: none;
    border-color: var(--hairline);
    border-top-color: var(--amber);
  }
}
</style>
