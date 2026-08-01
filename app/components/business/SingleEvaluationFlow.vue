<script lang="ts">
// 共享纯函数已迁移至 ~/utils/evaluation-mapping（Joint/Compare 复用）；
// 双 script 块编译为同一模块，导入统一收拢于此（setup 块共享模块作用域）。
import type { EvaluationResult, ExifTagKey, ProcessStepItem, StreamAgent } from '#shared/types/evaluation'
import type { SelectOption } from '~/components/ui/BaseSelect.vue'
import { formatGenreSceneTag, getScoreBand } from '#shared/utils/format'
// 六个编排依赖显式导入（非自动导入）：Flow 的核心编排面，
// 同时保证测试经 vi.mock('~/composables/*') 拦截的确定性
import { resolveGenreLabel, resolveSceneLabel, useEvalMetadata } from '~/composables/useEvalMetadata'
import { useEvaluationStream } from '~/composables/useEvaluationStream'
import { useExif } from '~/composables/useExif'
import { useImageSelection } from '~/composables/useImageSelection'
import { useOssUpload } from '~/composables/useOssUpload'
import { useShareImage } from '~/composables/useShareImage'
import {
  buildSingleMetadataItems,
  mapProcessSteps,
  type ProcessStepLabels,
} from '~/utils/evaluation-mapping'
</script>

<script setup lang="ts">
/**
 * 单图评估流程：输入 → 进度 → 结果三态编排（component-plan §2.4），
 * 逐行移植 venus single.html L52-198 页面结构与 app.js 状态机。
 *
 * - §2.4「驱动 useSingleEvaluation」：支撑层（§2.5）为 8 个 composable 的闭合集合，
 *   本组件直接编排其中六个（useImageSelection / useExif / useOssUpload /
 *   useEvaluationStream / useEvalMetadata / useShareImage）满足之，不新增中间层——
 *   本仓 composable 从不解析 i18n（labels 恒由组件传入，useEvaluationStream.startSingle 先例）。
 * - 状态机：idle → uploading（OSS 直传）→ streaming（SSE）→ complete / error；
 *   进度文案（§15.4）派生自 phase + steps active 项，不消费 composable 内部消息。
 * - 映射纯函数经独立 <script> 块导出（ExifTagList 先例）：process 归一
 *   （AgentCallResult unwrap + snake_case 双读，app.js L663-766）、元数据条组装。
 * - 有意偏差：门类变更使旧结果失效，遵循 component-plan §1.3
 *   （group.js L1083-1087 invalidateResult 先例）；venus app.js 无此逻辑。
 * - 评估按钮仅在加载中禁用（app.js L863）；无文件点击走错误提示（app.js L247-250），
 *   不以静默禁用替代出错路径（§15.3「出错后如何继续」）。
 * - 结果播报已抽取为 EvaluationResultAnnouncer（component-plan §2.4，Joint/Compare 复用）；
 *   图片舞台暂内联：待后续抽取为 ImageStage（SinglePreview L16-17）。
 */

// ── Composables（顶层解构，模板自动解包 ref）──

const { t, locale, getLocaleMessage } = useI18n()

/**
 * i18n 原始模板读取：保留 {placeholder} 供 mapProcessSteps 经 fill 插值。
 * t() 会急切消费占位符（缺参时渲染为空），tm()/getLocaleMessage() 返回
 * 编译后 AST（vue-i18n v10 注册时预解析），经 loc.source 取原文。
 */
function template(key: string): string {
  const messages = getLocaleMessage(locale.value) as Record<string, unknown>
  const value = key.split('.').reduce<unknown>((acc, part) => (acc as Record<string, unknown> | undefined)?.[part], messages)
  if (typeof value === 'string') return value
  const source = (value as { loc?: { source?: string } } | null)?.loc?.source
  return typeof source === 'string' ? source : key
}

