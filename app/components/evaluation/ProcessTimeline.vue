<script setup lang="ts">
/**
 * 评估过程折叠区容器：BaseCollapsible 包裹 + 步骤序列
 * （component-plan L119），对应 venus single.html L159-164 #process-collapsible /
 * group-joint.html L151-154 同构结构 + app.js L663-766 renderProcess /
 * group.js L972-1032 renderProcess 的步骤编排。
 *
 * - 默认折叠（single.html L161 aria-expanded="false"；DESIGN §9.14
 *   「默认折叠评估过程」）；v-model:open 向 Flow 暴露展开控制
 *   （defineModel default false——无需控制时零代码绑定）。
 * - 根级 v-if="steps.length"：空过程不渲染折叠壳（DESIGN §2.5
 *   「为空时不显示容器」；BaseCollapsible L13「调用方职责」——
 *   本组件即该调用方）。
 * - 步骤编号经 v-for index+1：与 venus step++ 计数在 revision 条件
 *   插入下天然一致（app.js L743）；:key="kind" 安全（同类步骤至多一个）。
 * - 不含 .card.report-disclosure 外壳——卡片归 Flow 以 BaseCard
 *   variant="plain" 包裹（ScorePanel L18-19 先例；venus single.html L159
 *   页面级结构分工）。
 * - 折叠交互/键盘/a11y/动画全部由 BaseCollapsible 提供，零重复实现。
 * - 纯 props 组件不内嵌 $t()：title 由调用方解析 i18n 后传入
 *   （process.title 键「查看评估过程」）。
 */
import type { GenreMetadata, ProcessStepItem } from '#shared/types/evaluation'

const props = withDefaults(
  defineProps<{
    /** 折叠标题（如「查看评估过程」，Flow 解析 process.title 键） */
    title: string
    /** 步骤序列（Flow 映射层归一化输出，按 proposal→arbitration 顺序） */
    steps: ProcessStepItem[]
    /** 当前门类（透传 ChallengeList 维度名解析） */
    genre?: string
    /** 门类元数据（透传 ChallengeList；缺省时回退原始 key） */
    metadata?: Record<string, GenreMetadata> | null
  }>(),
  { genre: '', metadata: null },
)

// venus 默认折叠（single.html L161）；Flow 可经 v-model:open 控制
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <UiBaseCollapsible v-if="props.steps.length" v-model:open="open">
    <template #header>{{ props.title }}</template>
    <!-- venus style.css L961 process-content：步骤序列容器 -->
    <div class="process-content">
      <EvaluationProcessStep
        v-for="(step, index) in props.steps"
        :key="step.kind"
        :step="step"
        :step-number="index + 1"
        :genre="props.genre"
        :metadata="props.metadata"
      />
    </div>
  </UiBaseCollapsible>
</template>

<style scoped>
/* venus style.css L961 */
.process-content {
  min-width: 0;
  padding: 0 0 var(--space-5);
}
</style>
