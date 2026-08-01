/**
 * 评估结果 → UI 模型映射纯函数（Single/Joint/Compare 三 Flow 共享单一来源）。
 *
 * 原位于 SingleEvaluationFlow.vue <script> 块（L1-239），Joint 复用时抽取
 * （component-plan §2.4「复用时抽取」原则）；Compare 将消费
 * resolveProposalContent 的 comparison_summary 分支（group.js L989/L1015）。
 *
 * 全部为零 Vue 依赖的纯函数：
 * - process 归一（AgentCallResult unwrap + snake_case 双读，app.js L663-766 / group.js L972-1031）
 * - 元数据条组装（app.js L558-562 / group.js L563-567）
 */
import type {
  ChallengeItem,
  ProcessBadgeVariant,
  ProcessStepBadge,
  ProcessStepItem,
} from '#shared/types/evaluation'
import { formatDateTime, formatDuration } from '#shared/utils/format'

/**
 * 简单占位符插值：fill('评分：{score}', { score: '8.5' }) → '评分：8.5'。
 * 未知占位符原样保留；供导出纯函数使用（组件内 i18n 场景直接用 t(key, params)）。
 */
export function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  )
}

/**
 * 批判严重程度 → BaseBadge variant（app.js L696 `severity || 'LOW'` 兜底；
 * severity 大写枚举 → 小写 variant 的转换归 Flow 映射层——ProcessStep L13-14 约定）。
 */
export function severityVariant(severity: unknown): ProcessBadgeVariant {
  const s = String(severity || 'LOW').toLowerCase()
  if (s === 'medium') return 'severity-medium'
  if (s === 'high') return 'severity-high'
  return 'severity-low'
}

/** 未知值收窄为普通对象记录（null / 数组 / 原始类型 → null） */
export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

/**
 * 解包 AgentCallResult：{ result, reasoning } → result（app.js L669-671 unwrap）。
 * reasoning 从外层 wrapper 读取（app.js L688 process.proposal?.reasoning）；
 * wrapper.result 缺失时回退 wrapper 本身（app.js `data?.result || data`）。
 */
export function unwrapAgentCall(data: unknown): { result: Record<string, unknown> | null, reasoning: string } {
  const wrapper = asRecord(data)
  if (!wrapper) return { result: null, reasoning: '' }
  const reasoning = typeof wrapper.reasoning === 'string' ? wrapper.reasoning : ''
  return { result: asRecord(wrapper.result) ?? wrapper, reasoning }
}

/** 分数读取：total_score ?? totalScore → toFixed(1)；null/非有限值 → '-'（app.js L684/730/749） */
export function formatStepScore(record: Record<string, unknown>): string {
  const raw = record.total_score ?? record.totalScore
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) ? n.toFixed(1) : '-'
}

/**
 * 质疑项归一（app.js L708-714）：snake_case/camelCase 双读；
 * suggestedScore 非有限值 → null（group.js L952-954 健壮版，ChallengeItem 契约）。
 */
export function normalizeChallenges(raw: unknown): ChallengeItem[] {
  if (!Array.isArray(raw)) return []
  const items: ChallengeItem[] = []
  for (const entry of raw) {
    const c = asRecord(entry)
    if (!c) continue
    const suggested = c.suggested_score ?? c.suggestedScore
    items.push({
      dimension: String(c.dimension ?? ''),
      issue: String(c.issue ?? ''),
      evidence: String(c.evidence ?? ''),
      suggestedScore: typeof suggested === 'number' && Number.isFinite(suggested) ? suggested : null,
    })
  }
  return items
}

/** mapProcessSteps 的预解析标签袋（Flow 以 t() 解析 process.* / review.step* / agent 短名键后传入） */
export interface ProcessStepLabels {
  stepProposal: string
  stepCritique: string
  stepRevision: string
  stepArbitration: string
  scoreBadge: string
  sceneBadge: string
  severityBadge: string
  severityLow: string
  severityMedium: string
  severityHigh: string
  suggestedBadge: string
  revisedBadge: string
  finalBadge: string
  reasoningToggle: string
  agentProposer: string
  agentCritic: string
  agentRevision: string
  agentArbiter: string
  /** compare 专用：提案排序徽章模板（group.js L985「已排序 {count} 张照片」） */
  sortedBadge?: string
  /** compare 专用：修正重排徽章模板（group.js L1012「已重新排序 {count} 张照片」） */
  resortedBadge?: string
  /** compare 专用：仲裁终排徽章模板（group.js L1025「最终排序 {count} 张照片」） */
  finalRankBadge?: string
}

