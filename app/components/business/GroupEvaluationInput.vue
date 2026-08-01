<script setup lang="ts">
import type { ImageEntry, SelectionErrorCode } from '~/composables/useImageSelection'
import type { SelectOption } from '~/components/ui/BaseSelect.vue'
import { MAX_GROUP_IMAGES, useImageSelection } from '~/composables/useImageSelection'

/**
 * 组图输入卡（joint/compare 共用）：多图选择、排序、校验、开始评估
 * （component-plan §2.4 L159），首个业务组件——Flow 层组合本组件与
 * ReviewProgress + 结果编排构成完整评估流程。
 *
 * 消费方：
 * - JointEvaluationFlow.vue（variant="joint"）
 * - CompareEvaluationFlow.vue（variant="compare"）
 *
 * joint/compare 差异收敛为单个 `variant` prop（component-plan L281-282
 * 「仅按钮文案不同（props 解决）」）：intro 文案、按钮文案、PreviewGrid 布局变体。
 *
 * i18n 内部解析偏离声明：upload/ui 层组件遵循「文案纯 props」约定，
 * 本组件作为 business 层编排组件在内部经 useI18n 解析文案——
 * 若文案经 props 传递，两个 Flow 将各重复 ~20 个 t() 调用，
 * 正是本组件存在要消除的重复。该偏离限于 business 层，
 * 不改变零业务子组件的既定契约。
 *
 * loading 语义映射（group.js L1034-1042 setLoading）：
 * - 根 section aria-busy（L1036）
 * - 评估按钮 disabled + 文案切换为「评估中」（L1038-1039）
 * - 门类下拉 / 逐图开关 / 清空按钮 disabled（L1040-1042）
 * - 上传区 / 预览网格交互锁定（L168/L205/L215/L226 守卫）
 */

export interface GroupStartPayload {
  entries: ImageEntry[]
  genre: string
  includePerImage: boolean
}

const props = withDefaults(
  defineProps<{
    /** 唯一差异源：驱动 intro 文案、按钮文案、PreviewGrid 布局变体 */
    variant: 'joint' | 'compare'
    /** 评估加载中锁定（group.js L1034-1042 setLoading 语义） */
    loading?: boolean
  }>(),
  { loading: false },
)

const emit = defineEmits<{
  /** 开始评估：载荷供 Flow 层执行 OSS 上传 + SSE 流（group.js L337-346 请求体三字段） */
  start: [payload: GroupStartPayload]
  /** 转发 GenreControls 事件，供 Flow invalidateResult（group.js L1083-1086） */
  genreChange: [value: string | number]
  /** 转发 GenreControls 事件，供 Flow invalidateResult（group.js L1087） */
  includePerImageChange: [value: boolean]
  /** 选片增删/排序/清空变更，供 Flow invalidateResult（group.js L199/209/220/227） */
  selectionChange: [count: number]
}>()

// ── 状态（必须在 setup 同步作用域内调用：确保 onScopeDispose 绑定组件 effectScope）──

const { entries, errors, count, canSubmit, addFiles, removeEntry, moveEntry, clear } = useImageSelection({ mode: 'multi' })

// venus 默认值：genre='auto'（group-joint.html L59 selected）、includePerImage=false（§9.3 默认关闭）
const genre = ref('auto')
const includePerImage = ref(false)

/** 守卫错误（group.js L327-329 evaluateGroup 起始检查），与选择错误共享展示通道 */
const guardError = ref('')

// ── i18n 派生 ──

const { t } = useI18n()

/** 页面命名空间：joint → groupJoint / compare → groupCompare（遵循 single.* 先例） */
const ns = computed(() => (props.variant === 'joint' ? 'groupJoint' : 'groupCompare'))

// ── 门类选项（venus group-joint.html L59-62 静态选项；
//    metadata 从不填充下拉框——GenreControls L8-10，不引入 useEvalMetadata）──

