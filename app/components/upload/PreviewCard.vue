<script setup lang="ts">
import type { ImageEntry } from '~/composables/useImageSelection'

/**
 * 单张预览卡：编号、缩略图、移除、前移/后移、尺寸+体积信息
 * （component-plan §2.3 上传输入域，对应 group.js renderSelection L245-297
 * 逐卡片 DOM 结构的组件化）。
 *
 * - 零业务：只负责渲染与事件上报（remove / move），排序与 objectURL
 *   生命周期归 useImageSelection，编排归未来 GroupEvaluationInput。
 * - 文案纯 props：alt 与 aria-label 由 PreviewGrid 插值后传入
 *   （§14.4 功能状态描述；先例同 SelectionToolbar）。
 * - 编号 padStart(2, '0') 贴源 group.js L258；aria-hidden 因编号为
 *   视觉索引，完整语义由 alt 与 aria-label 承载（§4.2 帧号语义元素）。
 * - .preview-move 36px 贴源 style.css L800（源有意覆盖 L763 的 44px
 *   共享值，卡片元数据区紧凑语境）；满足 WCAG 2.2 AA 24px 最低触控
 *   标准（§14.1 目标为 AA），与 §9.1 44px 通用规则的偏离已文档化。
 * - img 不加 loading="lazy"：选图后视口内主内容（先例 SinglePreview）。
 * - moveBackButton / moveForwardButton 经 defineExpose 供 PreviewGrid
 *   移动后焦点管理（group.js L222）。
 */
const props = withDefaults(
  defineProps<{
    /** 文件条目（useImageSelection ImageEntry 只读消费） */
    entry: ImageEntry
    /** 0-based 位置索引（group.js forEach index） */
    index: number
    /** 总张数（前移/后移边界禁用派生） */
    count: number
    /** 交互锁定（group.js L266/L283/L290 state.isLoading） */
    disabled?: boolean
    /** 图片 alt，描述功能状态（§14.4：「第 N 张照片：文件名」） */
    alt: string
    /** 移除按钮 aria-label（group.js L264） */
    removeLabel: string
    /** 前移按钮 aria-label（group.js L284） */
    moveBackLabel: string
    /** 后移按钮 aria-label（group.js L291） */
    moveForwardLabel: string
    /** 前移按钮可见文案（group.js L282「前移」） */
    moveBackText: string
    /** 后移按钮可见文案（group.js L289「后移」） */
    moveForwardText: string
  }>(),
  { disabled: false },
)

const emit = defineEmits<{
  /** group.js L267 removeFile(entry.id) */
  remove: []
  /** group.js L285/L292 moveFile(entry.id, direction)；-1=前移 1=后移 */
  move: [direction: -1 | 1]
}>()

// ── 派生（贴源 group.js L258/L276）──

/** 帧号补零（L258：String(index + 1).padStart(2, '0')） */
const numberText = computed(() => String(props.index + 1).padStart(2, '0'))

/** 尺寸+体积信息行（L276：`${w}×${h} · ${formatFileSize(size)}`） */
const infoText = computed(() =>
  `${props.entry.width}×${props.entry.height} · ${formatFileSize(props.entry.file.size)}`,
)

// ── 焦点管理出口（group.js L222：移动后聚焦目标卡片的对应按钮）──

const moveBackButton = useTemplateRef('moveBackButton')
const moveForwardButton = useTemplateRef('moveForwardButton')

defineExpose({ moveBackButton, moveForwardButton })
</script>