const { entries, errors: selectionErrors, addFiles } = useImageSelection({ mode: 'single' })
const { exif: exifData, extract: extractExif } = useExif()
const { uploading: ossUploading, upload: uploadFile } = useOssUpload()
const { phase: streamPhase, steps: streamSteps, reasoningBlocks, startSingle } = useEvaluationStream()
const { metadata: genreMetadata, fetch: fetchMetadata } = useEvalMetadata()
const {
  phase: sharePhase,
  error: shareError,
  previewUrl: sharePreviewUrl,
  generate: generateShare,
  download: downloadShare,
  reset: resetShare,
} = useShareImage()

// ── 状态 ──

/** 门类选择（venus 默认 'auto'，single.html L70） */
const genre = ref('auto')
/** 当前选中的唯一图片条目（single 模式替换语义） */
const entry = computed(() => entries.value[0] ?? null)
/** 归一化评估结果（useEvaluationStream 事件层已 camelCase 归一；null = 无结果） */
const result = shallowRef<EvaluationResult | null>(null)
/** 评估流程错误（选片错误与流程错误共用同一 alert，app.js 单 error-message 先例） */
const evaluationError = ref('')
/** §14.5 结果播报（完成只播报一次） */
const announced = ref('')
/** 分享预览弹窗开关 */
const shareOpen = ref(false)
/** 流式识别出的门类（genre_detected 事件，进度文案用） */
const detectedGenre = shallowRef('')
/** 结果区滚动锚点（app.js L519 scrollIntoView） */
const resultRef = useTemplateRef<HTMLElement>('resultRef')

// ── 派生：输入区 ──

/** 门类选项：静态 i18n 键（venus single.html L70-73；metadata 仅用于结果区标签解析，不填充下拉） */
const genreOptions = computed<SelectOption[]>(() => [
  { value: 'auto', label: t('upload.genreAuto') },
  { value: 'portrait', label: t('upload.genrePortrait') },
  { value: 'landscape', label: t('upload.genreLandscape') },
  { value: 'documentary', label: t('upload.genreDocumentary') },
  { value: 'fine_art', label: t('upload.genreFineArt') },
  { value: 'commercial', label: t('upload.genreCommercial') },
  { value: 'architecture', label: t('upload.genreArchitecture') },
  { value: 'nature', label: t('upload.genreNature') },
  { value: 'sports', label: t('upload.genreSports') },
])

/** 选片错误映射（useImageSelection 错误码 → i18n 文案，app.js L180/194/202/208） */
const selectionErrorMsg = computed(() => {
  const err = selectionErrors.value[0]
  if (!err) return ''
  const width = err.params?.width ?? ''
  const height = err.params?.height ?? ''
  switch (err.code) {
    case 'unsupported-type':
      return t('upload.error.unsupportedType')
    case 'unreadable':
      return t('upload.error.unreadable')
    case 'exceeds-8k':
      return t('upload.error.exceeds8k', { width, height })
    case 'high-res-format':
      return t('upload.error.highResFormat', { width, height })
    // duplicate / over-capacity 仅 multi 模式产生，single 不映射
    default:
      return ''
  }
})

const errorMessage = computed(() => evaluationError.value || selectionErrorMsg.value)

/** 评估进行中：OSS 上传或 SSE 流未结束（app.js isLoading 语义） */
const isEvaluating = computed(() => ossUploading.value || streamPhase.value === 'streaming')

// ── 派生：进度文案（§15.4，派生自 phase + steps active 项）──

const activeStep = computed(() => streamSteps.value.find(s => s.status === 'active') ?? null)
const genreDetectorDone = computed(() =>
  streamSteps.value.some(s => s.agent === 'genreDetector' && s.status === 'done'),
)

const agentHints = computed<Record<StreamAgent, string>>(() => ({
  genreDetector: t('review.hintGenreDetector'),
  proposer: t('review.hintProposer'),
  critic: t('review.hintCritic'),
  'proposer-revision': t('review.hintProposerRevision'),
  arbiter: t('review.hintArbiter'),
}))

