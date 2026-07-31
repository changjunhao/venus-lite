<script setup lang="ts">
import { LOW_RES_TYPES } from '~/composables/useImageSelection'

/**
 * 上传区：拖拽 / 点击 / 键盘触发文件选择（DESIGN.md §9.5、§14.2），
 * 收敛 venus single.html L79-86 与 group-joint.html L71-76 两套 #upload-zone。
 *
 * - 只负责触发选择与拖拽视觉反馈，emit 原始 File[] 快照；
 *   校验 / 去重 / objectURL 生命周期均由 useImageSelection 承担
 *   （component-plan §2.5），组件零业务。
 * - 文案全部纯 props，由调用方解析 i18n 后传入（先例同 HomeContactSheet）；
 *   拖拽态标题切换为 dragTitle（DESIGN §9.5「松开以添加照片」）。
 * - dragenter/dragleave 深度计数器防止拖经子元素时状态闪烁
 *   （DESIGN §9.5「不使用闪烁」；venus 裸 dragleave 的已知缺陷）。
 */
const props = withDefaults(
  defineProps<{
    /** 主标题（single：「拖入一张照片，或点击选择」；group：「拖入 2–10 张照片，或点击批量选择」） */
    title: string
    /** 次级格式与尺寸限制说明（DESIGN §9.5） */
    hint?: string
    /** 拖拽态替换标题（DESIGN §9.5） */
    dragTitle?: string
    /** 多选模式：single=false，group=true，透传 <input> */
    multiple?: boolean
    /** MIME 白名单，默认为 4K 以下支持的全部格式 */
    accept?: string
    /** 交互锁定（对齐 group.js L1088 isLoading 守卫） */
    disabled?: boolean
  }>(),
  {
    hint: '',
    dragTitle: '',
    multiple: false,
    accept: LOW_RES_TYPES.join(','),
    disabled: false,
  },
)

const emit = defineEmits<{
  /** 原始选中文件快照数组，消费方直接传给 useImageSelection().addFiles() */
  files: [File[]]
}>()

const hintId = useId()
const inputRef = useTemplateRef('inputRef')

// ── 拖拽状态：深度计数器，仅 0↔1 翻转时触发渲染 ──

const dragDepth = ref(0)
const isDragOver = computed(() => dragDepth.value > 0)

// ── 交互（收敛 app.js L144-165 + group.js L1088-1108）──

function openPicker() {
  if (props.disabled) return
  inputRef.value?.click()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    openPicker()
  }
}

function onDragEnter() {
  if (props.disabled) return
  dragDepth.value += 1
}

function onDragLeave() {
  dragDepth.value = Math.max(0, dragDepth.value - 1)
}

function onDrop(event: DragEvent) {
  dragDepth.value = 0
  if (props.disabled) return
  // FileList 为 live 引用，消费方 addFiles 是 async——先快照
  const files = Array.from(event.dataTransfer?.files ?? [])
  if (files.length > 0) emit('files', files)
}

function onChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  // 先快照后重置：允许重选同一文件（group.js L1107），且在 async 消费前完成
  input.value = ''
  if (files.length > 0) emit('files', files)
}
</script>

<template>
  <div
    class="upload-zone crop-mark-frame"
    :class="{ 'drag-over': isDragOver }"
    role="button"
    tabindex="0"
    :aria-describedby="hint ? hintId : undefined"
    :aria-disabled="disabled || undefined"
    @click="openPicker"
    @keydown="onKeydown"
    @dragenter="onDragEnter"
    @dragover.prevent
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
  >
    <div class="upload-icon" aria-hidden="true">
      <slot name="icon">
        <!-- 默认图标：32px 线性相机框（venus single.html L81，DESIGN §9.5） -->
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        ><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
      </slot>
    </div>
    <h3 class="upload-title">{{ isDragOver && dragTitle ? dragTitle : title }}</h3>
    <p v-if="hint" :id="hintId" class="upload-hint">{{ hint }}</p>
    <!-- @click.stop：input 位于 zone 内部，程序化 click 不得冒泡回 zone 导致递归
         （venus 中 input 为 zone 兄弟节点无此问题，组件化后需显式阻断） -->
    <input
      ref="inputRef"
      type="file"
      class="upload-input"
      :multiple="multiple"
      :accept="accept"
      :disabled="disabled"
      @click.stop
      @change="onChange"
    >
  </div>
</template>

<style scoped>
/* venus style.css L675-689 逐属性对齐。
 * --on-dark / --on-dark-muted 不在 tokens.css（DESIGN.md §16 未定义，
 * HomeContactSheet 先例：归组件局部），用 light-dark() 对齐 venus 双主题源值。 */
.upload-zone {
  --on-dark: #f1ede3;
  --on-dark-muted: light-dark(#aaa296, #9e9689);

  align-content: center;
  background: var(--darkroom);
  border: 1px dashed var(--hairline-strong);
  border-radius: var(--radius-md);
  color: var(--on-dark);
  cursor: pointer;
  display: grid;
  min-height: 280px;
  padding: var(--space-7) var(--space-5);
  place-items: center;
  position: relative;
  text-align: center;
  transition: border-color var(--motion-standard) var(--ease-standard),
    background-color var(--motion-standard) var(--ease-standard),
    transform var(--motion-standard) var(--ease-standard);
}

/* 四角 12×1px 裁切角（style.css L358-382），§8.4：非当前状态 Hairline Strong */
.upload-zone::before {
  --crop-color: var(--hairline-strong);

  background:
    linear-gradient(var(--crop-color), var(--crop-color)) top left / 12px 1px,
    linear-gradient(var(--crop-color), var(--crop-color)) top left / 1px 12px,
    linear-gradient(var(--crop-color), var(--crop-color)) top right / 12px 1px,
    linear-gradient(var(--crop-color), var(--crop-color)) top right / 1px 12px,
    linear-gradient(var(--crop-color), var(--crop-color)) bottom left / 12px 1px,
    linear-gradient(var(--crop-color), var(--crop-color)) bottom left / 1px 12px,
    linear-gradient(var(--crop-color), var(--crop-color)) bottom right / 12px 1px,
    linear-gradient(var(--crop-color), var(--crop-color)) bottom right / 1px 12px;
  background-repeat: no-repeat;
  content: "";
  inset: 14px;
  pointer-events: none;
  position: absolute;
  z-index: 2;
}

/* style.css L691-692 */
.upload-icon {
  color: var(--amber);
  margin: 0 0 14px;
}

/* style.css L693-694 */
.upload-title {
  color: var(--on-dark);
  font-size: 18px;
  font-weight: 600;
}

/* style.css L695-696 */
.upload-hint {
  color: var(--on-dark-muted);
  font-size: 13px;
  margin-top: 8px;
  max-width: 680px;
}

/* style.css L697-702：hover / focus-visible / drag-over 提升一个表面层级（§9.5） */
.upload-zone:hover,
.upload-zone:focus-visible,
.upload-zone.drag-over {
  background: var(--darkroom-raised);
  border-color: var(--amber);
}

/* style.css L703-704：§9.5 缩放上限 1.004 */
.upload-zone.drag-over {
  transform: scale(1.004);
}

/* style.css L379-382：当前状态裁切角切 Amber（§8.4） */
.upload-zone.drag-over::before,
.upload-zone:focus-visible::before {
  --crop-color: var(--amber);
}

/* style.css L705：隐藏 input，zone 的 role="button" 承载 AT 语义 */
.upload-input {
  display: none;
}

/* style.css L1155：移动端收窄 */
@media (max-width: 767px) {
  .upload-zone {
    min-height: 220px;
    padding: 36px 18px;
  }
}
</style>
