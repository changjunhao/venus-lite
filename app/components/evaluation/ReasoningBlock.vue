<script setup lang="ts">
/**
 * 推理过程折叠块：「{agent}分析过程」toggle + Markdown 内容
 * （component-plan L122），收敛 venus app.js L769-779 renderReasoningBlock
 * 与 group.js L908-922 createReasoningBlock 两份实现。
 *
 * - ⚠️ 与 shared/types/evaluation.ts 流式域 `ReasoningBlock` 类型（L57）同名不同物：
 *   本组件是结果区静态折叠块（自动导入前缀 EvaluationReasoningBlock 消歧）；
 *   ProcessStep 只 import ProcessStepItem 类型，勿误 import 流式类型。
 * - 不复用 BaseCollapsible：视觉结构全面分化（12px ink-muted 盒式 toggle +
 *   ::after chevron vs 15px ink 行式 header + span chevron；display 切换 vs
 *   grid 过渡），复用需 :deep() 覆盖 scoped 样式，脆弱且难维护；
 *   自含 toggle 逻辑仅数行，原生 button 自带 Enter/Space 键盘行为。
 * - aria-expanded/aria-controls 为有意增强（venus 原版无，DESIGN §9.14/§14.2）。
 * - v-show 精确对应 venus display:none→block（style.css L981/983），
 *   无动画（原版即无）；关闭态 display:none 自动移出无障碍树。
 * - 纯 props 组件不内嵌 $t()：toggleText 为完整按钮文案由调用方传入
 *   （Flow 组合 process.reasoningToggle 键「{agent}分析过程」）。
 */
const props = defineProps<{
  /** 完整按钮文案（如「提案者分析过程」） */
  toggleText: string
  /** 推理 Markdown 文本（调用方已守卫空值，app.js L770） */
  content: string
}>()

// venus 默认折叠（app.js L772 无 open class）
const open = ref(false)

// SSR 水合安全的 id，aria-controls 与内容区显式关联（BaseCollapsible L28-29 范式）
const id = useId()
const contentId = computed(() => `${id}-content`)
</script>

<template>
  <div class="thinking-block" :class="{ 'thinking-open': open }">
    <button
      type="button"
      class="thinking-toggle"
      :aria-expanded="open"
      :aria-controls="contentId"
      @click="open = !open"
    >
      <!-- venus app.js L774 help-circle 图标（circle + 问号 path + 点 line 转 path 表达） -->
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
      </svg>
      {{ props.toggleText }}
    </button>
    <div v-show="open" :id="contentId" class="thinking-content">
      <!-- 静态场景传 final: true（component-plan §四.7） -->
      <UiBaseMarkdown :content="props.content" :final="true" />
    </div>
  </div>
</template>

<style scoped>
/* venus style.css L977 */
.thinking-block {
  border: 1px solid var(--hairline);
  border-radius: var(--radius-sm);
  margin-top: var(--space-4);
  min-width: 0;
}

/* venus style.css L978 */
.thinking-toggle {
  align-items: center;
  background: transparent;
  border: 0;
  color: var(--ink-muted);
  cursor: pointer;
  display: flex;
  font-size: 12px;
  gap: var(--space-3);
  justify-content: space-between;
  min-height: 44px;
  padding: 0 12px;
  text-align: left;
  width: 100%;
}

.thinking-toggle svg {
  flex-shrink: 0;
}

/* venus style.css L979 */
.thinking-toggle::after {
  color: var(--amber);
  content: "↓";
  flex-shrink: 0;
  transition: transform var(--motion-standard) var(--ease-standard);
}

/* venus style.css L980 */
.thinking-open .thinking-toggle::after {
  transform: rotate(180deg);
}

/* venus style.css L981（display 切换由 v-show 承担；L982 pre 规则由
 * markstream-vue 库样式接管，BaseMarkdown 薄封装统一出口） */
.thinking-content {
  color: var(--ink-muted);
  font-size: 12px;
  line-height: 1.7;
  padding: 0 12px 12px;
}
</style>
