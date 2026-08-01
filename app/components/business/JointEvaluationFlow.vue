<script lang="ts">
// 双 script 块编译为同一模块，导入统一收拢于此（setup 块共享模块作用域）
import type {
  GroupJointEvaluationResult,
  ProcessStepItem,
  StreamAgent,
} from '#shared/types/evaluation'
import type { ImageEntry } from '~/composables/useImageSelection'
import type { GroupStartPayload } from '~/components/business/GroupEvaluationInput.vue'
import { formatGenreSceneTag, getScoreBand } from '#shared/utils/format'
// 编排依赖显式导入（非自动导入）：保证测试经 vi.mock('~/composables/*') 拦截的确定性
// （SingleEvaluationFlow L14-21 先例）
import { resolveGenreLabel, resolveSceneLabel, useEvalMetadata } from '~/composables/useEvalMetadata'
import { useEvaluationStream } from '~/composables/useEvaluationStream'
import { useOssUpload } from '~/composables/useOssUpload'
import {
  buildGroupMetadataItems,
  jointProposalContent,
  mapProcessSteps,
  type GroupMetadataItemLabels,
  type ProcessStepLabels,
} from '~/utils/evaluation-mapping'
</script>

<script setup lang="ts">
/**
 * 联合评估流程：输入 → 进度 → 结果三态编排（component-plan §2.4 L160），
 * 逐行移植 venus group-joint.html L49-162 页面结构与 group.js 状态机。
 *
 * - 输入态内聚于 GroupEvaluationInput（选片/排序/校验/门类/逐图开关），
 *   Flow 仅消费 `start` 载荷与三个失效事件——entries 在 start 时快照至
 *   seriesEntries，结果区（ContactSheet/PerImageGrid）只读消费该快照。
 *   不变量：四个失效事件（genre/includePerImage/selection 增删排序清空）
 *   全部清空 result（group.js L199/209/220/227/1083-1087），故 result
 *   存在期间快照恒为评估时集合，objectURL 永不悬空。
 * - 上传采用 for 循环 + upload() 逐张串行（不用 uploadMultiple）：
 *   ① 源 group.js L310-314 首失败即 throw（uploadMultiple 单张失败不中断
 *   批次，语义偏离）；② 源 L305-307 先置进度文案再上传（uploadMultiple
 *   onProgress 在完成后触发，无法贴源）。此为有意取舍。
 * - isEvaluating 有意偏离 Single 公式（Single L351 `ossUploading || streaming`）：
 *   upload() 每张 finally 置 uploading=false（useOssUpload L268），多图间隙
 *   会瞬时解锁按钮；以 preparing ref 覆盖全循环（group.js setLoading 全程
 *   锁定语义 L1034-1042），startGroup 同步前缀置 phase='streaming'
 *   （useEvaluationStream L432）保证无缝衔接，同一微任务内无渲染间隙。
 * - 进度文案（§15.4）派生自 phase + steps active 项 + uploadCursor，
 *   不消费 composable 内部消息（Single 同构）。
 * - 过程映射经 mapProcessSteps 第 4 参数传 jointProposalContent：
 *   joint 提案/修正 content 取 group_analysis || critique（group.js L989/L1015）。
 * - joint 无分享、无 EXIF（group.js 请求体 L337-346 无 context）：
 *   不引入 useShareImage / useExif / useImageSelection。
 */

// ── Composables（顶层解构，模板自动解包 ref）──

const { t, locale, getLocaleMessage } = useI18n()

/**
 * i18n 原始模板读取：保留 {placeholder} 供 mapProcessSteps 经 fill 插值。
 * t() 会急切消费占位符（缺参时渲染为空），tm()/getLocaleMessage() 返回
 * 编译后 AST（vue-i18n v10 注册时预解析），经 loc.source 取原文。
 * （SingleEvaluationFlow 同构 helper）
 */