const loadingText = computed(() => {
  if (ossUploading.value) return t('review.uploadingPhoto')
  if (streamPhase.value !== 'streaming') return t('review.preparing')
  const active = activeStep.value
  if (active) return t('review.stepActive', { step: active.label })
  if (streamSteps.value.length === 0) return t('review.starting')
  if (genreDetectorDone.value && detectedGenre.value) {
    return t('review.genreDetected', { genre: resolveGenreLabel(detectedGenre.value, genreMetadata.value) })
  }
  return t('review.evaluating')
})

const loadingSubtext = computed(() => {
  if (ossUploading.value) return ''
  if (streamPhase.value !== 'streaming') return t('review.preparingSub')
  if (activeStep.value) return agentHints.value[activeStep.value.agent]
  // done 态（门类识别完成、等待下一 agent）无副文案（app.js L498 `done ? '' : ...`）
  if (genreDetectorDone.value && detectedGenre.value) return ''
  return t('review.evaluatingSub')
})

/** 步骤轨道标签（useEvaluationStream.startSingle labels 参数约定） */
const stepLabels = computed<Record<StreamAgent, string>>(() => ({
  genreDetector: t('review.stepGenreDetector'),
  proposer: t('review.stepProposer'),
  critic: t('review.stepCritic'),
  'proposer-revision': t('review.stepProposerRevision'),
  arbiter: t('review.stepArbiter'),
}))

// ── 派生：结果区 ──

/** 综合分数（NaN 防御 → 0，app.js L616-617） */
const totalScore = computed(() => {
  const n = Number(result.value?.totalScore)
  return Number.isFinite(n) ? n : 0
})

/** §5.4 区间文字标签（band key → result.band* 键，单一来源 getScoreBand） */
const bandLabel = computed(() => {
  const key = getScoreBand(totalScore.value).key
  return t(`result.band${key.charAt(0).toUpperCase()}${key.slice(1)}`)
})

/** 门类·场景合并标签（app.js L533-539：子类型未命中回退「未分类」） */
const resultTag = computed(() => {
  const r = result.value
  if (!r) return ''
  const genreLabel = resolveGenreLabel(r.genre, genreMetadata.value)
  const sceneLabel = genreMetadata.value?.[r.genre]?.subtypes?.find(s => s.value === r.sceneType)?.label
    || t('result.sceneUnclassified')
  return formatGenreSceneTag(genreLabel, sceneLabel)
})

const processLabels = computed<ProcessStepLabels>(() => ({
  stepProposal: t('review.stepProposer'),
  stepCritique: t('review.stepCritic'),
  stepRevision: t('review.stepProposerRevision'),
  stepArbitration: t('review.stepArbiter'),
  scoreBadge: template('process.scoreBadge'),
  sceneBadge: template('process.sceneBadge'),
  severityBadge: template('process.severityBadge'),
  severityLow: t('process.severityLow'),
  severityMedium: t('process.severityMedium'),
  severityHigh: t('process.severityHigh'),
  suggestedBadge: template('process.suggestedBadge'),
  revisedBadge: template('process.revisedBadge'),
  finalBadge: template('process.finalBadge'),
  reasoningToggle: template('process.reasoningToggle'),
  agentProposer: t('process.agentProposer'),
  agentCritic: t('process.agentCritic'),
  agentRevision: t('process.agentRevision'),
  agentArbiter: t('process.agentArbiter'),
}))

const processSteps = computed<ProcessStepItem[]>(() => {
  const r = result.value
  if (!r?.process) return []
  return mapProcessSteps(
    r.process,
    processLabels.value,
    sceneType => resolveSceneLabel(sceneType, r.genre, genreMetadata.value),
  )
})

const metaLabels = computed(() => ({
  duration: t('result.meta.duration'),
  rounds: t('result.meta.rounds'),
  time: t('result.meta.time'),
}))

const metadataItems = computed(() =>
  buildSingleMetadataItems(result.value?.metadata, metaLabels.value, locale.value),
)

