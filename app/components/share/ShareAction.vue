<script setup lang="ts">
import type { ShareImagePhase } from '~/composables/useShareImage'

/**
 * 生成分享图按钮：禁用 / 三阶段进度文案 / 失败态（component-plan L138），
 * 收敛 venus single.html L179-184 `#share-btn` 与 app.js L254-295 点击逻辑的
 * UI 面为声明式组件。
 *
 * - 纯展示壳：useShareImage() 实例归 Flow 持有（component-plan §2.1 原则 2），
 *   本组件仅消费 phase / error 并 emit generate；Flow 接线约定：
 *     @generate → await generate(options) → 成功则打开 SharePreviewModal。
 * - 文案基于 phase 枚举映射 i18n props（有意决策：composable onProgress 消息
 *   硬编码中文，不消费；phase 由 composable L672-676 从消息推断，枚举稳定）。
 *   三阶段对齐 app.js L281-283 onProgress 逐步替换文案的原始行为。
 * - loading 态委托 BaseButton：disabled + aria-busy（BaseButton L37-38），
 *   原生拦截忙态点击，无需组件内守卫。
 * - error 非空且 phase idle 时显示失败文案（app.js L290 catch 分支），
 *   按钮恢复可点击供重试（app.js L292 finally re-enable）。
 * - labels 由调用方解析 i18n（share.* 键）后传入——纯 props 组件不内嵌
 *   $t()（先例 MetadataStrip L13-14）；中文默认值兜底。
 * - 无自有 CSS：.btn-share 样式已在 BaseButton L73-83；容器布局已在
 *   MetadataStrip .metadata-actions L104-109。
 */
const props = withDefaults(
  defineProps<{
    /** 当前生成阶段（useShareImage phase）；非 idle 时 loading + 文案切换 */
    phase?: ShareImagePhase
    /** 生成失败信息（useShareImage error）；非空且 idle 时显示失败文案 */
    error?: string | null
    /** 禁用（无评估结果时 Flow 传 true；对齐 app.js L180 初始 disabled / L882 重置） */
    disabled?: boolean
    // ── i18n labels（调用方解析 share.* 键后传入）──
    /** idle 态文案（single.html L182「生成分享图」） */
    label?: string
    /** phase loading-image 文案（share-image.js 读取照片阶段） */
    loadingImageLabel?: string
    /** phase generating 文案（app.js L265 初始「正在生成...」） */
    generatingLabel?: string
    /** phase exporting 文案（share-image.js 导出阶段） */
    exportingLabel?: string
    /** 失败态文案（app.js L290「生成失败，请重试」） */
    failedLabel?: string
  }>(),
  {
    phase: 'idle',
    error: null,
    disabled: false,
    label: '生成分享图',
    loadingImageLabel: '正在读取照片…',
    generatingLabel: '正在生成分享图…',
    exportingLabel: '正在准备预览…',
    failedLabel: '生成失败，请重试',
  },
)

const emit = defineEmits<{
  /** app.js L256 click → generateShareImage()；Flow 接 useShareImage().generate(options) */
  generate: []
}>()

// ── 文案派生（app.js L264-293 三态：进度 / 失败 / 默认）──

const buttonLabel = computed(() => {
  if (props.phase === 'loading-image') return props.loadingImageLabel
  if (props.phase === 'generating') return props.generatingLabel
  if (props.phase === 'exporting') return props.exportingLabel
  if (props.error) return props.failedLabel
  return props.label
})
</script>

<template>
  <UiBaseButton
    variant="share"
    :disabled="props.disabled"
    :loading="props.phase !== 'idle'"
    @click="emit('generate')"
  >
    <!-- venus single.html L181 下载图标（装饰性，DESIGN §14.4 aria-hidden） -->
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
    <span>{{ buttonLabel }}</span>
  </UiBaseButton>
</template>
