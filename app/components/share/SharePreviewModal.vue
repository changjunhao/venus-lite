<script setup lang="ts">
/**
 * 分享图预览弹窗：header / darkroom 图台 / actions 三段布局（component-plan L139），
 * 收敛 venus single.html L191-198 `#share-preview` 与 app.js L88-136 弹窗交互为
 * 声明式组件，弹层基座复用 BaseModal（backdrop/Esc/focus trap/滚动锁/280ms 动效）。
 *
 * - 纯展示壳：objectURL 生命周期归 Flow 持有的 useShareImage()（component-plan §2.1
 *   原则 2）。Flow 接线约定：
 *     @download → download() → open=false → reset()（对齐 app.js L111-120 先下载后关闭）
 *     @close → reset()（revoke objectURL，对齐 app.js L91-100 closeSharePreview）
 * - class="share-preview-panel" 经 attrs 落在 BaseModal .modal-panel 上——
 *   调用方 class 是 BaseModal 既定样式扩展点（BaseModal L10 注释 / spec L101-113）。
 * - 下载按钮仅 emit download，不自行关闭：venus 先触发锚点点击再 close
 *   （app.js L111-120），保证关闭/revoke 时下载已同步发起。
 * - img v-if="url"：空值不渲染（对齐 app.js L94 removeAttribute('src')）；
 *   decoding="async" 使 2160px 宽海报解码不阻塞弹窗入场动画合成。
 * - BaseModal v-if 懒渲染：关闭即销毁 img DOM，释放 PNG 解码位图。
 * - labels 由调用方解析 i18n（share.* 键）后传入——纯 props 组件不内嵌
 *   $t()（先例 MetadataStrip L13-14）；中文默认值兜底。
 */
const props = withDefaults(
  defineProps<{
    /** 生成海报 objectURL（useShareImage previewUrl；父组件管理生命周期） */
    url: string | null
    // ── i18n labels（调用方解析 share.* 键后传入）──
    /** 弹窗 aria-label 与标题（single.html L193-194「分享图预览」） */
    label?: string
    /** 预览图 alt（single.html L195） */
    imgAlt?: string
    /** 下载按钮文案（single.html L196「下载图片」） */
    downloadLabel?: string
    /** 取消按钮文案（single.html L196「取消」） */
    cancelLabel?: string
    /** 关闭按钮 aria-label（single.html L194「关闭预览」） */
    closeAria?: string
  }>(),
  {
    label: '分享图预览',
    imgAlt: '分享图预览',
    downloadLabel: '下载图片',
    cancelLabel: '取消',
    closeAria: '关闭预览',
  },
)

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  /** app.js L111-120 downloadSharePreview：Flow 调 download() 后关闭并 reset() */
  download: []
  /** app.js L91-100 closeSharePreview：Flow 调 reset() revoke objectURL */
  close: []
}>()
</script>

<template>
  <UiBaseModal
    v-model:open="open"
    :label="props.label"
    class="share-preview-panel"
    @close="emit('close')"
  >
    <template #default="{ close }">
      <!-- venus single.html L194：标题 + × 关闭 -->
      <div class="share-preview-header">
        <div class="share-preview-title">{{ props.label }}</div>
        <button
          type="button"
          class="share-preview-close"
          :aria-label="props.closeAria"
          @click="close"
        >
          ×
        </button>
      </div>
      <!-- venus single.html L195：darkroom 图台（§4.3 暗房语气，不干扰色彩判断 §2.1） -->
      <div class="share-preview-body">
        <img v-if="props.url" :src="props.url" :alt="props.imgAlt" decoding="async">
      </div>
      <!-- venus single.html L196：下载（primary）+ 取消（secondary） -->
      <div class="share-preview-actions">
        <UiBaseButton variant="primary" @click="emit('download')">
          {{ props.downloadLabel }}
        </UiBaseButton>
        <UiBaseButton variant="secondary" @click="close">
          {{ props.cancelLabel }}
        </UiBaseButton>
      </div>
    </template>
  </UiBaseModal>
</template>

<style scoped>
/* venus style.css L1050 */
.share-preview-header {
  align-items: center;
  border-bottom: 1px solid var(--hairline);
  display: flex;
  justify-content: space-between;
  min-height: 60px;
  padding: 0 var(--space-5);
}

/* venus style.css L1051 */
.share-preview-title {
  color: var(--ink);
  font-weight: 600;
}

/* venus style.css L1052：44px 方按钮（DESIGN §9.1 触控目标）；
 * venus 为 .btn 覆盖，此处原生 button + 少量行忠实复现，不扩 BaseButton 变体 */
.share-preview-close {
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--ink);
  cursor: pointer;
  font-size: 24px;
  line-height: 1;
  min-height: 44px;
  padding: 0;
  width: 44px;
}

/* venus style.css L1053：darkroom 图台；flex 1 + min-height 0 撑满 panel 剩余高度 */
.share-preview-body {
  background: var(--darkroom);
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--space-5);
  text-align: center;
}

/* venus style.css L1054 */
.share-preview-body img {
  max-height: 70vh;
  object-fit: contain;
}

/* venus style.css L1055 */
.share-preview-actions {
  border-top: 1px solid var(--hairline);
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
  padding: var(--space-4) var(--space-5);
}

/* venus style.css L1200-1203 ≤767px：全屏 + 纵向满宽按钮（DESIGN §13.1）。
 * :global 覆盖经 attrs 落在 BaseModal panel 上的本组件专属 class（全仓库唯一）；
 * overlay 保留 space-5 padding（BaseModal L86），故 min-height 减 48px。 */
@media (max-width: 767px) {
  :global(.share-preview-panel) {
    border: 0;
    border-radius: 0;
    max-height: none;
    min-height: calc(100dvh - 48px);
  }

  .share-preview-actions {
    flex-direction: column;
  }

  .share-preview-actions :global(.btn) {
    width: 100%;
  }
}
</style>