/** EXIF 标签行短标签（upload.exif.*，透传 SinglePreview → ExifTagList） */
const exifTagLabels = computed<Partial<Record<ExifTagKey, string>>>(() => ({
  cameraModel: t('upload.exif.cameraModel'),
  lensModel: t('upload.exif.lensModel'),
  fNumber: t('upload.exif.fNumber'),
  shutterSpeed: t('upload.exif.shutterSpeed'),
  iso: t('upload.exif.iso'),
  focalLength: t('upload.exif.focalLength'),
  dateTimeOriginal: t('upload.exif.dateTimeOriginal'),
  flash: t('upload.exif.flash'),
}))

/** EXIF 面板长标签（result.exif.*，app.js L584-593 双键集先例） */
const exifPanelLabels = computed<Partial<Record<ExifTagKey, string>>>(() => ({
  cameraModel: t('result.exif.cameraModel'),
  lensModel: t('result.exif.lensModel'),
  fNumber: t('result.exif.fNumber'),
  shutterSpeed: t('result.exif.shutterSpeed'),
  iso: t('result.exif.iso'),
  focalLength: t('result.exif.focalLength'),
  dateTimeOriginal: t('result.exif.dateTimeOriginal'),
  flash: t('result.exif.flash'),
}))

// ── 动作 ──

// 门类元数据（app.js L910-912 DOMContentLoaded 拉取；useState 缓存幂等）
onMounted(() => {
  void fetchMetadata()
})

/** 选片回调：校验入队 + EXIF 即时提取（app.js L212-226） */
async function onFilesSelected(files: File[]): Promise<void> {
  evaluationError.value = '' // app.js L213 hideError
  const previousId = entry.value?.id
  await addFiles(files)
  const current = entry.value
  // 校验失败时条目不变，跳过重复提取
  if (current && current.id !== previousId) {
    await extractExif(current.file)
  }
}

/**
 * 门类变更使旧结果失效（component-plan §1.3；group.js L1083-1087 invalidateResult 先例）。
 * 有意偏差：venus app.js 门类变更仅更新 state.genre，不隐藏结果——以 component-plan 为准。
 */
function onGenreChange(): void {
  if (result.value) {
    result.value = null
    resetShare()
  }
}

/** 结果区滚动（app.js L519；§12.5 reduced-motion 降级为 auto） */
function scrollToResult(): void {
  nextTick(() => {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    resultRef.value?.scrollIntoView({ behavior, block: 'start' })
  })
}

/** 开始评估（app.js L243-252 点击逻辑 + L321-405 evaluateFile） */
async function evaluate(): Promise<void> {
  if (isEvaluating.value) return
  evaluationError.value = ''
  announced.value = '' // app.js L246：新一轮清空播报
  const current = entry.value
  if (!current) {
    evaluationError.value = t('single.noFileError')
    return
  }

  // 新一轮开始：隐藏旧结果、重置分享（app.js L860-886 setLoading(true) 语义）
  result.value = null
  detectedGenre.value = ''
  resetShare()

  // ① 照片准备：OSS 直传（data URL 回退已在 composable 内处理，app.js L327-341）
  let imageUrl: string
  try {
    const uploaded = await uploadFile(current.file)
    imageUrl = uploaded.url
  }
  catch {
    evaluationError.value = t('upload.error.uploadFailed')
    return
  }

  // ② 评估上下文：EXIF 已在选图时提取（app.js L343-350）
  const context: Record<string, unknown> = {}
  if (exifData.value && Object.keys(exifData.value).length > 0) {
    context.exif = exifData.value
  }

  // ③ SSE 流式评估（事件分发与 camelCase 归一由 useEvaluationStream 承担）
  await startSingle(
    { imageUrl, genre: genre.value !== 'auto' ? genre.value : undefined, context },
    {
      onComplete: (data) => {
        // normalizeResult 输出为 camelCase 归一后的 EvaluationResult（useEvaluationStream L303-311）
        result.value = data as unknown as EvaluationResult
        announced.value = t('result.announced') // §14.5 完成只播报一次
        scrollToResult()
      },
      onError: (message) => {
        evaluationError.value = message
      },
      onGenreDetected: (g) => {
        detectedGenre.value = g
      },
    },
    stepLabels,
  )
}

