/**
 * SSE 流式评估 —— 收敛 venus app.js L370-483 / group.js L355-430 的重复 SSE 流处理为一处。
 *
 * 职责（component-plan.md §2.5）：
 * - SSE 读取/解析（fetch + ReadableStream + TextDecoder）
 * - 事件分发（steps / reasoning / complete / error）
 * - camelCase/snake_case 一次性归一（§4.4），组件内不再出现双写
 * - 单图与组图共用，通过回调参数区分结果处理
 *
 * 消费方：
 * - SingleEvaluationFlow.vue（startSingle）
 * - JointEvaluationFlow.vue / CompareEvaluationFlow.vue（startGroup）
 *
 * 设计约束：
 * - 纯客户端能力（§四.5）：依赖 fetch/ReadableStream/TextDecoder，SSR 守卫
 * - 状态用 shallowRef + 整体替换数组（对齐 useOssUpload / useImageSelection 模式）
 * - 不引入新依赖（useCsrf 为 nuxt-security/nuxt-csurf 自动导入）
 * - venus-core 流式模式已直接发射 'proposer-revision'（engine.ts L587/L981），
 *   resolveStreamAgent 仅做防御性兜底
 */

import type { MaybeRefOrGetter } from 'vue'
import type { ReasoningBlock, StepStatus, StreamAgent, StreamStepItem } from '#shared/types/evaluation'

// ── 常量（对齐 app.js L12-31 / group.js L25-37）──

/** 固定四步轨道（DESIGN §9.9：条件步骤只在真正发生时插入） */
const DEFAULT_STEP_AGENTS: StreamAgent[] = ['genreDetector', 'proposer', 'critic', 'arbiter']

/** 通用流式错误文案（对齐 app.js L398/402 / group.js L382） */
const STREAM_ERROR_MESSAGE = '评估未能完成，请重试'

/** 请求失败文案（对齐 app.js L367 / group.js L351） */
const STREAM_START_ERROR = '评估未能开始，请稍后重试'

// ── 类型 ──

/** 流式评估阶段（对齐 useShareImage phase 状态机模式） */
export type StreamPhase = 'idle' | 'streaming' | 'complete' | 'error'

/** 单图流式评估请求选项（对齐 app.js L354-362） */
export interface SingleStreamOptions {
  imageUrl: string
  genre?: string
  context?: Record<string, unknown>
}

/** 组图流式评估请求选项（对齐 group.js L337-346） */
export interface GroupStreamOptions {
  imageUrls: string[]
  mode: 'joint' | 'compare'
  genre?: string
  includePerImage?: boolean
}

/** 流式评估回调（泛型 T 由消费方收窄结果类型） */
export interface StreamCallbacks<T = Record<string, unknown>> {
  onComplete: (result: T) => void
  onError?: (message: string) => void
  onGenreDetected?: (genre: string) => void
}

// ── 纯函数区（无 Vue 依赖，可独立测试）──

/**
 * SSE 缓冲解析（逐行移植 app.js L380-392 / group.js L363-372）。
 *
 * 从累积 buffer 中提取完整的 SSE data 行并 JSON.parse，
 * 返回解析出的事件数组与未消费的尾部余量。
 * 畸形 JSON 静默跳过（try-catch 容错，对齐生产行为）。
 */
export function parseSSELines(buffer: string): { events: Record<string, unknown>[]; remainder: string } {
  const lines = buffer.split('\n')
  const remainder = lines.pop() || ''
  const events: Record<string, unknown>[] = []

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue
    try {
      events.push(JSON.parse(line.slice(6)))
    }
    catch { /* 畸形帧静默跳过 */ }
  }

  return { events, remainder }
}

/**
 * 冲刷尾部 buffer（对齐 group.js L375-380）。
 *
 * 流读取结束后，TextDecoder 可能残留未输出的字节；
 * 调用方应将 `decoder.decode()` 无参返回值拼接到 remainder 后再解析。
 */
