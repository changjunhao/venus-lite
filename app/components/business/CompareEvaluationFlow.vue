<script lang="ts">
// 双 script 块编译为同一模块，导入统一收拢于此（setup 块共享模块作用域）
import type {
  GroupCompareEvaluationResult,
  ProcessStepItem,
  RankingItem,
  StreamAgent,
} from '#shared/types/evaluation'
import type { ImageEntry } from '~/composables/useImageSelection'
import type { GroupStartPayload } from '~/components/business/GroupEvaluationInput.vue'
// 编排依赖显式导入（非自动导入）：保证测试经 vi.mock('~/composables/*') 拦截的确定性
// （SingleEvaluationFlow L14-21 先例）
import { resolveGenreLabel, useEvalMetadata } from '~/composables/useEvalMetadata'
import { useEvaluationStream } from '~/composables/useEvaluationStream'
import { useOssUpload } from '~/composables/useOssUpload'
import {
  buildGroupMetadataItems,
  compareProposalContent,
  mapProcessSteps,
  type GroupMetadataItemLabels,
  type ProcessStepLabels,
} from '~/utils/evaluation-mapping'
</script>

<script setup lang="ts">
/**
 * 对比评估流程：输入 → 进度 → 结果三态编排（component-plan §2.4 L161），
 * 逐行移植 venus group-compare.html L103-173 页面结构与 group.js 状态机。
 *
 * - 输入态内聚于 GroupEvaluationInput（选片/排序/校验/门类/逐图开关），
 *   Flow 仅消费 `start` 载荷与三个失效事件——entries 在 start 时快照至
 *   seriesEntries，结果区（RankingList/FocusCompare/PerImageGrid）只读消费该快照。
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
 *   不消费 composable 内部消息（Single/Joint 同构）。
 * - 过程映射经 mapProcessSteps 第 4/5 参数传 compareProposalContent + 'compare'：
 *   compare 提案/修正 content 取 comparison_summary（group.js L989 else 分支，
 *   无 critique 回退）；徽章以排序计数替代评分（group.js L985/L1012/L1025，
 *   GroupCompareProposerResult 无 total_score）。
 * - compare 无系列综合分/维度/场景（GroupCompareEvaluationResult 形状约束，
 *   venus-core types L454-473）：不引入 ScorePanel/DimensionList/ContactSheet；
 *   门类标签仅门类不含场景（group.js L537 `isJoint ? scene : ''`）。
 * - compare 无分享、无 EXIF（group.js 请求体 L337-346 无 context）：
 *   不引入 useShareImage / useExif / useImageSelection。
 */

// ── Composables（顶层解构，模板自动解包 ref）──

const { t, locale, getLocaleMessage } = useI18n()

/**
 * i18n 原始模板读取：保留 {placeholder} 供组件内插值（RankingCard L65-68
 * .replace 先例）与 mapProcessSteps 经 fill 插值。
 * t() 会急切消费占位符（缺参时渲染为空），tm()/getLocaleMessage() 返回
 * 编译后 AST（vue-i18n v10 注册时预解析），经 loc.source 取原文。
 * （SingleEvaluationFlow/JointEvaluationFlow 同构 helper）
 */
function template(key: string): string {
  const messages = getLocaleMessage(locale.value) as Record<string, unknown>
  const value = key.split('.').reduce<unknown>((acc, part) => (acc as Record<string, unknown> | undefined)?.[part], messages)
  if (typeof value === 'string') return value
  const source = (value as { loc?: { source?: string } } | null)?.loc?.source
  return typeof source === 'string' ? source : key
}

const { upload } = useOssUpload()
const { phase: streamPhase, steps: streamSteps, reasoningBlocks, startGroup, reset: resetStream } = useEvaluationStream()
const { metadata: genreMetadata, fetch: fetchMetadata } = useEvalMetadata()

// ── 状态 ──

/** 归一化评估结果（useEvaluationStream 事件层已 camelCase 归一；null = 无结果） */
const result = shallowRef<GroupCompareEvaluationResult | null>(null)
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
/** start 时选片快照：结果区 RankingList/FocusCompare/PerImageGrid 只读消费（单向数据流） */
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