// ── 分享接线（app.js L254-295 生成 / L91-120 弹窗交互）──

async function onShareGenerate(): Promise<void> {
  const data = result.value
  if (!data) return
  const shareGenre = data.genre || 'portrait' // app.js L259
  const sceneType = data.sceneType || ''
  const generated = await generateShare({
    photoSrc: entry.value?.objectURL,
    totalScore: totalScore.value,
    genre: shareGenre,
    genreLabel: resolveGenreLabel(shareGenre, genreMetadata.value),
    // 分享图场景未命中回退原始 sceneType（app.js L273，与结果区「未分类」回退不同）
    sceneLabel: resolveSceneLabel(sceneType, shareGenre, genreMetadata.value),
    dimensions: data.dimensions || {},
    metadata: genreMetadata.value,
    exif: exifData.value,
    evaluatedAt: data.metadata?.evaluatedAt || new Date().toISOString(),
    critique: data.critique || '',
    suggestions: data.suggestions || '',
    arbitrationNotes: data.arbitrationNotes || '',
  })
  if (generated) shareOpen.value = true
}

/** 先触发下载再关闭（app.js L111-120：保证 revoke 时下载已同步发起） */
function onShareDownload(): void {
  downloadShare()
  shareOpen.value = false
  resetShare()
}

/** 关闭预览：revoke objectURL（app.js L91-100 closeSharePreview） */
function onShareClose(): void {
  shareOpen.value = false
  resetShare()
}
</script>

