<script setup lang="ts">
/**
 * 通用弹层：backdrop 关闭、Esc、focus trap、aria-modal（DESIGN.md §9.15 / §14.2），
 * 对应 venus 分享预览弹窗（`.share-preview`），沉浸对比经 useFocusTrap 复用其 trap 逻辑。
 *
 * - `v-if` 懒渲染：关闭即销毁内容，释放分享大图等资源；Teleport 到 body 规避层叠上下文。
 * - 零内部文案：`label`（aria-label）与全部内容归调用方；作用域插槽暴露 `close`，
 *   头部/底部/关闭按钮由调用方组合（SharePreviewModal 等）。
 * - Esc / backdrop 恒可关闭（venus 两处弹层的既有行为），不设开关 props。
 * - inheritAttrs 关闭后调用方 class 落在 panel 上，尺寸偏移经此覆盖（既有扩展点约定）。
 */
defineOptions({ inheritAttrs: false })

const props = defineProps<{
  label: string
}>()

const open = defineModel<boolean>('open', { required: true })

// 内部关闭（backdrop/Esc/作用域插槽）随 update:open 一并发出，供调用方做 objectURL 清理等
const emit = defineEmits<{ close: [] }>()

const panel = ref<HTMLElement | null>(null)

useFocusTrap(panel, computed(() => open.value))

function close() {
  open.value = false
  emit('close')
}

if (import.meta.client) {
  // Esc 关闭 + 滚动锁定（对应 venus .compare-immersive-open { overflow: hidden }）
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close()
  }

  let restoreOverflow = ''
  let locked = false

  const lock = () => {
    locked = true
    document.addEventListener('keydown', onKeydown)
    restoreOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }

  const unlock = () => {
    if (!locked) return
    locked = false
    document.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = restoreOverflow
  }

  watch(open, value => (value ? lock() : unlock()), { immediate: true })
  onUnmounted(unlock)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-overlay">
        <div class="modal-backdrop" aria-hidden="true" @click="close" />
        <div
          ref="panel"
          class="modal-panel"
          role="dialog"
          aria-modal="true"
          :aria-label="props.label"
          tabindex="-1"
          v-bind="$attrs"
        >
          <slot :close="close" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* venus .share-preview：居中网格，z-index 2000 高于导航（1000，§7.3） */
.modal-overlay {
  display: grid;
  inset: 0;
  padding: var(--space-5);
  place-items: center;
  position: fixed;
  z-index: 2000;
}

/* venus .share-preview-backdrop：两主题共用近黑，不干扰照片色彩判断（§2.1） */
.modal-backdrop {
  background: rgba(12, 11, 10, 0.78);
  inset: 0;
  position: absolute;
}

/* §8：Dialog 用 radius-lg（每屏最多一个）+ shadow-overlay（阴影仅限浮层，§8.3）。
 * 尺寸取 venus .share-preview-panel，偏移由调用方 class 覆盖。 */
.modal-panel {
  background: var(--paper-raised);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-overlay);
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 48px);
  max-width: min(860px, 100%);
  min-width: 0;
  overflow: hidden;
  position: relative;
}

/* §12.3 允许清单：透明度 0→1、Y 8px→0，280ms（Dialog 档）；不用 scale（§12.4）。
 * reduced-motion 时长由 tokens.css 全局降为 1ms，此处无需处理。 */
.modal-enter-active,
.modal-enter-active .modal-panel {
  transition: opacity var(--motion-slow) var(--ease-enter),
    transform var(--motion-slow) var(--ease-enter);
}

.modal-leave-active,
.modal-leave-active .modal-panel {
  transition: opacity var(--motion-slow) var(--ease-exit),
    transform var(--motion-slow) var(--ease-exit);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-panel,
.modal-leave-to .modal-panel {
  transform: translateY(8px);
}
</style>