/** 门类标签（group.js L535-538：compare 无系列场景，仅门类——scene 传空串） */
const resultTag = computed(() => {
  const r = result.value
  if (!r) return ''
  return resolveGenreLabel(r.genre, genreMetadata.value)
})

/** 排名数据原始传递：排序归 RankingList/FocusCompare 内部（RankingList L7-9 契约） */
const rankingItems = computed<RankingItem[]>(() => result.value?.ranking ?? [])

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
  sortedBadge: template('process.sortedBadge'),
  resortedBadge: template('process.resortedBadge'),
  finalRankBadge: template('process.finalRankBadge'),
}))

/** 过程映射：compare content 取 comparison_summary（group.js L989 else），mode='compare' 启用排序徽章 */
const processSteps = computed<ProcessStepItem[]>(() => {
  const r = result.value
  if (!r?.process) return []
  return mapProcessSteps(
    r.process as unknown as Record<string, unknown>,
    processLabels.value,
    undefined, // compare 无场景徽章（group.js L979-986 else 分支）
    compareProposalContent,
    'compare',
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
 * 三个事件共用同一 handler——compare 无分享，无需额外重置。
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

/** 开始对比评估（group.js L323-389 evaluateGroup + L301-321 prepareImageUrls） */
async function onStart(payload: GroupStartPayload): Promise<void> {
  if (isEvaluating.value) return
  evaluationError.value = ''
  announced.value = '' // 新一轮清空播报（group.js L326）
  result.value = null
  detectedGenre.value = ''
  // 清空上一轮流式残留：startGroup 的 reset 在上传循环完成后才调用，
  // 不提前重置则上传期进度卡会渲染上一轮的 done 步骤与旧推理块
  resetStream()
  // 快照：结果区 RankingList/FocusCompare/PerImageGrid 只读消费；失效链保证快照恒有效
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
      mode: 'compare',
      genre: payload.genre !== 'auto' ? payload.genre : undefined,
      includePerImage: payload.includePerImage,
    },
    {
      onComplete: (data) => {
        result.value = data as unknown as GroupCompareEvaluationResult
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
      <!-- 输入卡（group-compare.html L49-88）：选片/排序/门类/逐图开关内聚 -->
      <BusinessGroupEvaluationInput
        variant="compare"
        :loading="isEvaluating"
        @start="onStart"
        @genre-change="invalidateResult"
        @include-per-image-change="invalidateResult"
        @selection-change="invalidateResult"
      />
      <!-- Flow 级错误（上传失败/流式错误）：输入卡内部错误由其自行展示 -->
      <UiBaseErrorMessage :message="evaluationError" />

      <!-- 流式进度（group-compare.html L90-98） -->
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

    <!-- 结果播报（group-compare.html L101）：§14.5 完成只播报一次 -->
    <BusinessEvaluationResultAnnouncer :message="announced" />

    <!-- 结果区（group-compare.html L103-173） -->
    <section v-if="result" ref="resultRef" class="group-results group-results-compare">
      <EvaluationResultMasthead :title="t('result.titleCompare')" :tag="resultTag" />

      <div class="group-result-primary">
        <!-- 排名 + 双图聚焦比较（group-compare.html L128-144） -->
        <UiBaseCard variant="plain" class="comparison-report">
          <UiCardHeading :eyebrow="t('groupCompare.rankingEyebrow')">
            {{ t('groupCompare.rankingHeading') }}
          </UiCardHeading>
          <EvaluationRankingList
            :items="rankingItems"
            :entries="seriesEntries"
            :winner-title="t('groupCompare.winnerTitle')"
            :rank-title-template="template('groupCompare.rankTitleTemplate')"
            :photo-label-template="template('groupCompare.photoLabelTemplate')"
            :missing-text="t('groupCompare.missingText')"
            :alt-template="template('groupCompare.rankingAltTemplate')"
          />
          <!-- 沉浸模式原位提升：祖先不得有 transform/filter（FocusCompare L27-28 约束） -->
          <EvaluationFocusCompare
            :items="rankingItems"
            :entries="seriesEntries"
            :eyebrow="t('focusCompare.eyebrow')"
            :title="t('focusCompare.title')"
            :intro="t('focusCompare.intro')"
            :left-label="t('focusCompare.leftLabel')"
            :right-label="t('focusCompare.rightLabel')"
            :option-template="template('focusCompare.optionTemplate')"
            :close-text="t('focusCompare.closeText')"
            :close-aria="t('focusCompare.closeAria')"
            :rationale-label="t('focusCompare.rationaleLabel')"
            :rationale-fallback="t('focusCompare.rationaleFallback')"
            :delta-heading-label="t('focusCompare.deltaHeading')"
            :delta-bars-aria-label="t('focusCompare.deltaBarsAria')"
            :delta-left-bar-template="template('focusCompare.deltaLeftBar')"
            :delta-right-bar-template="template('focusCompare.deltaRightBar')"
            :delta-footnote="t('focusCompare.deltaNote')"
          />
        </UiBaseCard>

        <!-- 对比总结（group-compare.html L146-149） -->
        <EvaluationSummaryCard
          :content="result.comparisonSummary"
          variant="comparison"
          :title="t('groupCompare.summaryTitle')"
        />
      </div>

      <!-- 逐图明细（group-compare.html L152-154）：空/未开启时整区不渲染（group.js L854） -->
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

      <!-- 点评两章（group-compare.html L156-160）：compare 无 CRITIQUE 章 -->
      <UiBaseCard variant="plain" class="group-critique-section">
        <EvaluationCritiqueReport
          :show-critique="false"
          :suggestions="result.suggestions"
          :arbitration-notes="result.arbitrationNotes"
          :suggestions-title="t('result.chapterSuggestions')"
          :arbitration-title="t('result.chapterArbitration')"
          :scene-type-ruling-label="t('result.arbitration.sceneTypeRuling')"
          :decisions-label="t('result.arbitration.decisions')"
          :final-rationale-label="t('result.arbitration.finalRationale')"
          :decision-accept-label="t('result.arbitration.accept')"
          :decision-partial-label="t('result.arbitration.partial')"
          :decision-reject-label="t('result.arbitration.reject')"
          :decision-consensus-label="t('result.arbitration.consensus')"
        />
      </UiBaseCard>

      <!-- 评估过程（group-compare.html L162-165）：空过程不渲染容器（DESIGN §2.5） -->
      <UiBaseCard v-if="processSteps.length" variant="plain" class="report-disclosure">
        <EvaluationProcessTimeline
          :title="t('process.title')"
          :steps="processSteps"
          :genre="result.genre"
          :metadata="genreMetadata"
        />
      </UiBaseCard>

      <!-- 元数据条 4 项（group-compare.html L167-172）：组图无分享，不用 actions slot -->
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

/* ── 结果区（group-compare.html L103）── */

/* scroll-margin-top 补偿 sticky 导航（§7.3，single-results L852 先例） */
.group-results {
  padding-top: var(--space-8);
  scroll-margin-top: 88px;
}

/* style.css L997 */
.group-result-primary {
  padding-top: var(--space-6);
}

/* ── compare 排名卡（group-compare.html L128 .comparison-report）── */

/* group.css L23-29：min-width 0 防 grid/长文本溢出 */
.comparison-report {
  min-width: 0;
}

/* group.css L124-126：标题与排名列表间距（:deep 因 CardHeading scoped） */
.comparison-report :deep(.card-heading) {
  margin-bottom: var(--space-4);
}

/* group.css L128-130：compare 上下文 SummaryCard 间距（SummaryCard L23 注释归 Flow 编排） */
.group-results-compare :deep(.group-summary-card) {
  margin-top: var(--space-7);
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
}

/* style.css L1146 / L1163 */
@media (max-width: 767px) {
  .evaluation-shell {
    margin-bottom: 64px;
    width: calc(100% - 40px);
  }

  .group-results {
    padding-top: 48px;
  }
}
</style>