<template>
  <div class="evaluation-shell single-shell">
    <div class="evaluation-context">
      <!-- 输入卡（single.html L54-104） -->
      <UiBaseCard variant="panel" class="input-sheet">
        <div class="input-sheet-header">
          <div>
            <UiBaseSectionIndex>INPUT</UiBaseSectionIndex>
            <h2>{{ t('single.inputTitle') }}</h2>
            <p>{{ t('single.inputIntro') }}</p>
          </div>
          <UiImageCountBadge variant="single" />
        </div>

        <UploadGenreControls
          v-model:genre="genre"
          :genre-options="genreOptions"
          :genre-label="t('upload.genreLabel')"
          :disabled="isEvaluating"
          @genre-change="onGenreChange"
        />

        <div class="input-stage">
          <UploadZone
            :title="t('upload.titleSingle')"
            :hint="t('upload.formatHint')"
            :drag-title="t('upload.dragTitle')"
            :disabled="isEvaluating"
            @files="onFilesSelected"
          />
          <UploadSinglePreview
            v-if="entry"
            :src="entry.objectURL"
            :alt="t('upload.previewAlt')"
            :file-name="entry.file.name"
            :file-size="entry.file.size"
            :exif="exifData"
            :exif-labels="exifTagLabels"
            :image-width="entry.width"
            :image-height="entry.height"
          />
        </div>

        <div class="input-actions">
          <UiBaseButton :loading="isEvaluating" @click="evaluate">
            {{ isEvaluating ? t('single.evaluating') : t('single.evaluate') }}
          </UiBaseButton>
          <UiBaseErrorMessage :message="errorMessage" />
        </div>
      </UiBaseCard>

      <!-- 流式进度（single.html L106-120） -->
      <EvaluationReviewProgress
        :active="isEvaluating"
        :text="loadingText"
        :subtext="loadingSubtext"
        :index-label="t('review.index')"
        :steps="streamSteps"
        :blocks="reasoningBlocks"
        :reasoning-suffix="t('review.reasoningSuffix')"
      />
    </div>

    <!-- 结果播报（single.html L123）：§14.5 完成只播报一次（component-plan §2.4） -->
    <BusinessEvaluationResultAnnouncer :message="announced" />

    <!-- 结果区（single.html L125-188） -->
    <section v-if="result" ref="resultRef" class="single-results">
      <EvaluationResultMasthead :title="t('result.titleSingle')" :tag="resultTag" />

      <div class="single-result-layout">
        <!-- Sticky 图片舞台（single.html L132-137）：暂内联，
             ImageStage 抽取为可选后续（SinglePreview L16-17） -->
        <aside class="single-result-stage" :aria-label="t('single.resultStageAria')">
          <div class="result-photo-frame">
            <img :src="entry?.objectURL" :alt="t('single.resultPhotoAlt')">
            <span class="result-photo-index" aria-hidden="true">REVIEWED FRAME</span>
          </div>
        </aside>

        <article class="single-result-report">
          <!-- 分数与维度（single.html L140-151） -->
          <UiBaseCard variant="plain" class="score-sheet">
            <EvaluationScorePanel
              :score="totalScore"
              :caption="t('result.scoreCaption')"
              :band-label="bandLabel"
            />
            <EvaluationDimensionList
              :dimensions="result.dimensions"
              :genre="result.genre"
              :metadata="genreMetadata"
              :aria-label="t('single.dimensionAria')"
            />
          </UiBaseCard>

          <!-- 点评三章（single.html L153-157） -->
          <UiBaseCard variant="plain" class="critique-section">
            <EvaluationCritiqueReport
              :critique="result.critique"
              :suggestions="result.suggestions"
              :arbitration-notes="result.arbitrationNotes"
              :critique-title="t('result.chapterCritique')"
              :suggestions-title="t('result.chapterSuggestions')"
              :arbitration-title="t('result.chapterArbitration')"
            />
          </UiBaseCard>

          <!-- 评估过程（single.html L159-164）：空过程不渲染容器（DESIGN §2.5） -->
          <UiBaseCard v-if="processSteps.length" variant="plain" class="report-disclosure">
            <EvaluationProcessTimeline
              :title="t('process.title')"
              :steps="processSteps"
              :genre="result.genre"
              :metadata="genreMetadata"
            />
          </UiBaseCard>

          <!-- EXIF（single.html L166-171）：无数据不渲染容器（app.js L578-581） -->
          <UiBaseCard v-if="exifData" variant="plain" class="report-disclosure">
            <EvaluationExifPanel
              :exif="exifData"
              :title="t('result.exifTitle')"
              :labels="exifPanelLabels"
            />
          </UiBaseCard>

          <!-- 元数据条 + 分享（single.html L173-185） -->
          <UiBaseCard variant="plain" class="metadata-card">
            <EvaluationMetadataStrip :items="metadataItems">
              <template #actions>
                <ShareAction
                  :phase="sharePhase"
                  :error="shareError"
                  :label="t('share.action')"
                  :loading-image-label="t('share.loadingImage')"
                  :generating-label="t('share.generating')"
                  :exporting-label="t('share.exporting')"
                  :failed-label="t('share.failed')"
                  @generate="onShareGenerate"
                />
              </template>
            </EvaluationMetadataStrip>
          </UiBaseCard>
        </article>
      </div>
    </section>

    <!-- 分享预览弹窗（single.html L191-198） -->
    <SharePreviewModal
      v-model:open="shareOpen"
      :url="sharePreviewUrl"
      :label="t('share.previewLabel')"
      :img-alt="t('share.previewImgAlt')"
      :download-label="t('share.download')"
      :cancel-label="t('share.cancel')"
      :close-aria="t('share.closeAria')"
      @download="onShareDownload"
      @close="onShareClose"
    />
  </div>
</template>

<style scoped>
/* ── 页面壳（venus style.css L581-588）── */
.evaluation-shell {
  margin: 0 auto var(--space-9);
  width: min(1280px, calc(100% - 80px));
}

.evaluation-context {
  padding-top: var(--space-8);
}

/* ── 输入卡头（style.css L606-624 .input-sheet-header / .group-intro）── */
.input-sheet-header {
  align-items: start;
  border-bottom: 1px solid var(--hairline);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  padding-bottom: var(--space-6);
}

/* style.css L615-623：§6.2 Section Display；颜色/字体/字重/text-wrap 由 main.css 全局 h1-h3 承担 */
.input-sheet-header h2 {
  font-size: clamp(30px, 3.3vw, 40px);
  letter-spacing: -0.03em;
  line-height: 1.12;
  margin-top: var(--space-3);
}