function template(key: string): string {
  const messages = getLocaleMessage(locale.value) as Record<string, unknown>
  const value = key.split('.').reduce<unknown>((acc, part) => (acc as Record<string, unknown> | undefined)?.[part], messages)
  if (typeof value === 'string') return value
  const source = (value as { loc?: { source?: string } } | null)?.loc?.source
  return typeof source === 'string' ? source : key
}

const { upload } = useOssUpload()
const { phase: streamPhase, steps: streamSteps, reasoningBlocks, startGroup } = useEvaluationStream()
const { metadata: genreMetadata, fetch: fetchMetadata } = useEvalMetadata()

// ── 状态 ──

/** 归一化评估结果（useEvaluationStream 事件层已 camelCase 归一；null = 无结果） */
const result = shallowRef<GroupJointEvaluationResult | null>(null)
/** 评估流程错误（上传失败与流式错误共用同一 alert） */
const evaluationError = ref('')
/** §14.5 结果播报（完成只播报一次） */
const announced = ref('')
/** 流式识别出的门类（genre_detected 事件，进度文案用） */
const detectedGenre = shallowRef('')
/** 结果区滚动锚点（group.js L571 scrollIntoView） */
const resultRef = useTemplateRef<HTMLElement>('resultRef')
/** 整批上传循环进行中（flicker 防护：覆盖 upload() 逐张 uploading 间隙） */
const preparing = ref(false)
/** 逐张上传进度游标（group.js L305 `第 ${index+1}/${total} 张`） */
const uploadCursor = shallowRef({ index: 0, count: 0 })
/** start 时选片快照：结果区 ContactSheet/PerImageGrid 只读消费（单向数据流） */
const seriesEntries = shallowRef<ImageEntry[]>([])

// ── 派生：流程状态 ──

/**
 * 评估进行中：上传循环或 SSE 流未结束（group.js isLoading 语义 L1034-1042）。
 * 有意偏离 Single 公式——见文件头注释 preparing 说明。
 */
const isEvaluating = computed(() => preparing.value || streamPhase.value === 'streaming')

// ── 派生：进度文案（§15.4，派生自 phase + steps active 项 + uploadCursor）──

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
  // 上传阶段：逐张索引文案（group.js L305-307）
  if (preparing.value) return t('review.uploadingGroupPhoto', uploadCursor.value)
  if (streamPhase.value !== 'streaming') return t('review.preparing')
  const active = activeStep.value
  if (active) return t('review.stepActive', { step: active.label })
  // 上传完成、流已建立但尚无步骤（group.js L335 主文案）
  if (streamSteps.value.length === 0) return t('review.starting')
  if (genreDetectorDone.value && detectedGenre.value) {
    return t('review.genreDetected', { genre: resolveGenreLabel(detectedGenre.value, genreMetadata.value) })
  }
  return t('review.evaluating')
})

const loadingSubtext = computed(() => {
  // 上传阶段：当前文件名副文案（group.js L307 setLoadingText 第二参数）
  if (preparing.value) return seriesEntries.value[uploadCursor.value.index - 1]?.file.name ?? ''
  if (streamPhase.value !== 'streaming') return t('review.preparingSub')
  if (activeStep.value) return agentHints.value[activeStep.value.agent]
  // 上传完成、尚无步骤：N 张照片已准备完成（group.js L335 副文案）
  if (streamSteps.value.length === 0) return t('review.groupPhotosReady', { count: seriesEntries.value.length })
  // done 态（门类识别完成、等待下一 agent）无副文案（app.js L498 先例）
  if (genreDetectorDone.value && detectedGenre.value) return ''
  return t('review.evaluatingSub')
})

/** 步骤轨道标签（useEvaluationStream.startGroup labels 参数约定） */
const stepLabels = computed<Record<StreamAgent, string>>(() => ({
  genreDetector: t('review.stepGenreDetector'),
  proposer: t('review.stepProposer'),
  critic: t('review.stepCritic'),
  'proposer-revision': t('review.stepProposerRevision'),
  arbiter: t('review.stepArbiter'),
}))

// ── 派生：结果区 ──

/** 系列综合分数（NaN 防御 → 0，group.js L542） */
const totalScore = computed(() => {
  const n = Number(result.value?.totalScore)
  return Number.isFinite(n) ? n : 0
})

