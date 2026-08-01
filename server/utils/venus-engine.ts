import {
  createOpenAIChatProvider,
  createOpenAIResponsesProvider,
  createAnthropicProvider,
  createGeminiProvider,
  createVenusEngine,
} from '@theogony/venus-core'
import { createNitroAdapter } from '@theogony/venus-core/nitro'
import type { VenusEngine, LLMProvider, AgentRole, ReasoningEffort, ReasoningConfig } from '@theogony/venus-core'
import type { EventHandler, H3Event } from 'h3'

// ── 类型 ──────────────────────────────────────────────────

/** 支持的 Provider 类型 */
type ProviderType = 'openai-chat' | 'openai-responses' | 'anthropic' | 'gemini'

/** 所有 Agent 角色（与 venus-core AgentRole 一致） */
const AGENT_ROLES: AgentRole[] = ['genreDetector', 'proposer', 'critic', 'arbiter', 'revision']

// ── 惰性单例：引擎与适配器均在首个请求时构建（构造开销大，且需运行时配置）──
let engine: VenusEngine | null = null
let apiHandler: EventHandler | null = null

// ── Provider 工厂 ─────────────────────────────────────────

interface ProviderFactoryParams {
  type: ProviderType
  baseURL: string
  apiKey: string
  timeout?: number
}

/**
 * 根据类型创建对应的 LLM Provider 实例。
 * 支持 venus-core 全部四种 Provider：openai-chat / openai-responses / anthropic / gemini。
 */
function createProvider({ type, baseURL, apiKey, timeout }: ProviderFactoryParams): LLMProvider {
  switch (type) {
    case 'openai-responses':
      return createOpenAIResponsesProvider({ baseURL, apiKey, ...(timeout ? { timeout } : {}) })
    case 'anthropic':
      return createAnthropicProvider({ apiKey, baseURL, ...(timeout ? { timeout } : {}) })
    case 'gemini':
      return createGeminiProvider({ apiKey, baseURL, ...(timeout ? { timeout } : {}) })
    case 'openai-chat':
    default:
      return createOpenAIChatProvider({ baseURL, apiKey, ...(timeout ? { timeout } : {}) })
  }
}

// ── 配置解析 ─────────────────────────────────────────────

/** runtimeConfig 中每个 Agent 对应的键前缀（camelCase） */
const AGENT_CONFIG_PREFIX: Record<AgentRole, string> = {
  genreDetector: 'venusGenreDetector',
  proposer: 'venusProposer',
  critic: 'venusCritic',
  arbiter: 'venusArbiter',
  revision: 'venusRevision',
}

/**
 * 从 runtimeConfig 解析指定 Agent 的独立 Provider 配置。
 * 若该 Agent 未配置 baseUrl + apiKey，则返回 null（回落到全局 Provider）。
 */
function resolveAgentProvider(
  config: Record<string, unknown>,
  role: AgentRole,
): LLMProvider | null {
  const prefix = AGENT_CONFIG_PREFIX[role]
  const baseUrl = (config[`${prefix}BaseUrl`] as string) || ''
  const apiKey = (config[`${prefix}ApiKey`] as string) || ''

  // 必须同时提供 baseUrl 和 apiKey 才视为独立配置
  if (!baseUrl || !apiKey) return null

  const type = (config[`${prefix}ProviderType`] as string || config.venusProviderType || 'openai-chat') as ProviderType
  const timeout = (config[`${prefix}Timeout`] as number) || (config.venusProviderTimeout as number) || undefined

  return createProvider({ type, baseURL: baseUrl, apiKey, timeout })
}

/**
 * 解析指定 Agent 的模型配置；未配置时返回空字符串（由引擎回落到 defaultModel）。
 */
function resolveAgentModel(config: Record<string, unknown>, role: AgentRole): string {
  const prefix = AGENT_CONFIG_PREFIX[role]
  return (config[`${prefix}Model`] as string) || ''
}

/**
 * 解析指定 Agent 的 reasoning 覆盖配置。
 * 返回 AgentReasoningConfig | false | undefined：
 *  - effort 非空 → { effort, budgetTokens? }
 *  - effort 显式为 'none' → false（禁用该 Agent 的推理）
 *  - 未配置 → undefined（沿用全局）
 */
function resolveAgentReasoning(
  config: Record<string, unknown>,
  role: AgentRole,
): { effort: ReasoningEffort; budgetTokens?: number } | false | undefined {
  const prefix = AGENT_CONFIG_PREFIX[role]
  const effort = (config[`${prefix}ReasoningEffort`] as string) || ''
  if (!effort) return undefined
  if (effort === 'none') return false

  const budgetTokens = (config[`${prefix}ReasoningBudgetTokens`] as number) || undefined
  return { effort: effort as ReasoningEffort, budgetTokens }
}

/**
 * 构建完整的 ReasoningConfig（全局 + 每 Agent 覆盖）。
 */
