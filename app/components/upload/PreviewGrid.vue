<script setup lang="ts">
import type { ImageEntry } from '~/composables/useImageSelection'
import type PreviewCard from './PreviewCard.vue'

/**
 * 多图预览网格容器：entries 迭代 + joint/compare 双布局变体
 * （component-plan §2.3 上传输入域，对应 group.js renderSelection L244-298
 * 的网格层与 group-joint.html L82 / group-compare.html L82 的容器 class）。
 *
 * - 数据流单向：entries 从 useImageSelection → 父级 → 本组件只读消费；
 *   动作经 remove/move 事件流出，父级调用 composable 方法完成变更
 *   （先例 UploadZone emit files / SelectionToolbar emit clear）。
 *   component-plan L105 的 v-model:files 在此数据流中为冗余绑定，不采用。
 * - 布局变体（§9.7 joint 自然比例接触印样 / §9.8+§10.4 compare 统一视框）：
 *   容器 class 切换 + :deep() 下发媒体规则，PreviewCard 不含变体 CSS。
 * - TransitionGroup 替代源 replaceChildren 全量重建：仅新增卡片入场
 *   （groupCardIn 等效：opacity 0→1 + Y 8px→0，§12.3 280ms ease-enter），
 *   重排卡片平滑位移（180ms ease-standard），移除即时（源语义）。
 * - 标签模板插值：调用方传入 i18n 解析后的模板串（含 {index}/{name} 占位），
 *   组件内简单 replace——保持纯 props 约定，避免 N×4 预解析字符串负担。
 * - 移动后焦点管理（group.js L222）：nextTick 后聚焦目标卡片的对应方向按钮，
 *   保障键盘排序操作的焦点连续性（§14.2）。
 */
const props = withDefaults(
  defineProps<{
    /** 已选文件条目（useImageSelection().entries 只读消费） */
    entries: ImageEntry[]
    /** 布局变体：joint=自然比例接触印样(§9.7) / compare=统一 4:3 视框(§9.8/§10.4) */
    variant: 'joint' | 'compare'
    /** 交互锁定（对齐 group.js L266/L283/L290 state.isLoading 守卫） */
    disabled?: boolean
    /** 图片 alt 模板，{index}=1-based 序号，{name}=文件名（§14.4） */
    altTemplate: string
    /** 移除按钮 aria-label 模板，{index} 同上（group.js L264） */
    removeLabelTemplate: string
    /** 前移按钮 aria-label 模板（group.js L284） */
    moveBackLabelTemplate: string
    /** 后移按钮 aria-label 模板（group.js L291） */
    moveForwardLabelTemplate: string
    /** 前移按钮可见文案（group.js L282「前移」） */
    moveBackText: string
    /** 后移按钮可见文案（group.js L289「后移」） */
    moveForwardText: string
  }>(),
  { disabled: false },
)

const emit = defineEmits<{
  /** group.js L267 removeFile(entry.id) */
  remove: [id: string]
  /** group.js L285/L292 moveFile(entry.id, ±1)；-1=前移 1=后移 */
  move: [id: string, direction: -1 | 1]
}>()

// ── 容器 class（贴源 group-joint.html L82 / group-compare.html L82）──

const gridClasses = computed(() => [
  'group-preview-grid',
  props.variant === 'joint' ? 'contact-sheet' : 'comparison-grid',
])

// ── 标签模板插值（{index} → 1-based 序号，{name} → 文件名）──

function resolveTemplate(template: string, index: number, name: string): string {
  return template.replace('{index}', String(index)).replace('{name}', name)
}

// ── 事件中继 + 焦点管理 ──

/** v-for ref 数组：渲染序收集卡片实例（经 defineExpose 暴露移动按钮） */
const cardRefs = useTemplateRef<InstanceType<typeof PreviewCard>[]>('cardRefs')

function onCardRemove(id: string) {
  emit('remove', id)
}

/**
 * 移动后焦点管理（group.js L222：
 * `elements.previewGrid.children[nextIndex]?.querySelector('.preview-move')?.focus()`）。
 * querySelector 取首个 .preview-move——即前移按钮，贴源不区分方向；
 * 目标按钮 disabled 时 focus() 静默 no-op（源同行为），
 * Vue key 复用保证点击按钮随 DOM 移动保留焦点。
 * emit 后父级同步调用 moveEntry → entries 更新 → nextTick 后 DOM 已重排。
 */