const GENRE_OPTIONS: { value: string, key: string }[] = [
  { value: 'auto', key: 'upload.genreAuto' },
  { value: 'portrait', key: 'upload.genrePortrait' },
  { value: 'landscape', key: 'upload.genreLandscape' },
  { value: 'documentary', key: 'upload.genreDocumentary' },
  { value: 'fine_art', key: 'upload.genreFineArt' },
  { value: 'commercial', key: 'upload.genreCommercial' },
  { value: 'architecture', key: 'upload.genreArchitecture' },
  { value: 'nature', key: 'upload.genreNature' },
  { value: 'sports', key: 'upload.genreSports' },
]

// computed 保证稳定引用（GenreControls L14-15 文档约束），仅 locale 切换时重算
const genreOptions = computed<SelectOption[]>(() =>
  GENRE_OPTIONS.map(({ value, key }) => ({ value, label: t(key) })),
)

// ── 标签模板解析（vue-i18n 会消费 {index}/{name} 占位符，显式传参保留原样输出；
//    PreviewGrid L64-66 resolveTemplate 逐卡替换）──

const templateParams = { index: '{index}', name: '{name}' }
const altTemplate = computed(() => t('upload.photoAlt', templateParams))
const removeLabelTemplate = computed(() => t('upload.removePhoto', templateParams))
const moveBackLabelTemplate = computed(() => t('upload.moveBack', templateParams))
const moveForwardLabelTemplate = computed(() => t('upload.moveForward', templateParams))

// ── 错误映射（useImageSelection L50 委托消费方映射文案；格式贴源 group.js）──

const ERROR_KEYS: Record<SelectionErrorCode, string> = {
  'unsupported-type': 'upload.error.unsupportedType',
  'unreadable': 'upload.error.unreadable',
  'exceeds-8k': 'upload.error.exceeds8k',
  'high-res-format': 'upload.error.highResFormat',
  'duplicate': 'upload.error.duplicate',
  'over-capacity': 'upload.error.overCapacity',
}

const errorMessage = computed(() => {
  if (guardError.value) return guardError.value
  return errors.value
    .map((e) => {
      const message = t(ERROR_KEYS[e.code], e.params ?? {})
      // over-capacity 不带文件名前缀（group.js L180）；其余加 `${fileName}：`（L186/L195）
      return e.code === 'over-capacity' ? message : `${e.fileName}：${message}`
    })
    .join('；') // group.js L201
})

// ── 事件处理（loading 守卫贴源 group.js L168/L205/L215/L226）──

async function onFiles(files: File[]) {
  if (props.loading) return
  guardError.value = '' // L169 hideError
  const previousCount = count.value
  await addFiles(files)
  // 仅在选择实际变化时通知失效（L199）
  if (count.value !== previousCount) emit('selectionChange', count.value)
}

function onRemove(id: string) {
  if (props.loading) return
  removeEntry(id)
  emit('selectionChange', count.value) // L209 invalidateResult
}

function onMove(id: string, direction: -1 | 1) {
  if (props.loading) return
  moveEntry(id, direction)
  emit('selectionChange', count.value) // L220 invalidateResult
}

function onClear() {
  if (props.loading) return
  clear()
  emit('selectionChange', 0) // L227 invalidateResult
}

function onStart() {
  if (props.loading) return
  guardError.value = '' // L325 hideError
  // 防御性守卫（L327-329）：UI 已由 canSubmit 禁用按钮，此为兜底
  if (!canSubmit.value) {
    guardError.value = t(`${ns.value}.minImagesError`)
    return
  }
  emit('start', { entries: entries.value, genre: genre.value, includePerImage: includePerImage.value })
}
</script>