function buildReasoningConfig(config: Record<string, unknown>): ReasoningConfig | undefined {
  const enabled = config.venusReasoningEnabled as boolean
  const effort = (config.venusReasoningEffort as string) || ''
  const budgetTokens = (config.venusReasoningBudgetTokens as number) || undefined

  // 收集每 Agent 的 reasoning 覆盖
  const agents: ReasoningConfig['agents'] = {}
  let hasAgentOverride = false
  for (const role of AGENT_ROLES) {
    const agentReasoning = resolveAgentReasoning(config, role)
    if (agentReasoning !== undefined) {
      agents[role] = agentReasoning
      hasAgentOverride = true
    }
  }

  // 全局禁用且无 Agent 覆盖时，直接返回 enabled: false
  if (!enabled && !hasAgentOverride && !effort) {
    return { enabled: false }
  }

  const reasoning: ReasoningConfig = {}
  if (!enabled) reasoning.enabled = false
  if (effort && effort !== 'none') reasoning.effort = effort as ReasoningEffort
  if (budgetTokens) reasoning.budgetTokens = budgetTokens
  if (hasAgentOverride) reasoning.agents = agents

  // 若配置为空对象（无有效项），返回 undefined
  if (!reasoning.enabled && !reasoning.effort && !reasoning.budgetTokens && !reasoning.agents) {
    return undefined
  }
  return reasoning
}

// ── 引擎初始化 ───────────────────────────────────────────

/**
 * 根据运行时配置构建 VenusEngine 实例（纯函数，无副作用）。
 *
 * 配置优先级：每 Agent 独立配置 > 全局配置 > 默认值
 * 每个 Agent（genreDetector / proposer / critic / arbiter / revision）
 * 均可独立配置 Provider 类型、baseURL、apiKey、model、timeout、reasoning。
 *
 * 提取为独立导出以便单元测试直接传入配置对象，无需 mock useRuntimeConfig。
 */
export function createEngineFromConfig(config: Record<string, unknown>): VenusEngine {
  const globalBaseUrl = (config.venusProviderBaseUrl as string) || ''
  const globalApiKey = (config.venusProviderApiKey as string) || ''
  const globalModel = (config.venusProviderModel as string) || ''

  if (!globalBaseUrl || !globalApiKey || !globalModel) {
    // 与 /api/oss/sts 的 STS_DISABLED 同构：未配置时明确 503，而非等到调用 LLM 才失败
    throw createError({
      statusCode: 503,
      statusMessage: 'Service Unavailable',
      data: { code: 'VENUS_DISABLED', message: 'Venus engine not configured' },
    })
  }

  // ── 全局默认 Provider ──
  const globalProviderType = (config.venusProviderType as string || 'openai-chat') as ProviderType
  const globalTimeout = (config.venusProviderTimeout as number) || undefined
  const defaultProvider = createProvider({
    type: globalProviderType,
    baseURL: globalBaseUrl,
    apiKey: globalApiKey,
    timeout: globalTimeout,
  })

  // ── 每 Agent 独立 Provider（仅配置了独立 baseUrl+apiKey 的角色才覆盖）──
  const providers: Partial<Record<AgentRole, LLMProvider>> = {}
  const models: Partial<Record<AgentRole, string>> = {}

  for (const role of AGENT_ROLES) {
    const agentProvider = resolveAgentProvider(config, role)
    if (agentProvider) providers[role] = agentProvider

    const agentModel = resolveAgentModel(config, role)
    if (agentModel) models[role] = agentModel
  }

  // ── Reasoning 配置 ──
  const reasoning = buildReasoningConfig(config)

  // ── 最大重试次数 ──
  const maxRetries = (config.venusMaxRetries as number) || 3

  // ── 构建引擎 ──
  return createVenusEngine({
    provider: defaultProvider,
    defaultModel: globalModel,
    ...(Object.keys(models).length > 0 ? { models } : {}),
    ...(Object.keys(providers).length > 0 ? { providers } : {}),
    ...(reasoning ? { reasoning } : {}),
    maxRetries,
  })
}

/**
 * 获取 VenusEngine 单例。
 * 惰性初始化：首次调用时读取运行时配置并创建引擎。
 */
export function getVenusEngine(event: H3Event): VenusEngine {
  if (engine) return engine

  const config = useRuntimeConfig(event) as unknown as Record<string, unknown>
  engine = createEngineFromConfig(config)
  return engine
}

// ── Nitro 适配器 ─────────────────────────────────────────

/**
 * 获取 venus-core Nitro 适配器的事件处理器（惰性单例）。
 *
 * prefix 设为 '/api'：h3 router 按 event.path 全路径匹配、不剥离外层前缀，
 * 因此适配器内部注册的路由必须与真实请求路径一致，对外即
 * POST /api/evaluate[/stream|/stream/jsonl]、POST /api/evaluate/group[/stream[/jsonl]]、
 * GET /api/metadata —— 与 venus demo 的 Hono 挂载保持一致。
 */
function getVenusApiHandler(event: H3Event): EventHandler {
  if (!apiHandler) {
    apiHandler = createNitroAdapter(getVenusEngine(event), { prefix: '/api' }).handler
  }
  return apiHandler
}

/**
 * 将请求委托给 venus-core 适配器，供 /api/evaluate*、/api/metadata 路由复用。
 *
 * h3 的非抢占式 router 在无匹配路由时返回 undefined（Nitro 会据此回 204），
 * 故显式补成 404，使 /api/evaluate/<未知子路径> 的语义与其他 Nitro 路由一致。
 */
export async function handleVenusApi(event: H3Event): Promise<unknown> {
  const response = await getVenusApiHandler(event)(event)
  if (response === undefined) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: `Cannot find any route matching ${event.path}.`,
    })
  }
  return response
}