export function flushTrailingBuffer(remainder: string): Record<string, unknown> | null {
  const trimmed = remainder.trim()
  if (!trimmed.startsWith('data: ')) return null
  try {
    return JSON.parse(trimmed.slice(6))
  }
  catch {
    return null
  }
}

/**
 * venus-core agent 标识 → UI StreamAgent（防御性兜底）。
 *
 * 流式模式下引擎已直接以 'proposer-revision' 发射事件（engine.ts L587/L981），
 * 此函数仅做类型收窄 + round >= 3 的防御性兼容（非流式适配器可能的行为）。
 */
export function resolveStreamAgent(agent: string, round?: number): StreamAgent {
  if (agent === 'proposer-revision') return 'proposer-revision'
  if (agent === 'proposer' && round != null && round >= 3) return 'proposer-revision'
  return agent as StreamAgent
}

/**
 * 构建步骤轨道（对齐 app.js L497-512 / group.js L442-453 的状态计算逻辑）。
 *
 * 四固定步 + 条件插入 proposer-revision（在 arbiter 前，DESIGN §9.9）。
 * 目标 agent 之前全部 done，目标为 active/done。
 * 返回全新数组（shallowRef 整体替换）。
 *
 * @param activeAgent 当前活跃 agent（null 表示无活跃步骤）
 * @param status 目标状态（active / done）
 * @param hasRevision 是否已触发修正步骤
 * @param labels 步骤标签（调用方解析 i18n 后传入，组件零业务）
 */
export function buildSteps(
  activeAgent: StreamAgent | null,
  status: StepStatus,
  hasRevision: boolean,
  labels: Record<StreamAgent, string>,
): StreamStepItem[] {
  // 组装 agent 列表：四固定步 + 条件插入
  const agents: StreamAgent[] = hasRevision
    ? ['genreDetector', 'proposer', 'critic', 'proposer-revision', 'arbiter']
    : [...DEFAULT_STEP_AGENTS]

  const currentIndex = activeAgent ? agents.indexOf(activeAgent) : -1
  const allDone = status === 'done' && currentIndex === -1

  return agents.map((agent, index) => {
    let stepStatus: StepStatus = 'pending'
    if (allDone || (currentIndex >= 0 && index < currentIndex)) {
      stepStatus = 'done'
    }
    else if (index === currentIndex) {
      stepStatus = status
    }
    return { agent, label: labels[agent], status: stepStatus }
  })
}

/**
 * 浅层 camelCase 归一（component-plan §4.4 一次性归一）。
 *
 * venus-core EvaluationResult 顶层已是 camelCase，但 process 子结构的
 * AgentCallResult 内 ProposerResult/ArbitrationResult 保留 snake_case
 * （total_score / scene_type / arbitration_notes 等）。
 * 此函数处理顶层 + metadata 子对象的已知双写字段，未知字段透传。
 * 不修改原始引用。
 */
export function normalizeResult(raw: Record<string, unknown>): Record<string, unknown> {
  const result = { ...raw }

  // 顶层字段归一（对齐 app.js L522-547）
  if (result.totalScore == null && result.total_score != null) {
    result.totalScore = result.total_score
  }
  if (!result.sceneType && result.scene_type) {
    result.sceneType = result.scene_type
  }
  if (!result.groupAnalysis && result.group_analysis) {
    result.groupAnalysis = result.group_analysis
  }
  if (!result.comparisonSummary && result.comparison_summary) {
    result.comparisonSummary = result.comparison_summary
  }

  // metadata 子对象归一（对齐 app.js L559-562）
  const meta = result.metadata as Record<string, unknown> | undefined
  if (meta && typeof meta === 'object') {
    const normalizedMeta = { ...meta }
    if (normalizedMeta.durationMs == null && normalizedMeta.duration_ms != null) {
      normalizedMeta.durationMs = normalizedMeta.duration_ms
    }
    if (!normalizedMeta.evaluatedAt && normalizedMeta.evaluated_at) {
      normalizedMeta.evaluatedAt = normalizedMeta.evaluated_at
    }
    result.metadata = normalizedMeta
  }

  return result
}

