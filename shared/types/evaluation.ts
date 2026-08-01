/**
 * 评估域共享类型（component-plan.md §2.5 归口）。
 *
 * 位于 shared/types/ 下，Nuxt 4 会同时向 app 与 server 自动导入，
 * 也可通过 `#shared/types/evaluation` 显式导入。
 *
 * 类型来源分两部分：
 * - venus-core 重导出：评估结果、SSE 事件、EXIF、门类等核心类型
 *   （单一来源，避免双写与版本漂移）
 * - 本地 UI 专属：StreamAgent / ScoreBand / ProcessStep 等
 *   （venus-core 无对应物，为 venus-lite 前端渲染层特有）
 */

// ── venus-core 类型重导出（单一来源）──
// 评估域核心类型统一来自 @theogony/venus-core，避免双写与版本漂移。
// 源文件：venus-core/src/types.ts + venus-core/src/schema/index.ts
export type {
  // Schema-inferred types
  ExifData,
  GenreMetadata,
  // Genre & context
  Genre,
  EvaluationContext,
  // Single evaluation results
  EvaluationResult,
  ProposerResult,
  ArbitrationResult,
  CritiqueResult,
  CritiqueChallenge,
  SceneTypeReview,
  // Group evaluation results
  GroupJointEvaluationResult,
  GroupCompareEvaluationResult,
  GroupEvaluationResult,
  PerImageDetail,
  GroupEvaluationMetadata,
  // Agent types
  AgentCallResult,
  // Stream events
  EvaluationStreamEvent,
  GroupEvaluationStreamEvent,
  EvaluationEvent,
} from '@theogony/venus-core'

// ── 本地 UI 专属类型 ──
// 以下类型是 venus-lite 前端渲染层特有概念，venus-core 无对应物。

/** EXIF 字段键（标签列表遍历与 labels 映射的类型约束） */
export type ExifTagKey = keyof ExifData

/**
 * 评审轨道 Agent 标识（对齐 venus app.js L12-18 AGENT_LABELS 键名）。
 *
 * `proposer-revision` 为条件步骤——仅在批判者质疑引发修正时出现
 * （DESIGN §9.9「条件步骤只在真正发生时插入」）。
 */
export type StreamAgent = 'genreDetector' | 'proposer' | 'critic' | 'proposer-revision' | 'arbiter'

/**
 * 步骤状态（DESIGN §9.9 三态渲染）。
 *
 * §9.9 的 error 态由父级文案表达（ReviewProgress text/subtext），
 * 步骤轨道本身不渲染 error 样式——对齐 app.js L500 `failed` 时直接 return。
 */
export type StepStatus = 'pending' | 'active' | 'done'

/** 步骤轨道单项（label 由调用方解析 i18n 后传入，组件零业务） */
export interface StreamStepItem {
  agent: StreamAgent
  label: string
  status: StepStatus
}

/**
 * 流式推理块（对齐 app.js L810-837 renderStreamReasoning 的 per-agent 结构）。
 *
 * 消费方：useEvaluationStream（累积 content / 置 final）→ StreamReasoning（渲染）。
 */
export interface ReasoningBlock {
  agent: StreamAgent
  /** 调用方解析的步骤标签（渲染为「{label}过程」，对齐 app.js L825） */
  label: string
  /** 累积的 Markdown 文本（useEvaluationStream 追加） */
  content: string
  /** agent_complete 后置 true → markstream-vue 收敛未闭合结构 */
  final: boolean
}

/** §5.4 分数带标识（DESIGN.md L231-236 四区间） */
export type ScoreBandKey = 'unformed' | 'basic' | 'clear' | 'strong'

/**
 * 分数带定义项（DESIGN.md §5.4 评分颜色）。
 *
 * 消费方：getScoreBand（shared/utils/format.ts）→ ScorePanel（CSS class）/
 * useShareImage（Canvas 色值按 key 映射）（component-plan §4.3 单一来源）。
 */
export interface ScoreBand {
  key: ScoreBandKey
  /** 区间上界（不含）；仅 strong 为 Infinity */
  ceiling: number
  /** 中文默认标签（i18n 场景由调用方按 key 解析本地化文案；Canvas 场景直接消费） */
  label: string
  /** 对应 CSS class 名（venus utils.js L47-50 原样保留——跨项目设计语言锚点） */
  colorClass: string
}

// ── 评估过程披露域（ProcessTimeline / ProcessStep / ChallengeList / ReasoningBlock）──

/** 过程步骤类别（对齐 app.js L680/699/726/745 step-{kind}） */
export type ProcessStepKind = 'proposal' | 'critique' | 'revision' | 'arbitration'

/** 批判严重程度（对齐 venus-core CritiqueSchema.severity，供 Flow 映射 badge variant） */
export type CritiqueSeverity = 'LOW' | 'MEDIUM' | 'HIGH'

/** 徽章变体（镜像 BaseBadge.vue variant 联合，类型层单一来源） */
export type ProcessBadgeVariant =
  | 'step-score'
  | 'step-tag'
  | 'severity-low'
  | 'severity-medium'
  | 'severity-high'

/** 步骤徽章（text 由调用方解析 i18n 后传入，如「评分：8.5」「质疑程度：高」） */
export interface ProcessStepBadge {
  variant: ProcessBadgeVariant
  text: string
}

/**
 * 质疑项（对齐 venus-core CritiqueChallenge，camelCase 归一后形状）。
 *
 * 消费方：Flow 映射层（归一 + i18n）→ ChallengeList（渲染）。
 */
export interface ChallengeItem {
  /** 维度原始 key（ChallengeList 内经 resolveDimensionName 解析，DimensionList 先例） */
  dimension: string
  issue: string
  evidence: string
  /** 建议分；null/非有限值时不渲染箭头尾缀（group.js L952-954 健壮版） */
  suggestedScore: number | null
}

/**
 * 过程步骤渲染数据（app.js renderProcess / group.js createProcessStep 的归一化输出）。
 *
 * 消费方：Flow 映射层（unwrap AgentCallResult + i18n 解析 + severity→variant 转换）
 * → ProcessTimeline / ProcessStep（纯渲染，组件零业务）。
 */
export interface ProcessStepItem {
  kind: ProcessStepKind
  /** 步骤标题（调用方复用 review.step* 键解析） */
  title: string
  badges: ProcessStepBadge[]
  /** 步骤内容 Markdown（空串时不渲染，对齐 group.js L937） */
  content: string
  /** 质疑项（仅 critique 步骤；空/缺省时不渲染 ChallengeList，对齐 group.js L944） */
  challenges?: ChallengeItem[]
  /** 推理文本（null/空/空白时不渲染 ReasoningBlock，对齐 app.js L770） */
  reasoning?: string | null
  /** 推理折叠按钮完整文案（调用方组合 process.reasoningToggle 键；缺省时即使 reasoning 非空也不渲染） */
  reasoningToggle?: string
}
