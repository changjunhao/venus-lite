<script setup lang="ts">
/**
 * 可折叠面板：heading 包原生 button 的 WAI-ARIA Accordion 结构（DESIGN.md §9.14），
 * 对应 venus `.collapsible` 全部实例（评估过程 / EXIF 折叠）。
 *
 * - 原生 `<button>` 替代 venus 的 `div role="button" tabindex="0"`：
 *   Enter/Space 键盘行为由浏览器提供，免自实现（同 BaseSwitch 原生 checkbox 的决策脉络）。
 * - heading 包 button 而非 button 包 h3：button 只允许 phrasing content，
 *   venus 原版 h3 的标题语义由 `headingTag` 保留，层级交调用方适配文档大纲。
 * - `:inert="!open"`：venus 原版折叠态内容仍在无障碍树中且可 Tab 聚焦
 *   （grid 0fr 只做视觉收起），此处用 inert 修正；inert 不参与过渡，不影响动画。
 * - 内容始终渲染（不用 v-if 懒渲染）：grid 0fr→1fr 过渡要求内容常驻 DOM；
 *   「perImage 为空不渲染整块区域」（§9.14）是调用方职责。
 * - 零内部文案：标题走 header slot，内容走 default slot。
 */
const props = withDefaults(
  defineProps<{
    headingTag?: 'h2' | 'h3' | 'h4'
  }>(),
  { headingTag: 'h3' },
)

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{ change: [value: boolean] }>()

// SSR 水合安全的 id，aria-controls 与内容区显式关联
const id = useId()
const contentId = computed(() => `${id}-content`)

function toggle() {
  open.value = !open.value
  emit('change', open.value)
}
</script>

<template>
  <div class="collapsible" :class="{ 'collapsible-open': open }">
    <component :is="props.headingTag" class="collapsible-heading">
      <button
        type="button"
        class="collapsible-header"
        :aria-expanded="open"
        :aria-controls="contentId"
        @click="toggle"
      >
        <span class="collapsible-title"><slot name="header" /></span>
        <!-- venus 全部实例共用同一文本 chevron，旋转表达展开态 -->
        <span class="collapsible-icon" aria-hidden="true">↓</span>
      </button>
    </component>
    <div :id="contentId" class="collapsible-content" :inert="!open">
      <div class="collapsible-body"><slot /></div>
    </div>
  </div>
</template>

<style scoped>
.collapsible {
  width: 100%;
}

/* 字号由 .collapsible-title 承担，heading 只保留语义（margin 已被全局 reset 归零） */
.collapsible-heading {
  font-size: inherit;
}

/* §9.14：header 最小高度 52px（以 DESIGN.md 为准，非 venus css 的 56px）、整行可点击 */
.collapsible-header {
  align-items: center;
  background: transparent;
  border: 0;
  cursor: pointer;
  display: flex;
  gap: var(--space-4);
  justify-content: space-between;
  min-height: 52px;
  padding: 0;
  text-align: left;
  width: 100%;
}

/* venus .collapsible-header h3 的字体，焦点样式由 main.css 全局 :focus-visible 覆盖 */
.collapsible-title {
  color: var(--ink);
  font: 600 15px var(--font-ui);
}

/* §9.14：Chevron 旋转 180°，时长 180ms */
.collapsible-icon {
  color: var(--amber);
  transition: transform var(--motion-standard) var(--ease-standard);
}

.collapsible-open .collapsible-icon {
  transform: rotate(180deg);
}

/* 高度与透明度过渡走 grid 0fr→1fr（venus 先例，补上其遗漏的缓动 token §12.2）；
 * reduced-motion 时长由 tokens.css 全局降为 1ms，此处无需处理 */
.collapsible-content {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  overflow: hidden;
  transition: grid-template-rows var(--motion-standard) var(--ease-standard),
    opacity var(--motion-standard) var(--ease-standard);
}

/* grid 0fr 收起的必要条件：内容行允许收缩到 0 */
.collapsible-body {
  min-height: 0;
  min-width: 0;
}

.collapsible-open .collapsible-content {
  grid-template-rows: 1fr;
  opacity: 1;
}
</style>
