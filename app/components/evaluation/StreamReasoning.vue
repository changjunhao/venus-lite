<script setup lang="ts">
import type { ReasoningBlock } from '#shared/types/evaluation'

/**
 * 流式推理区：按 agent 分块实时追加 reasoning（component-plan L115），
 * 收敛 venus app.js L810-837 renderStreamReasoning 的 DOM 操作为声明式渲染。
 *
 * - 每块结构对齐 app.js L820-828：header（「{label}{suffix}」）+ 内容区；
 *   内容区使用 BaseMarkdown（markstream-vue 流式模式：content 持续累积、
 *   agent_complete 时置 final，renderer 自动收敛未闭合结构）。
 * - suffix 为纯 props（「过程」/"process"，review.reasoningSuffix 键）：
 *   源 app.js L825 硬编码「过程」，venus-lite 双 locale 场景由 Flow 经
 *   ReviewProgress 透传 t('review.reasoningSuffix')，随 locale 响应式更新。
 * - 自动滚底对齐 app.js L836（scrollTop = scrollHeight），有意增强：
 *   用户手动上滚超过 40px 阈值时暂停自动滚动，避免打断阅读
 *   （venus 无此行为——每次 chunk 强制滚底）。
 *   实现要点：① 不能在 blocks 变更时采样 isNearBottom——单 chunk 渲染
 *   增高轻易超过阈值，且 smooth-streaming pacing 在 chunk 间隙持续增高
 *   scrollHeight，采样一旦落后即永久脱离；② ResizeObserver 亦不适用——
 *   内容区被 max-height 180px 封顶，填满后元素自身尺寸不再变化。
 *   故以 MutationObserver 观察内容子树变更（同步/ pacing 渲染均为
 *   DOM 变更）驱动滚底 + scroll 事件跟踪用户意图。
 * - 完成折叠对齐 app.js L441-444（agent_complete → block.classList.add('done')），
 *   有意偏差：venus 仅添加 class 无视觉效果；此处给予轻微视觉收敛
 *   （max-height 180px → 72px + 降低透明度，§12.3 允许范围内）。
 * - §14.5：容器不设 aria-live——持续变化的分析过程全文不入 Live Region，
 *   避免重复朗读；步骤播报由 ReviewProgress 的 aria-live 文案区承担。
 * - 纯展示组件：blocks 由 useEvaluationStream 累积后传入。
 */
withDefaults(
  defineProps<{
    /** 按 agent 出现顺序排列的推理块（app.js state.streamReasoning 的响应式等价） */
    blocks: ReasoningBlock[]
    /** 标题后缀（app.js L825 「{label}过程」；双 locale 由 Flow 传 t('review.reasoningSuffix')） */
    suffix?: string
  }>(),
  { suffix: '' },
)

// ── 自动滚底（app.js L836 + 用户意图检测）──

/**
 * 跟随状态（每块独立）：true = 内容增高时自动滚底。
 *
 * 意图经 scroll 事件跟踪而非增长时采样：程序滚底后事件采样仍在底部
 * （保持跟随），用户上滚后采样脱离（暂停），滚回底部重新跟随。
 */
const following = new Map<string, boolean>()

/**
 * 内容元素 → 专属 MutationObserver（闭包捕获元素，≤5 块开销可忽）。
 *
 * 观察子树 DOM 变更而非元素尺寸：内容区被 max-height 封顶后自身尺寸
 * 恒定（ResizeObserver 停摆），而 scrollHeight 随渲染持续增长——
 * markstream 无论同步渲染还是 pacing 渲染均产生 DOM 变更，
 * 每批变更回调时若仍在跟随即滚底。
 */
const contentObservers = new Map<HTMLElement, { agent: string, observer: MutationObserver }>()

function setContentRef(agent: string, el: unknown) {
  const element = el as HTMLElement | null
  const previous = [...contentObservers.entries()].find(([, v]) => v.agent === agent)?.[0]
  if (previous && previous !== element) {
    contentObservers.get(previous)!.observer.disconnect()
    contentObservers.delete(previous)
    following.delete(agent) // 元素重建（新一轮评估）重置为默认跟随
  }
  if (element && !contentObservers.has(element) && typeof MutationObserver === 'function') {
    const observer = new MutationObserver(() => {
      if (following.get(agent) ?? true) {
        element.scrollTop = element.scrollHeight
      }
    })
    observer.observe(element, { childList: true, subtree: true, characterData: true })
    contentObservers.set(element, { agent, observer })
  }
}

/** 用户是否在底部附近（40px 阈值内视为“跟随中”） */
function isNearBottom(el: HTMLElement): boolean {
  return el.scrollTop + el.clientHeight >= el.scrollHeight - 40
}

/** scroll 事件跟踪意图：程序滚底后采样仍在底部，用户上滚后采样脱离 */
function onContentScroll(agent: string, event: Event): void {
  following.set(agent, isNearBottom(event.target as HTMLElement))
}

onScopeDispose(() => {
  for (const { observer } of contentObservers.values()) observer.disconnect()
  contentObservers.clear()
})
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
        <span class="stream-think-agent">{{ block.label }}{{ suffix }}</span>
      </div>
      <!-- app.js L827 stream-think-content：pre → div（BaseMarkdown 输出块级元素） -->
      <div :ref="el => setContentRef(block.agent, el)" class="stream-think-content" @scroll="onContentScroll(block.agent, $event)">
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
