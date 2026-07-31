<script setup lang="ts">
/**
 * 评估过程单步：标题 + 图标 + 徽章组、内容 Markdown、质疑列表、推理块
 * （component-plan L120），收敛 venus app.js L679-754 四步模板与
 * group.js L924-970 createProcessStep 为声明式组件。
 *
 * - 根元素 <article> + step-{kind} class + data-step 编号（group.js L925-927）；
 *   编号由 ProcessTimeline 经 v-for index+1 传入，与 venus step++ 计数在
 *   revision 条件插入下天然一致（app.js L743：arbitration = revision ? 4 : 3）。
 * - 图标：app.js 四步均有 SVG 图标（L682/701/728/747）而 group.js 无——
 *   取 app.js 版本（跨页视觉一致性升级；polyline/line/circle 转 path 表达，
 *   共享 24 viewBox / stroke currentColor / stroke-width 2 / round caps）。
 * - 徽章透传 UiBaseBadge（variant 镜像 BaseBadge 联合）；severity 大写枚举→
 *   小写 variant 的转换归 Flow 映射层（BaseBadge L7 约定）。
 * - content 空串不渲染（group.js L937）；challenges 空/缺省不渲染
 *   ChallengeList（group.js L944）；reasoning 空/空白或 toggleText 缺省
 *   不渲染 ReasoningBlock（app.js L770 守卫 + 映射层契约显式化）。
 * - ⚠️ 勿 import 流式域 ReasoningBlock 类型（evaluation.ts L57）——
 *   子组件 EvaluationReasoningBlock 是结果区折叠块，同名不同物。
 * - 纯 props 组件不内嵌 $t()：title/徽章文案由调用方解析后传入
 *   （title 复用 review.step* 键；徽章用 process.*Badge 键）。
 */
import type { GenreMetadata, ProcessStepItem, ProcessStepKind } from '#shared/types/evaluation'

const props = withDefaults(
  defineProps<{
    /** 步骤渲染数据（Flow 映射层归一化输出） */
    step: ProcessStepItem
    /** 步骤序号（data-step，ProcessTimeline 传 v-for index+1） */
    stepNumber?: number
    /** 当前门类（透传 ChallengeList 维度名解析） */
    genre?: string
    /** 门类元数据（透传 ChallengeList；缺省时回退原始 key） */
    metadata?: Record<string, GenreMetadata> | null
  }>(),
  { stepNumber: undefined, genre: '', metadata: null },
)

/**
 * 四步图标（逐字移植 app.js L682/701/728/747，polyline/line/circle 转 path）：
 * proposal=file-text、critique=alert-circle、revision=edit-2、arbitration=custom balance。
 */
const STEP_ICON_PATHS: Record<ProcessStepKind, string[]> = {
  proposal: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M16 13H8',
    'M16 17H8',
    'M10 9H8',
  ],
  critique: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 8v4', 'M12 16h.01'],
  revision: [
    'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  ],
  arbitration: ['M12 3v18', 'M17 8l-5-5-5 5', 'M3 17l3-3 3 3', 'M15 17l3-3 3 3'],
}

// app.js L770 renderReasoningBlock 空值守卫：reasoning 空/空白不渲染；
// reasoningToggle 缺省亦不渲染（映射层必传——双条件守卫使契约显式化）
const reasoningBlock = computed(() => {
  const raw = props.step.reasoning
  const text = typeof raw === 'string' ? raw.trim() : ''
  const toggle = props.step.reasoningToggle
  if (!text || !toggle) return null
  return { text, toggle }
})
</script>

<template>
  <article class="process-step" :class="`step-${props.step.kind}`" :data-step="props.stepNumber">
    <!-- group.js L929-934 step-title：图标 + 标题 + 徽章组 -->
    <div class="step-title">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path v-for="d in STEP_ICON_PATHS[props.step.kind]" :key="d" :d="d" />
      </svg>
      <span>{{ props.step.title }}</span>
      <UiBaseBadge v-for="(badge, index) in props.step.badges" :key="index" :variant="badge.variant">
        {{ badge.text }}
      </UiBaseBadge>
    </div>
    <!-- group.js L937-942：content 空串不渲染 -->
    <div v-if="props.step.content" class="step-content">
      <UiBaseMarkdown :content="props.step.content" :final="true" />
    </div>
    <!-- group.js L944：challenges 空/缺省不渲染 -->
    <EvaluationChallengeList
      v-if="props.step.challenges?.length"
      :challenges="props.step.challenges"
      :genre="props.genre"
      :metadata="props.metadata"
    />
    <!-- app.js L769-779：推理折叠块（双条件守卫见 script 注释） -->
    <EvaluationReasoningBlock
      v-if="reasoningBlock"
      :toggle-text="reasoningBlock.toggle"
      :content="reasoningBlock.text"
    />
  </article>
</template>

<style scoped>
/* venus style.css L962 */
.process-step {
  background: transparent;
  border: 0;
  border-radius: 0;
  border-top: 1px solid var(--hairline);
  min-width: 0;
  padding: var(--space-5) 0;
}

/* venus style.css L963 */
.step-title {
  align-items: center;
  color: var(--ink);
  display: flex;
  flex-wrap: wrap;
  font-size: 14px;
  font-weight: 600;
  gap: 8px;
  min-width: 0;
}

/* venus style.css L964 */
.step-title svg {
  color: var(--amber);
  flex-shrink: 0;
}

/* venus style.css L971（wrapper 排版承接先例 StreamReasoning L99-103：
 * markdown 块级元素由 BaseMarkdown 桥接，容器承担色值/行高/换行） */
.step-content {
  color: var(--ink-body);
  font-size: 14px;
  line-height: 1.75;
  margin-top: var(--space-3);
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
