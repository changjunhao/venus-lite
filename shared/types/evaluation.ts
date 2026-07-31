/**
 * 评估域共享类型（component-plan.md §2.5 归口）。
 *
 * 位于 shared/types/ 下，Nuxt 4 会同时向 app 与 server 自动导入，
 * 也可通过 `#shared/types/evaluation` 显式导入。
 * 后续 EvaluationResult / GroupResult / SSE 事件类型在此扩展。
 */

/**
 * EXIF 元数据（形状对齐 venus upload.js L45-116 extractExif 输出）。
 *
 * 消费方：useExif（提取）→ SinglePreview / ExifTagList（输入区展示）
 * → ExifPanel（结果区网格）。所有字段可选——提取失败或字段缺失时为 null。
 */
export interface ExifData {
  cameraModel?: string
  lensModel?: string
  fNumber?: number
  shutterSpeed?: string
  iso?: number
  focalLength?: number
  dateTimeOriginal?: string
  flash?: string
}

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