<template>
  <UiBaseCard
    as="section"
    class="group-input-card"
    :aria-busy="loading || undefined"
  >
    <!-- group-joint.html L52-55 .group-intro.input-sheet-header -->
    <div class="group-intro">
      <div>
        <UiBaseSectionIndex>INPUT</UiBaseSectionIndex>
        <h2>{{ t(`${ns}.inputTitle`) }}</h2>
        <p>{{ t(`${ns}.inputIntro`) }}</p>
      </div>
      <UiImageCountBadge variant="group" :count="count" :max="MAX_GROUP_IMAGES" />
    </div>

    <!-- group-joint.html L57-69 门类 + 逐图明细开关 -->
    <UploadGenreControls
      v-model:genre="genre"
      v-model:include-per-image="includePerImage"
      show-per-image
      :genre-options="genreOptions"
      :genre-label="t('upload.genreLabel')"
      :per-image-title="t('upload.perImageTitle')"
      :per-image-description="t('upload.perImageDescription')"
      :disabled="loading"
      @genre-change="emit('genreChange', $event)"
      @include-per-image-change="emit('includePerImageChange', $event)"
    />

    <!-- group-joint.html L71-76 上传区（Nuxt 自动导入对 upload/UploadZone 去重命名为 UploadZone） -->
    <UploadZone
      multiple
      :title="t('upload.titleMulti')"
      :hint="t('upload.formatHint')"
      :drag-title="t('upload.dragTitle')"
      :disabled="loading"
      @files="onFiles"
    />

    <!-- group-joint.html L78-81 选择状态栏 -->
    <UploadSelectionToolbar
      :count="count"
      :status-empty="t('upload.statusEmpty')"
      :status-one-more="t('upload.statusOneMore')"
      :status-ready="t('upload.statusReady', { count })"
      :order-note="t('upload.orderNote')"
      :clear-label="t('upload.clearAll')"
      :disabled="loading"
      @clear="onClear"
    />

    <!-- group-joint.html L82 预览网格（joint=contact-sheet / compare=comparison-grid） -->
    <UploadPreviewGrid
      :entries="entries"
      :variant="variant"
      :disabled="loading"
      :alt-template="altTemplate"
      :remove-label-template="removeLabelTemplate"
      :move-back-label-template="moveBackLabelTemplate"
      :move-forward-label-template="moveForwardLabelTemplate"
      :move-back-text="t('upload.moveBackText')"
      :move-forward-text="t('upload.moveForwardText')"
      @remove="onRemove"
      @move="onMove"
    />

    <!-- group-joint.html L84-87 评估动作 -->
    <div class="input-actions">
      <UiBaseButton
        class="group-evaluate-button"
        :disabled="!canSubmit"
        :loading="loading"
        @click="onStart"
      >
        {{ loading ? t(`${ns}.evaluating`) : t(`${ns}.evaluate`) }}
      </UiBaseButton>
      <UiBaseErrorMessage :message="errorMessage" />
    </div>
  </UiBaseCard>
</template>

<style scoped>
/* venus style.css L607-614 .group-intro */
.group-intro {
  align-items: start;
  border-bottom: 1px solid var(--hairline);
  display: grid;
  gap: var(--space-7);
  grid-template-columns: minmax(0, 1fr) auto;
  padding-bottom: var(--space-6);
}

/* venus style.css L615-623（仅 h2 部分；result-masthead h2 归其自身组件） */
.group-intro h2 {
  font-family: var(--font-display);
  font-size: clamp(30px, 3.3vw, 40px);
  font-weight: 500;
  letter-spacing: -0.03em;
  line-height: 1.12;
  margin-top: var(--space-3);
}

/* venus style.css L624 */
.group-intro p {
  color: var(--ink-body);
  margin-top: var(--space-3);
  max-width: 690px;
}

/* venus style.css L727 .input-actions */
.input-actions {
  align-items: center;
  display: grid;
  gap: var(--space-5);
  grid-template-columns: minmax(220px, 360px) minmax(0, 1fr);
  margin-top: var(--space-5);
}

/* venus style.css L740-743 增量属性（颜色/圆角/禁用态 BaseButton .btn-primary 已覆盖） */
.group-evaluate-button {
  height: 48px;
  width: 100%;
}

/* venus style.css L1149 移动端折叠（断点与源一致） */
@media (max-width: 767px) {
  .group-intro {
    gap: 24px;
    grid-template-columns: 1fr;
  }

  /* venus style.css L1157 */
  .input-actions {
    gap: 12px;
    grid-template-columns: 1fr;
  }
}
</style>