// ── Composable 主体 ──

/**
 * SSE 流式评估管理（DESIGN.md §9.9：评审记录式进度，§15.4：状态文案）。
 *
 * - phase 状态机：idle → streaming → complete / error
 * - steps 步骤轨道：shallowRef 整体替换，消费方直接渲染
 * - reasoningBlocks 推理块：按 agent 累积 content，agent_complete 后置 final
 * - AbortController 管理 fetch 生命周期
 * - SSR 守卫：服务端调用 startSingle/startGroup 直接 return
 */
export function useEvaluationStream() {
  const phase = shallowRef<StreamPhase>('idle')
  const error = shallowRef<string | null>(null)

  // CSRF token（nuxt-security/nuxt-csurf）：两处原生 fetch POST 不走 $fetch 封装，
  // 需手动带 csrf-token 头，否则被 csurf 中间件 403。useCsrf 客户端从
  // SSR 注入的 <meta name="csrf-token"> 读取，返回普通字符串（非 Ref）。
  // SSR 侧无值但 startSingle/startGroup 均有 import.meta.server 提前返回，不会实际发起请求。
  const { csrf } = useCsrf()

  // ── 内部原始状态（steps / reasoningBlocks 为响应式派生，见下方 computed）──

  /** 当前活跃 agent（null = 无活跃步骤） */
  const activeAgent = shallowRef<StreamAgent | null>(null)
  /** 步骤轨道目标状态（active / done） */
  const trackStatus = shallowRef<StepStatus>('pending')
  /** 是否已触发修正步骤（条件插入 proposer-revision） */
  const hasRevision = shallowRef(false)
  /** 推理块状态（label 由 labelsSource 派生，不在此烘焙） */
  const blockStates = shallowRef<Array<Omit<ReasoningBlock, 'label'>>>([])

  let abortController: AbortController | null = null
  /** 非响应式累积缓冲（对齐 app.js state.streamReasoning），避免 O(n²) 字符串拼接 */
  let reasoningAccum: Record<string, string[]> = {}
  /**
   * 步骤标签响应式源（由 start 方法初始化）。
   *
   * 接受 MaybeRefOrGetter 而非快照字符串：Flow 传入 t() 派生的 computed，
   * locale 切换时 steps / reasoningBlocks 经下方 computed 自动重新解析标签——
   * 修复流式期间切换语言后步骤轨道/推理块标题滞留旧 locale 文案的问题。
   * composable 仍不解析 i18n（labels 恒由组件传入，仅改为响应式传入）。
   */
  let labelsSource: MaybeRefOrGetter<Partial<Record<StreamAgent, string>>> | null = null

  /** 标签解析：默认空串 + 调用方覆盖（原 stepLabels 变量合并逻辑的响应式等价） */
  const resolvedLabels = computed<Record<StreamAgent, string>>(() => ({
    genreDetector: '',
    proposer: '',
    critic: '',
    'proposer-revision': '',
    arbiter: '',
    ...(toValue(labelsSource) ?? {}),
  }))

  /**
   * 步骤轨道（派生自原始状态 + 响应式标签）。
   * idle 阶段返回空数组（原 steps.value 初始 [] 行为）；
   * start 置 phase='streaming' 后即渲染四固定步 pending 态。
   */
  const steps = computed<StreamStepItem[]>(() => {
    if (phase.value === 'idle') return []
    return buildSteps(activeAgent.value, trackStatus.value, hasRevision.value, resolvedLabels.value)
  })

  /** 推理块（label 派生自响应式标签，locale 切换即时更新） */
  const reasoningBlocks = computed<ReasoningBlock[]>(() =>
    blockStates.value.map(block => ({
      ...block,
      label: resolvedLabels.value[block.agent] || block.agent,
    })),
  )

  // ── 内部：事件分发（对齐 app.js L408-483 / group.js L391-429）──

  function dispatch(event: Record<string, unknown>, callbacks: StreamCallbacks): boolean {
    const type = event.type as string

    switch (type) {
      case 'evaluation_start':
      case 'group_evaluation_start': {
        // 初始化步骤轨道（派生自原始状态，见 steps computed）
        activeAgent.value = null
        trackStatus.value = 'pending'
        break
      }

      case 'genre_detected': {
        const data = event.data as Record<string, unknown> | undefined
        const genre = (data?.genre as string) || ''
        activeAgent.value = 'genreDetector'
        trackStatus.value = 'done'
        callbacks.onGenreDetected?.(genre)
        break
      }

      case 'agent_call': {
        const agent = resolveStreamAgent(
          event.agent as string,
          event.round as number | undefined,
        )
        if (agent === 'proposer-revision') hasRevision.value = true
        activeAgent.value = agent
        trackStatus.value = 'active'
        break
      }

      case 'reasoning_chunk': {
        const agent = resolveStreamAgent(event.agent as string)
        const content = (event.content as string) || ''
        if (!reasoningAccum[agent]) reasoningAccum[agent] = []
        reasoningAccum[agent]!.push(content)

        // 更新 blockStates（整体替换 shallowRef；label 由 reasoningBlocks computed 派生）
        const joined = reasoningAccum[agent]!.join('')
        const existing = blockStates.value
        const idx = existing.findIndex(b => b.agent === agent)
        if (idx >= 0) {
          const updated = [...existing]
          updated[idx] = { ...updated[idx]!, content: joined }
          blockStates.value = updated
        }
        else {
          blockStates.value = [...existing, { agent, content: joined, final: false }]
        }
        break
      }

      case 'agent_complete': {
        const agent = resolveStreamAgent(
          event.agent as string,
          event.round as number | undefined,
        )
        // 置对应 blockState.final = true
        const idx = blockStates.value.findIndex(b => b.agent === agent)
        if (idx >= 0) {
          const updated = [...blockStates.value]
          updated[idx] = { ...updated[idx]!, final: true }
          blockStates.value = updated
        }
        activeAgent.value = agent
        trackStatus.value = 'done'
        break
      }

      case 'evaluation_complete':
      case 'group_evaluation_complete': {
        const data = event.data as Record<string, unknown>
        const normalized = normalizeResult(data)
        activeAgent.value = null
        trackStatus.value = 'done'
        phase.value = 'complete'
        callbacks.onComplete(normalized)
        return true // 标记已获取最终结果
      }

      case 'error': {
        const err = event.error as { message?: string; code?: string } | undefined
        const message = err?.message || STREAM_ERROR_MESSAGE
        phase.value = 'error'
        error.value = message
        callbacks.onError?.(message)
        break
      }

      // result_chunk：当前忽略（预留扩展点）
      default:
        break
    }

    return false
  }

  // ── 内部：共享的流读取循环（对齐 app.js L370-393 / group.js L355-380）──

  async function readLoop(response: Response, callbacks: StreamCallbacks): Promise<void> {
    const body = response.body
    if (!body) throw new Error(STREAM_START_ERROR)

    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let gotResult = false

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const { events, remainder } = parseSSELines(buffer)
      buffer = remainder

      for (const event of events) {
        if (dispatch(event, callbacks)) gotResult = true
      }
    }

    // 尾部 buffer 冲刷（对齐 group.js L375-380）
    const trailing = `${buffer}${decoder.decode()}`.trim()
    if (trailing) {
      const lastEvent = flushTrailingBuffer(trailing)
      if (lastEvent) {
        if (dispatch(lastEvent, callbacks)) gotResult = true
      }
    }

    // 无结果且无错误 → 流异常结束（对齐 app.js L397-399 / group.js L382）
    if (!gotResult && phase.value !== 'error') {
      throw new Error(STREAM_ERROR_MESSAGE)
    }
  }

  // ── 核心方法 ──

  /**
   * 发起单图流式评估（对齐 app.js L321-405）。
   *
   * @param options 请求选项（imageUrl / genre / context）
   * @param callbacks 事件回调（onComplete / onError / onGenreDetected）
   * @param labels 步骤标签响应式源（调用方传入 t() 派生的 computed，
   *   locale 切换时步骤/推理块标签自动重新解析；亦兼容普通对象快照）
   */
  async function startSingle(
    options: SingleStreamOptions,
    callbacks: StreamCallbacks,
    labels?: MaybeRefOrGetter<Partial<Record<StreamAgent, string>>>,
  ): Promise<void> {
    if (import.meta.server) return

    reset()
    if (labels) labelsSource = labels
    phase.value = 'streaming'
    abortController = new AbortController()

    try {
      const response = await fetch('/api/evaluate/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'csrf-token': csrf || '' },
        body: JSON.stringify({
          imageUrl: options.imageUrl,
          genre: options.genre || undefined,
          context: options.context || undefined,
          mode: 'updates',
        }),
        signal: abortController.signal,
      })

      if (!response.ok) throw new Error(STREAM_START_ERROR)
      await readLoop(response, callbacks)
    }
    catch (err: unknown) {
      // AbortError 静默返回（用户主动取消）
      if ((err as Error)?.name === 'AbortError' || abortController?.signal.aborted) return
      const message = (err as Error)?.message || STREAM_ERROR_MESSAGE
      phase.value = 'error'
      error.value = /^(照片|评估)/.test(message) ? message : STREAM_ERROR_MESSAGE
      callbacks.onError?.(error.value)
    }
  }

  /**
   * 发起组图流式评估（对齐 group.js L323-389）。
   *
   * @param options 请求选项（imageUrls / mode / genre / includePerImage）
   * @param callbacks 事件回调（onComplete / onError / onGenreDetected）
   * @param labels 步骤标签响应式源（同 startSingle：传 computed 则 locale 切换即时生效）
   */
  async function startGroup(
    options: GroupStreamOptions,
    callbacks: StreamCallbacks,
    labels?: MaybeRefOrGetter<Partial<Record<StreamAgent, string>>>,
  ): Promise<void> {
    if (import.meta.server) return

    reset()
    if (labels) labelsSource = labels
    phase.value = 'streaming'
    abortController = new AbortController()

    try {
      const response = await fetch('/api/evaluate/group/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'csrf-token': csrf || '' },
        body: JSON.stringify({
          imageUrls: options.imageUrls,
          mode: options.mode,
          genre: options.genre || undefined,
          includePerImage: options.includePerImage ?? false,
          streamMode: 'updates',
        }),
        signal: abortController.signal,
      })

      if (!response.ok) throw new Error(STREAM_START_ERROR)
      await readLoop(response, callbacks)
    }
    catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError' || abortController?.signal.aborted) return
      const message = (err as Error)?.message || STREAM_ERROR_MESSAGE
      phase.value = 'error'
      error.value = /^(照片|评估|第 \d+\/\d+ 张照片)/.test(message) ? message : STREAM_ERROR_MESSAGE
      callbacks.onError?.(error.value)
    }
  }

  /** 中止当前流式评估 */
  function abort(): void {
    abortController?.abort()
    abortController = null
    if (phase.value === 'streaming') phase.value = 'idle'
  }

  /** 重置所有状态到初始值（新一轮评估前调用；labelsSource 保留——同评估会话内标签源不变） */
  function reset(): void {
    abortController?.abort()
    abortController = null
    phase.value = 'idle'
    activeAgent.value = null
    trackStatus.value = 'pending'
    hasRevision.value = false
    blockStates.value = []
    error.value = null
    reasoningAccum = {}
  }

  // 对齐 useOssUpload / useImageSelection 的 onScopeDispose 清理模式
  onScopeDispose(() => {
    abort()
  })

  return { phase, steps, reasoningBlocks, error, startSingle, startGroup, abort, reset }
}