async function onCardMove(id: string, index: number, direction: -1 | 1) {
  emit('move', id, direction)
  await nextTick()
  cardRefs.value?.[index + direction]?.moveBackButton?.focus()
}
</script>

<template>
  <TransitionGroup
    tag="div"
    :class="gridClasses"
    name="preview-card"
  >
    <UploadPreviewCard
      v-for="(entry, index) in props.entries"
      :key="entry.id"
      ref="cardRefs"
      :entry="entry"
      :index="index"
      :count="props.entries.length"
      :disabled="props.disabled"
      :alt="resolveTemplate(props.altTemplate, index + 1, entry.file.name)"
      :remove-label="resolveTemplate(props.removeLabelTemplate, index + 1, entry.file.name)"
      :move-back-label="resolveTemplate(props.moveBackLabelTemplate, index + 1, entry.file.name)"
      :move-forward-label="resolveTemplate(props.moveForwardLabelTemplate, index + 1, entry.file.name)"
      :move-back-text="props.moveBackText"
      :move-forward-text="props.moveForwardText"
      @remove="onCardRemove(entry.id)"
      @move="direction => onCardMove(entry.id, index, direction)"
    />
  </TransitionGroup>
</template>

<style scoped>
/* venus style.css L767（列数归变体规则） */
.group-preview-grid {
  display: grid;
  gap: 12px;
}

/* ── Joint 变体：自然比例接触印样（group.css L53-72，§9.7） ── */

.contact-sheet {
  align-items: start;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.contact-sheet :deep(.group-preview-card),
.contact-sheet :deep(.preview-media) {
  align-self: start;
}

.contact-sheet :deep(.preview-media) {
  min-height: 0;
}

.contact-sheet :deep(img) {
  display: block;
  height: auto;
  object-fit: contain;
  width: 100%;
}

/* ── Compare 变体：统一 4:3 中性视框（group.css L75-122，§9.8/§10.4） ── */

.comparison-grid {
  gap: var(--space-4);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

/* >4 张时 3 列（group.css L80-82） */
.comparison-grid:has(> :nth-child(5)) {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.comparison-grid :deep(.group-preview-card) {
  background: var(--paper-raised);
}

/* 输入选择阶段固定 4:3 视框（group.css L89-100，§10.4 公平比较）；
 * aspect-ratio 与 min-height 互斥说明同源注释 */
.comparison-grid :deep(.preview-media) {
  aspect-ratio: 4 / 3;
  background: var(--darkroom);
  display: grid;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  place-items: center;
  position: relative;
}

.comparison-grid :deep(img) {
  height: 100%;
  inset: 0;
  max-height: 100%;
  object-fit: contain;
  position: absolute;
  width: 100%;
}

/* ── TransitionGroup（groupCardIn 等效，§12.3；源 replaceChildren 全量重建
 *    的已知缺陷——每次操作全卡重闪——由 Vue 差量更新天然修复） ── */

.preview-card-enter-active {
  transition: opacity var(--motion-slow) var(--ease-enter),
    transform var(--motion-slow) var(--ease-enter);
}

.preview-card-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

/* 移除即时：源 replaceChildren 语义（无离场动画） */
.preview-card-leave-active {
  transition-duration: 0s;
}

/* 重排平滑位移（§12.1 motion-standard 180ms） */
.preview-card-move {
  transition: transform var(--motion-standard) var(--ease-standard);
}

/* ── 响应式（group.css L454-512 + style.css L1159/L1189-1192） ── */

@media (max-width: 1023px) {
  .contact-sheet,
  .comparison-grid:has(> :nth-child(5)) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .contact-sheet,
  .comparison-grid,
  .comparison-grid:has(> :nth-child(5)) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  /* joint 操作按钮纵向排列（style.css L1192） */
  .contact-sheet :deep(.preview-actions) {
    flex-direction: column;
    gap: 0;
  }
}

@media (max-width: 479px) {
  /* compare 降为单列；joint 保持 2 列（style.css L1190 有意覆盖） */
  .comparison-grid,
  .comparison-grid:has(> :nth-child(5)) {
    grid-template-columns: 1fr;
  }

  .comparison-grid :deep(.preview-media) {
    min-height: 0;
  }

  .contact-sheet :deep(.preview-meta) {
    padding: 10px;
  }
}
</style>