/** §5.4 区间文字标签（band key → result.band* 键，单一来源 getScoreBand） */
const bandLabel = computed(() => {
  const key = getScoreBand(totalScore.value).key
  return t(`result.band${key.charAt(0).toUpperCase()}${key.slice(1)}`)
})

/** 门类·场景合并标签（group.js L535-538：joint 含场景，子类型未命中回退「未分类」） */
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

/** 过程映射：joint content 取 group_analysis || critique（group.js L989/L1015） */
const processSteps = computed<ProcessStepItem[]>(() => {
  const r = result.value
  if (!r?.process) return []
  return mapProcessSteps(
    r.process as unknown as Record<string, unknown>,
    processLabels.value,
    sceneType => resolveSceneLabel(sceneType, r.genre, genreMetadata.value),
    jointProposalContent,
  )
})

const metaLabels = computed<GroupMetadataItemLabels>(() => ({
  images: t('result.meta.images'),
  duration: t('result.meta.duration'),
  rounds: t('result.meta.rounds'),
  time: t('result.meta.time'),
}))

/** 元数据条 4 项（group.js L563-567）：imageCount 回退快照长度 */
const metadataItems = computed(() =>
  buildGroupMetadataItems(
    result.value?.metadata as unknown as Record<string, unknown> | null,
    seriesEntries.value.length,
    metaLabels.value,
    locale.value,
  ),
)

/** 逐图明细（§9.14：缺失或为空时整个区域不渲染——v-if 守卫归 Flow，PerImageGrid L15-17 契约） */
const perImageItems = computed(() => result.value?.perImage ?? [])

// ── 动作 ──

// 门类元数据（group.js DOMContentLoaded 拉取；useState 缓存幂等）
onMounted(() => {
  void fetchMetadata()
})

/**
 * 门类/逐图开关/选片变更使旧结果失效（group.js L117-121 invalidateResult；
 * L1083-1087 genre/includePerImage 接线；L199/209/220/227 selection 接线）。
 * 三个事件共用同一 handler——joint 无分享，无需额外重置。
 */
function invalidateResult(): void {
  if (result.value) {
    result.value = null
  }
}

/** 结果区滚动（group.js L571；§12.5 reduced-motion 降级为 auto） */
function scrollToResult(): void {
  nextTick(() => {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    resultRef.value?.scrollIntoView({ behavior, block: 'start' })
  })
}