/**
 * 评估过程映射（app.js renderProcess L663-766 / group.js L972-1031 → ProcessStepItem[]）。
 *
 * - 四步按 proposal → critique → revision（条件）→ arbitration 顺序组装；
 * - reasoning/reasoningToggle 双条件满足时渲染（ProcessStep L59-67 守卫契约）；
 * - 场景徽章经 resolveScene 解析门类子类型标签，未传时原样输出 sceneType
 *   （app.js L677 genreInfo.subtypes 查找的接缝参数化）；
 * - resolveProposalContent 参数化 proposal/revision 的 content 取值：
 *   single 默认 `critique`（app.js L684）；joint 传 jointProposalContent
 *   取 `group_analysis || critique`（group.js L989/L1015）；
 *   compare 传 compareProposalContent 取 `comparison_summary`（group.js L989 else 分支）；
 * - mode 参数化徽章策略（group.js L979-986/L1010-1012/L1022-1025 的 mode 分支）：
 *   compare 时 proposal/revision/arbitration 以排序计数徽章替代评分徽章
 *   （GroupCompareProposerResult 无 total_score，venus-core types L401-406）；
 *   默认（joint/single）路径不变——第 5 参数可选，既有调用方零感知。
 */
export function mapProcessSteps(
  process: Record<string, unknown>,
  labels: ProcessStepLabels,
  resolveScene?: (sceneType: string) => string,
  resolveProposalContent?: (proposal: Record<string, unknown>) => string,
  mode?: 'joint' | 'compare',
): ProcessStepItem[] {
  const steps: ProcessStepItem[] = []

  // 提案者初评（app.js L674-691）
  const proposalCall = unwrapAgentCall(process.proposal)
  if (proposalCall.result) {
    const proposal = proposalCall.result
    const badges: ProcessStepBadge[] = []
    if (mode === 'compare') {
      // compare：排序计数徽章（group.js L985，createBadge 默认 step-score L901）
      if (labels.sortedBadge) {
        badges.push({ variant: 'step-score', text: fill(labels.sortedBadge, { count: rankingCount(proposal) }) })
      }
    }
    else {
      // joint/single：评分 + 场景徽章（app.js L684-689 / group.js L979-983）
      badges.push({ variant: 'step-score', text: fill(labels.scoreBadge, { score: formatStepScore(proposal) }) })
      const sceneType = String(proposal.scene_type ?? proposal.sceneType ?? '')
      const sceneName = sceneType ? (resolveScene ? resolveScene(sceneType) : sceneType) : ''
      if (sceneName) {
        badges.push({ variant: 'step-tag', text: fill(labels.sceneBadge, { scene: sceneName }) })
      }
    }
    steps.push({
      kind: 'proposal',
      title: labels.stepProposal,
      badges,
      content: resolveProposalContent ? resolveProposalContent(proposal) : String(proposal.critique ?? ''),
      reasoning: proposalCall.reasoning || null,
      reasoningToggle: fill(labels.reasoningToggle, { agent: labels.agentProposer }),
    })
  }

  // 批判者质疑（app.js L694-719）
  const critiqueCall = unwrapAgentCall(process.critique)
  if (critiqueCall.result) {
    const critique = critiqueCall.result
    const severity = critique.severity ?? 'LOW'
    const level = severity === 'MEDIUM'
      ? labels.severityMedium
      : severity === 'HIGH'
        ? labels.severityHigh
        : labels.severityLow
    const badges: ProcessStepBadge[] = [
      { variant: severityVariant(severity), text: fill(labels.severityBadge, { level }) },
    ]
    const suggested = critique.suggested_total_score ?? critique.suggestedTotalScore
    if (typeof suggested === 'number' && Number.isFinite(suggested)) {
      badges.push({ variant: 'step-score', text: fill(labels.suggestedBadge, { score: suggested.toFixed(1) }) })
    }
    steps.push({
      kind: 'critique',
      title: labels.stepCritique,
      badges,
      content: String(critique.overall_assessment ?? critique.overallAssessment ?? ''),
      challenges: normalizeChallenges(critique.challenges),
      reasoning: critiqueCall.reasoning || null,
      reasoningToggle: fill(labels.reasoningToggle, { agent: labels.agentCritic }),
    })
  }

  // 提案者修正——条件步骤，仅在发生时出现（app.js L722-736，DESIGN §9.9）
  const revisionCall = unwrapAgentCall(process.revision)
  if (revisionCall.result) {
    const badges: ProcessStepBadge[] = []
    if (mode === 'compare') {
      // compare：重排徽章（group.js L1012；GroupCompareProposerResult 无 total_score → 无 revisedBadge）
      if (labels.resortedBadge) {
        badges.push({ variant: 'step-score', text: fill(labels.resortedBadge, { count: rankingCount(revisionCall.result) }) })
      }
    }
    else {
      badges.push({ variant: 'step-score', text: fill(labels.revisedBadge, { score: formatStepScore(revisionCall.result) }) })
    }
    steps.push({
      kind: 'revision',
      title: labels.stepRevision,
      badges,
      content: resolveProposalContent ? resolveProposalContent(revisionCall.result) : String(revisionCall.result.critique ?? ''),
      reasoning: revisionCall.reasoning || null,
      reasoningToggle: fill(labels.reasoningToggle, { agent: labels.agentRevision }),
    })
  }

  // 仲裁者裁决（app.js L739-755）
  const arbitrationCall = unwrapAgentCall(process.arbitration)
  if (arbitrationCall.result) {
    const arbitration = arbitrationCall.result
    const badges: ProcessStepBadge[] = []
    if (mode === 'compare') {
      // compare：终排徽章（group.js L1025；GroupCompareArbitrationResult 无 total_score → 无 finalBadge）
      if (labels.finalRankBadge) {
        badges.push({ variant: 'step-score', text: fill(labels.finalRankBadge, { count: rankingCount(arbitration) }) })
      }
    }
    else {
      badges.push({ variant: 'step-score', text: fill(labels.finalBadge, { score: formatStepScore(arbitration) }) })
    }
    steps.push({
      kind: 'arbitration',
      title: labels.stepArbitration,
      badges,
      content: String(arbitration.arbitration_notes ?? arbitration.arbitrationNotes ?? ''),
      reasoning: arbitrationCall.reasoning || null,
      reasoningToggle: fill(labels.reasoningToggle, { agent: labels.agentArbiter }),
    })
  }

  return steps
}