/* style.css L624 */
.input-sheet-header p {
  color: var(--ink-body);
  margin-top: var(--space-3);
  max-width: 690px;
}

/* group.css L9-11 */
.input-stage {
  min-width: 0;
}

/* style.css L727 */
.input-actions {
  align-items: center;
  display: grid;
  gap: var(--space-5);
  grid-template-columns: minmax(220px, 360px) minmax(0, 1fr);
  margin-top: var(--space-5);
}

/* ── 结果区（style.css L848-895）── */

/* style.css L852：scroll-margin-top 补偿 sticky 导航（§7.3） */
.single-results {
  padding-top: var(--space-8);
  scroll-margin-top: 88px;
}

/* style.css L875-881：§10.2 桌面 7/5 分栏 */
.single-result-layout {
  align-items: start;
  display: grid;
  gap: clamp(32px, 4vw, 64px);
  grid-template-columns: minmax(0, 7fr) minmax(430px, 5fr);
  padding-top: var(--space-6);
}

/* style.css L882 */
.single-result-stage {
  min-width: 0;
  position: sticky;
  top: 104px;
}

/* style.css L711（.image-stage 共享规则）+ L883；--on-dark 组件局部
 * （tokens.css 不含该 token，先例 UploadZone L146 / SinglePreview L95） */
.result-photo-frame {
  --on-dark: #f1ede3;

  background: var(--darkroom);
  border-radius: var(--radius-lg);
  display: grid;
  min-height: min(72vh, 820px);
  overflow: hidden;
  place-items: center;
  position: relative;
}

/* style.css L884 */
.result-photo-frame img {
  height: 100%;
  max-height: min(72vh, 820px);
  object-fit: contain;
  width: 100%;
}

/* style.css L715：帧号角标（与 SinglePreview .single-preview-index 同源） */
.result-photo-index {
  background: rgba(12, 11, 10, 0.8);
  border-radius: var(--radius-sm);
  bottom: 14px;
  color: var(--on-dark);
  font: 500 10px/1 var(--font-data);
  left: 14px;
  letter-spacing: 0.05em;
  padding: 6px 8px;
  position: absolute;
}

/* style.css L885 */
.single-result-report {
  min-width: 0;
}

/* style.css L887-895：分数 + 维度两列；分隔线归此分节声明（BaseCard L8 约定） */
.score-sheet {
  align-items: center;
  border-bottom: 1px solid var(--hairline);
  display: grid;
  gap: clamp(28px, 4vw, 56px);
  grid-template-columns: minmax(180px, 220px) minmax(0, 1fr);
  padding: 0 0 var(--space-6);
}

/* style.css L942 */
.report-disclosure {
  border-bottom: 1px solid var(--hairline);
}

/* ── 响应式（style.css L1068-1166）── */

/* style.css L1068-1075 */
@media (max-width: 1279px) {
  .single-result-layout {
    gap: 32px;
    grid-template-columns: minmax(0, 6.5fr) minmax(400px, 5.5fr);
  }

  .score-sheet {
    align-items: start;
    gap: var(--space-5);
    grid-template-columns: 1fr;
  }
}

/* style.css L1077-1099 */
@media (max-width: 1023px) {
  .evaluation-shell {
    width: calc(100% - 64px);
  }

  .single-result-layout {
    grid-template-columns: 1fr;
  }

  .single-result-stage {
    position: static;
  }

  .result-photo-frame {
    min-height: 58vh;
  }
}

/* style.css L1157 / L1163 / L1166；input-sheet-header 单列对齐
 * ImageCountBadge 移动端满宽规则（style.css L1150-1151） */
@media (max-width: 767px) {
  .input-sheet-header {
    grid-template-columns: 1fr;
  }

  .input-actions {
    gap: 12px;
    grid-template-columns: 1fr;
  }

  .single-results {
    padding-top: 48px;
  }

  .single-result-layout {
    padding-top: 24px;
  }
}
</style>