/** 开始联合评估（group.js L323-389 evaluateGroup + L301-321 prepareImageUrls） */
async function onStart(payload: GroupStartPayload): Promise<void> {
  if (isEvaluating.value) return
  evaluationError.value = ''
  announced.value = '' // 新一轮清空播报（group.js L326）
  result.value = null
  detectedGenre.value = ''
  // 快照：结果区 ContactSheet/PerImageGrid 只读消费；失效链保证快照恒有效
  seriesEntries.value = payload.entries

  // ① 照片准备：逐张串行上传（group.js prepareImageUrls L301-321）
  preparing.value = true
  uploadCursor.value = { index: 1, count: payload.entries.length }
  let imageUrls: string[]
  try {
    imageUrls = []
    for (const [i, entry] of payload.entries.entries()) {
      // 先置进度文案再上传（group.js L305-307）
      uploadCursor.value = { index: i + 1, count: payload.entries.length }
      // data URL 回退已在 composable 内处理（useOssUpload L221-227）
      imageUrls.push((await upload(entry.file)).url)
    }
  }
  catch {
    // 首失败即止（group.js L310-314）：带索引错误消息
    evaluationError.value = t('review.groupUploadFailed', uploadCursor.value)
    return
  }
  finally {
    // startGroup 同步前缀置 phase='streaming'（useEvaluationStream L432），
    // 与 preparing=false 在同一微任务内完成，无渲染间隙
    preparing.value = false
  }

  // ② SSE 流式评估（事件分发与 camelCase 归一由 useEvaluationStream 承担）
  await startGroup(
    {
      imageUrls,
      mode: 'joint',
      genre: payload.genre !== 'auto' ? payload.genre : undefined,
      includePerImage: payload.includePerImage,
    },
    {
      onComplete: (data) => {
        result.value = data as unknown as GroupJointEvaluationResult
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
</script>

<template>
  <div class="evaluation-shell group-shell">
    <div class="evaluation-context">
      <!-- 输入卡（group-joint.html L49-88）：选片/排序/门类/逐图开关内聚 -->
      <BusinessGroupEvaluationInput
        variant="joint"
        :loading="isEvaluating"
        @start="onStart"
        @genre-change="invalidateResult"
        @include-per-image-change="invalidateResult"
        @selection-change="invalidateResult"
      />
      <!-- Flow 级错误（上传失败/流式错误）：输入卡内部错误由其自行展示 -->
      <UiBaseErrorMessage :message="evaluationError" />

      <!-- 流式进度（group-joint.html L90-98） -->
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

    <!-- 结果播报（group-joint.html L101）：§14.5 完成只播报一次 -->
    <BusinessEvaluationResultAnnouncer :message="announced" />

    <!-- 结果区（group-joint.html L103-162） -->
    <section v-if="result" ref="resultRef" class="group-results group-results-joint">
      <EvaluationResultMasthead :title="t('result.titleJoint')" :tag="resultTag" />

      <div class="group-result-primary">
        <div class="joint-result-layout">
          <!-- 暗色 Sticky 接触印样列（group-joint.html L109-112） -->
          <aside class="joint-contact-column">
            <UiCardHeading eyebrow="SERIES / CONTACT SHEET">
              {{ t('groupJoint.contactHeading') }}
            </UiCardHeading>
            <!-- eslint-disable vue/attribute-hyphenation —— vue-tsc 将 :aria-label 视为
                 HTML 属性而非 ariaLabel prop，camelCase 绑定为 HomeHero L79 先例 -->
            <EvaluationContactSheet
              :entries="seriesEntries"
              :alt-template="t('result.contactPhotoAlt', { index: '{index}' })"
              :ariaLabel="t('result.contactSheetAria')"
            />
            <!-- eslint-enable vue/attribute-hyphenation -->
          </aside>

          <!-- 报告列：分数 + 维度 + 系列整体分析（group-joint.html L113-131） -->
          <div class="joint-report-column">
            <UiBaseCard variant="plain" class="joint-score-card">
              <EvaluationScorePanel
                :score="totalScore"
                :caption="t('result.scoreCaptionJoint')"
                :band-label="bandLabel"
              />
              <EvaluationDimensionList
                :dimensions="result.dimensions"
                :genre="result.genre"
                :metadata="genreMetadata"
                :aria-label="t('groupJoint.dimensionAria')"
              />
            </UiBaseCard>

            <EvaluationSummaryCard
              :content="result.groupAnalysis"
              variant="series"
              :title="t('groupJoint.summaryTitle')"
            />
          </div>
        </div>
      </div>

      <!-- 逐图明细（group-joint.html L141-143）：空/未开启时整区不渲染（group.js L854） -->
      <UiBaseCard v-if="perImageItems.length" variant="plain" class="per-image-section">
        <UiCardHeading :eyebrow="t('result.perImageEyebrow')">
          {{ t('result.perImageHeading') }}
        </UiCardHeading>
        <EvaluationPerImageGrid
          :items="perImageItems"
          :entries="seriesEntries"
          :alt-template="t('result.perImageAlt', { index: '{index}' })"
          :fallback-name-template="t('result.perImageFallbackName', { index: '{index}' })"
        />
      </UiBaseCard>

      <!-- 点评三章（group-joint.html L145-149） -->
      <UiBaseCard variant="plain" class="group-critique-section">
        <EvaluationCritiqueReport
          :critique="result.critique"
          :suggestions="result.suggestions"
          :arbitration-notes="result.arbitrationNotes"
          :critique-title="t('result.chapterCritique')"
          :suggestions-title="t('result.chapterSuggestions')"
          :arbitration-title="t('result.chapterArbitration')"
        />
      </UiBaseCard>

      <!-- 评估过程（group-joint.html L151-154）：空过程不渲染容器（DESIGN §2.5） -->
      <UiBaseCard v-if="processSteps.length" variant="plain" class="report-disclosure">
        <EvaluationProcessTimeline
          :title="t('process.title')"
          :steps="processSteps"
          :genre="result.genre"
          :metadata="genreMetadata"
        />
      </UiBaseCard>

      <!-- 元数据条 4 项（group-joint.html L156-161）：组图无分享，不用 actions slot -->
      <UiBaseCard variant="plain" class="group-metadata-card">
        <EvaluationMetadataStrip :items="metadataItems" />
      </UiBaseCard>
    </section>
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

/* ── 结果区（group-joint.html L103）── */

/* scroll-margin-top 补偿 sticky 导航（§7.3，single-results L852 先例） */
.group-results {
  padding-top: var(--space-8);
  scroll-margin-top: 88px;
}

/* style.css L997 */
.group-result-primary {
  padding-top: var(--space-6);
}

/* ── joint 双列布局（style.css L998-1002）── */

.joint-result-layout {
  align-items: start;
  display: grid;
  gap: clamp(32px, 5vw, 64px);
  grid-template-columns: minmax(300px, 4.5fr) minmax(520px, 7.5fr);
}

/* style.css L999；--on-dark 组件局部（tokens.css 不含该 token，
 * SingleEvaluationFlow .result-photo-frame / UploadZone 先例） */
.joint-contact-column {
  --on-dark: #f1ede3;

  background: var(--darkroom);
  border-radius: var(--radius-lg);
  color: var(--on-dark);
  min-width: 0;
  padding: var(--space-5);
  position: sticky;
  top: 104px;
}

/* style.css L1001-1002：暗色列 CardHeading 覆盖（:deep 因 CardHeading scoped） */
.joint-contact-column :deep(.card-heading) {
  border-color: #3d3832;
}

.joint-contact-column :deep(.card-heading h3) {
  color: var(--on-dark);
}

/* style.css L1000 */
.joint-report-column {
  align-content: start;
  display: grid;
  gap: var(--space-6);
  min-width: 0;
}

/* style.css L1011 .joint-result .joint-score-card：分数 + 维度两列 */
.joint-score-card {
  align-items: center;
  background: var(--paper-raised);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-md);
  display: grid;
  gap: clamp(28px, 4vw, 56px);
  grid-template-columns: 200px minmax(0, 1fr);
  padding: var(--space-5);
}

/* ── 全宽段（style.css L1032 / L1041-1043）── */

/* style.css L1032 */
.per-image-section {
  border-top: 1px solid var(--hairline-strong);
  margin-top: var(--space-8);
  padding-top: var(--space-6);
}

/* style.css L1041 */
.group-critique-section {
  margin-top: var(--space-8);
  width: min(760px, 100%);
}

/* style.css L1042-1043 */
.report-disclosure,
.group-metadata-card {
  width: min(900px, 100%);
}

/* style.css L942（Single .report-disclosure 同源） */
.report-disclosure {
  border-bottom: 1px solid var(--hairline);
}

/* ── 响应式（style.css L1094-1101 / L1146-1171）── */

/* style.css L1100-1101 */
@media (max-width: 1023px) {
  .evaluation-shell {
    width: calc(100% - 64px);
  }

  .joint-result-layout {
    grid-template-columns: 1fr;
  }

  .joint-contact-column {
    max-width: 760px;
    position: static;
  }
}

/* style.css L1146 / L1163 / L1168-1171 */
@media (max-width: 767px) {
  .evaluation-shell {
    margin-bottom: 64px;
    width: calc(100% - 40px);
  }

  .group-results {
    padding-top: 48px;
  }

  .joint-score-card {
    align-items: start;
    gap: 24px;
    grid-template-columns: 1fr;
    padding: 24px;
  }

  .joint-contact-column {
    padding: 20px;
  }
}
</style>
