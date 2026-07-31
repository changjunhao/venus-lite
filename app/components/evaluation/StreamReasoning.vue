<script setup lang="ts">
import type { ReasoningBlock } from '#shared/types/evaluation'

/**
 * 流式推理区：按 agent 分块实时追加 reasoning（component-plan L115），
 * 收敛 venus app.js L810-837 renderStreamReasoning 的 DOM 操作为声明式渲染。
 *
 * - 每块结构对齐 app.js L820-828：header（「{label}过程」）+ 内容区；
 *   内容区使用 BaseMarkdown（markstream-vue 流式模式：content 持续累积、
 *   agent_complete 时置 final，renderer 自动收敛未闭合结构）。
 * - 自动滚底对齐 app.js L836（scrollTop = scrollHeight），有意增强：
 *   用户手动上滚超过 40px 阈值时暂停自动滚动，避免打断阅读
 *   （venus 无此行为——每次 chunk 强制滚底）。
 * - 完成折叠对齐 app.js L441-444（agent_complete → block.classList.add('done')），
 *   有意偏差：venus 仅添加 class 无视觉效果；此处给予轻微视觉收敛
 *   （max-height 180px → 72px + 降低透明度，§12.3 允许范围内）。
 * - §14.5：容器不设 aria-live——持续变化的分析过程全文不入 Live Region，
 *   避免重复朗读；步骤播报由 ReviewProgress 的 aria-live 文案区承担。
 * - 纯展示组件：blocks 由 useEvaluationStream 累积后传入。
 */
const props = defineProps<{
  /** 按 agent 出现顺序排列的推理块（app.js state.streamReasoning 的响应式等价） */
  blocks: ReasoningBlock[]
}>()

// ── 自动滚底（app.js L836 + 用户意图检测）──

const contentRefs = new Map<string, HTMLElement | null>()

function setContentRef(agent: string, el: unknown) {
  contentRefs.set(agent, el as HTMLElement | null)
}

/** 用户是否在底部附近（40px 阈值内视为"跟随中"） */
function isNearBottom(el: HTMLElement): boolean {
  return el.scrollTop + el.clientHeight >= el.scrollHeight - 40
}

watch(
  () => props.blocks,
  async (blocks) => {
    await nextTick()
    for (const block of blocks) {
      const el = contentRefs.get(block.agent)
      // 仅当用户未上滚时自动滚底（有意偏差：venus 每次强制滚底）
      if (el && isNearBottom(el)) el.scrollTop = el.scrollHeight
    }
  },
  { deep: true },
)
</script>

<template>
  <div v-if="blocks.length" class="stream-thinking">
    <div
      v-for="block in blocks"
      :key="block.agent"
      class="stream-think-block"
      :class="{ done: block.final }"
      :data-agent="block.agent"
    >
      <!-- app.js L824-826 stream-think-header -->
      <div class="stream-think-header">
        <span class="stream-think-agent">{{ block.label }}过程</span>
      </div>
      <!-- app.js L827 stream-think-content：pre → div（BaseMarkdown 输出块级元素） -->
      <div :ref="el => setContentRef(block.agent, el)" class="stream-think-content">
        <UiBaseMarkdown :content="block.content" :final="block.final" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* venus style.css L842（grid-column 归父级 ReviewProgress 设置） */
.stream-thinking {
  border-top: 1px solid var(--hairline);
  margin-top: var(--space-5);
  padding-top: var(--space-5);
}

/* venus style.css L843 */
.stream-think-block {
  border-bottom: 1px solid var(--hairline);
  padding: 14px 0;
}

/* venus style.css L844（font 简写拆开） */
.stream-think-header {
  color: var(--amber);
  font-family: var(--font-data);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
  margin-bottom: 8px;
}

/* venus style.css L845（pre 专属属性 white-space/margin/padding 不适用，已移除） */
.stream-think-content {
  background: transparent;
  color: var(--ink-muted);
  font-size: 12px;
  line-height: 1.7;
  max-height: 180px;
  overflow: auto;
  transition:
    max-height var(--motion-standard) var(--ease-standard),
    opacity var(--motion-standard) var(--ease-standard);
}

/* 完成折叠（app.js L441-444 done class 的视觉表达，有意偏差见 script 注释） */
.stream-think-block.done .stream-think-content {
  max-height: 72px;
  opacity: 0.7;
}
</style>