/** joint 提案/修正内容：group_analysis 优先，回退 critique（group.js L989/L1015） */
export function jointProposalContent(p: Record<string, unknown>): string {
  return String(p.group_analysis ?? p.groupAnalysis ?? p.critique ?? '')
}

/** compare 提案/修正内容：comparison_summary（group.js L989 else 分支，无 critique 回退） */
export function compareProposalContent(p: Record<string, unknown>): string {
  return String(p.comparison_summary ?? p.comparisonSummary ?? '')
}

/** compare ranking 数组长度（group.js L985/L1012/L1025 `proposal.ranking?.length || 0`） */
function rankingCount(record: Record<string, unknown>): number {
  return Array.isArray(record.ranking) ? record.ranking.length : 0
}

/** buildSingleMetadataItems 的预解析标签袋（result.meta.* 键） */
export interface MetadataItemLabels {
  duration: string
  rounds: string
  time: string
}

/**
 * 单图元数据条 3 项（app.js L558-562）：耗时 / 轮次 / 时间。
 * durationMs 双读 + NaN 防御归 0；rounds 缺失回退 '-'（app.js L561）。
 */
export function buildSingleMetadataItems(
  meta: Record<string, unknown> | null | undefined,
  labels: MetadataItemLabels,
  locale: string,
): Array<{ label: string, value: string }> {
  const rawDuration = meta?.durationMs ?? meta?.duration_ms ?? 0
  const duration = typeof rawDuration === 'number' && Number.isFinite(rawDuration) ? rawDuration : 0
  const rawRounds = meta?.rounds
  const rounds = rawRounds != null && rawRounds !== '' ? String(rawRounds) : '-'
  const evaluatedAt = String(meta?.evaluatedAt ?? meta?.evaluated_at ?? new Date().toISOString())
  return [
    { label: labels.duration, value: formatDuration(duration, locale) },
    { label: labels.rounds, value: rounds },
    { label: labels.time, value: formatDateTime(evaluatedAt, locale) },
  ]
}

/** buildGroupMetadataItems 的预解析标签袋（result.meta.* 键，比单图多 images 首项） */
export interface GroupMetadataItemLabels {
  images: string
  duration: string
  rounds: string
  time: string
}

/**
 * 组图元数据条 4 项（group.js L563-567）：照片数量 / 耗时 / 轮次 / 时间。
 * imageCount 双读 + 回退 entries 数（group.js L564 `meta.imageCount ?? meta.image_count ?? state.files.length`）；
 * duration NaN 防御归 0；rounds 缺失回退 '-'（group.js L566）。
 */
export function buildGroupMetadataItems(
  meta: Record<string, unknown> | null | undefined,
  fallbackImageCount: number,
  labels: GroupMetadataItemLabels,
  locale: string,
): Array<{ label: string, value: string }> {
  const rawCount = meta?.imageCount ?? meta?.image_count ?? fallbackImageCount
  const count = typeof rawCount === 'number' && Number.isFinite(rawCount) ? rawCount : fallbackImageCount
  const rawDuration = meta?.durationMs ?? meta?.duration_ms ?? 0
  const duration = typeof rawDuration === 'number' && Number.isFinite(rawDuration) ? rawDuration : 0
  const rawRounds = meta?.rounds
  const rounds = rawRounds != null && rawRounds !== '' ? String(rawRounds) : '-'
  const evaluatedAt = String(meta?.evaluatedAt ?? meta?.evaluated_at ?? new Date().toISOString())
  return [
    { label: labels.images, value: String(count) },
    { label: labels.duration, value: formatDuration(duration, locale) },
    { label: labels.rounds, value: rounds },
    { label: labels.time, value: formatDateTime(evaluatedAt, locale) },
  ]
}
