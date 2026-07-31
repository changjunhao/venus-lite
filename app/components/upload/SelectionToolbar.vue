<script setup lang="ts">
/**
 * 选择状态栏：三态状态文案 + 清空按钮（component-plan L104），
 * 收敛 venus group-joint.html / group-compare.html L78-81 完全相同的 #selection-toolbar。
 *
 * - 三态派生镜像 group.js L240-242：0 → statusEmpty / 1 → statusOneMore / ≥2 → statusReady；
 *   文案全部纯 props，由调用方解析 i18n 后传入（先例同 UploadZone），
 *   statusReady 含 {count} 插值，调用方用 t('upload.statusReady', { count }) 预解析。
 * - 可见性 v-if="count > 0" 对应 group.js L237 `selectionToolbar.hidden = count === 0`；
 *   count===0 时 statusEmpty 在 venus 中同样不可见，行为等价。
 * - aria-live="polite" 收窄至 status span（有意偏差：venus 在整个 <p> 上）——
 *   静态后缀 orderNote 不参与每次计数播报（DESIGN §14.5「避免重复朗读」）；
 *   ImageCountBadge 已委托本组件为选片计数唯一播报点（ImageCountBadge.vue 注释）。
 * - 清空按钮复用 BaseButton variant="text"（.text-button 全套样式已在
 *   BaseButton.vue，含 hover oxide 与 disabled opacity；14px vs 源 12px 为其
 *   既定规范化决策，不 fork）。
 * - 点击仅 emit('clear')：DESIGN §9.1「清空全部需要确认」的确认弹窗归父级编排，
 *   组件零业务（先例同 UploadZone emit files）。
 */
const props = withDefaults(
  defineProps<{
    /** 已选照片数（group.js L235 state.files.length） */
    count: number
    /** count === 0 状态文案（group.js L240） */
    statusEmpty: string
    /** count === 1 状态文案（group.js L241） */
    statusOneMore: string
    /** count >= 2 状态文案，调用方用 t('upload.statusReady', { count }) 预插值（group.js L242） */
    statusReady: string
    /** 状态后缀说明（group-joint.html L79「照片编号按当前顺序排列」） */
    orderNote: string
    /** 清空按钮文案（group-joint.html L80「清空全部」） */
    clearLabel: string
    /** 评估加载中禁用清空按钮（group.js L1042） */
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{
  /** group.js L1109 click → clearFiles()；调用方接 useImageSelection().clear() */
  clear: []
}>()

// ── 三态派生（group.js L240-242 单点维护）──

const statusText = computed(() => {
  if (props.count === 0) return props.statusEmpty
  if (props.count === 1) return props.statusOneMore
  return props.statusReady
})
</script>

<template>
  <div v-if="count > 0" class="selection-toolbar">
    <p>
      <span class="selection-status" aria-live="polite">{{ statusText }}</span>
      <template v-if="orderNote"> · {{ orderNote }}</template>
    </p>
    <UiBaseButton variant="text" :disabled="disabled" @click="emit('clear')">
      {{ clearLabel }}
    </UiBaseButton>
  </div>
</template>

<style scoped>
/* venus style.css L759 */
.selection-toolbar {
  align-items: center;
  display: flex;
  gap: var(--space-5);
  justify-content: space-between;
  margin: var(--space-5) 0 var(--space-3);
}

/* venus style.css L760（font 简写拆开，同 ImageCountBadge 先例） */
.selection-toolbar p {
  color: var(--ink-muted);
  font-family: var(--font-data);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.5;
}

/* venus style.css L761（#selection-status → class） */
.selection-status {
  color: var(--ink);
  font-weight: 600;
}

/* venus style.css L1158 移动端覆盖，断点与源一致 */
@media (max-width: 767px) {
  .selection-toolbar {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }
}
</style>