<template>
  <article class="group-preview-card">
    <div class="preview-media">
      <img
        :src="props.entry.objectURL"
        :alt="props.alt"
        :width="props.entry.width"
        :height="props.entry.height"
        decoding="async"
      >
      <span class="preview-number" aria-hidden="true">{{ numberText }}</span>
      <button
        class="preview-remove"
        type="button"
        :aria-label="props.removeLabel"
        :disabled="props.disabled"
        @click="emit('remove')"
      >
        ×
      </button>
    </div>
    <div class="preview-meta">
      <strong><UiFileName :name="props.entry.file.name" /></strong>
      <span class="info">{{ infoText }}</span>
      <div class="preview-actions">
        <button
          ref="moveBackButton"
          class="preview-move"
          type="button"
          data-move="back"
          :aria-label="props.moveBackLabel"
          :disabled="props.disabled || props.index === 0"
          @click="emit('move', -1)"
        >
          {{ props.moveBackText }}
        </button>
        <button
          ref="moveForwardButton"
          class="preview-move"
          type="button"
          data-move="forward"
          :aria-label="props.moveForwardLabel"
          :disabled="props.disabled || props.index === props.count - 1"
          @click="emit('move', 1)"
        >
          {{ props.moveForwardText }}
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
/* venus style.css L768 + group.css L413（contain 性能隔离） */
.group-preview-card {
  background: var(--paper);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-sm);
  contain: layout paint;
  min-width: 0;
  overflow: hidden;
}

/* venus style.css L770-772；--on-dark 组件局部（先例 SinglePreview L95） */
.preview-media {
  --on-dark: #f1ede3;

  background: var(--darkroom);
  min-width: 0;
  overflow: hidden;
  position: relative;
}

/* venus style.css L776-778：帧号徽章，Data Mono（§4.2 图像索引语义元素） */
.preview-number {
  background: rgba(12, 11, 10, 0.78);
  border-radius: var(--radius-sm);
  color: var(--on-dark);
  font-family: var(--font-data);
  font-size: 10px;
  font-weight: 600;
  left: 10px;
  line-height: 1;
  min-width: 34px;
  padding: 5px 8px;
  position: absolute;
  text-align: center;
  top: 10px;
}

/* venus style.css L779-791 + group.css L423-426（touch-action）：
 * 44×44 圆形移除按钮（§9.1 触控标准），悬停 oxide（§9.1 Destructive） */
.preview-remove {
  background: rgba(12, 11, 10, 0.76);
  border: 1px solid rgba(241, 237, 227, 0.45);
  border-radius: 50%;
  color: var(--on-dark);
  cursor: pointer;
  font-size: 20px;
  height: 44px;
  position: absolute;
  right: 6px;
  top: 6px;
  touch-action: manipulation;
  width: 44px;
}

.preview-remove:hover:not(:disabled) {
  background: var(--oxide);
}

/* 文档化增强：源缺失 disabled 态，对齐 §9.1 disabled 模式（先例 L765-766） */
.preview-remove:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

/* venus style.css L793 */
.preview-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 12px;
}

/* venus style.css L794 */
.preview-meta strong {
  color: var(--ink);
  display: flex;
  font-size: 12px;
  font-weight: 600;
  min-width: 0;
}

/* venus style.css L798（.preview-meta > span → class） */
.info {
  color: var(--ink-muted);
  font-family: var(--font-data);
  font-size: 10px;
  font-weight: 500;
  line-height: 1.4;
}

/* venus style.css L799 */
.preview-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

/* venus style.css L763 + L800 合并（font 简写拆开，同 SelectionToolbar 先例）。
 * 36px 贴源 L800 有意覆盖：卡片元数据区紧凑语境，满足 WCAG 2.2 AA
 * 24px 最低触控标准（§14.1 目标 AA）；与 §9.1 44px 通用规则的偏离已文档化。 */
.preview-move {
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--hairline-strong);
  color: var(--ink-body);
  cursor: pointer;
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 500;
  min-height: 36px;
  padding-inline: 0;
  touch-action: manipulation;
  transition: border-color var(--motion-fast) var(--ease-standard),
    color var(--motion-fast) var(--ease-standard);
}

/* venus style.css L764 */
.preview-move:hover:not(:disabled) {
  border-color: var(--oxide);
  color: var(--oxide);
}

/* venus style.css L765-766 */
.preview-move:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
</style>
