// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Nitro 自动导入 mock ──
// createError 由 Nuxt 自动导入插件注入；成功路径不会触发，
// 错误路径测试通过 catch 捕获（无论 createError 是否为真实实现均抛出带 statusCode 的对象）。

vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).defineEventHandler = (h: any) => h
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).useRuntimeConfig = () => ({})
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).createError = (opts: any) => {
    const err = new Error(opts.statusMessage || opts.message || 'Error')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(err as any).statusCode = opts.statusCode
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(err as any).statusMessage = opts.statusMessage
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(err as any).data = opts.data
    return err
  }
})

// ── Mock venus-core ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCreateOpenAIChatProvider = vi.fn((..._args: any[]) => ({ type: 'openai-chat-provider' }))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCreateOpenAIResponsesProvider = vi.fn((..._args: any[]) => ({ type: 'openai-responses-provider' }))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCreateAnthropicProvider = vi.fn((..._args: any[]) => ({ type: 'anthropic-provider' }))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCreateGeminiProvider = vi.fn((..._args: any[]) => ({ type: 'gemini-provider' }))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCreateVenusEngine = vi.fn((..._args: any[]) => ({ id: 'mock-engine' }))

vi.mock('@theogony/venus-core', () => ({
  createOpenAIChatProvider: mockCreateOpenAIChatProvider,
  createOpenAIResponsesProvider: mockCreateOpenAIResponsesProvider,
  createAnthropicProvider: mockCreateAnthropicProvider,
  createGeminiProvider: mockCreateGeminiProvider,
  createVenusEngine: mockCreateVenusEngine,
}))

vi.mock('@theogony/venus-core/nitro', () => ({
  createNitroAdapter: vi.fn(),
}))

const { createEngineFromConfig } = await import('~~/server/utils/venus-engine')

// ── 测试配置 ──

const BASE_CONFIG = {
  venusProviderBaseUrl: 'https://api.example.com',
  venusProviderApiKey: 'sk-test-key',
  venusProviderModel: 'gpt-4o',
}

/** 获取 createVenusEngine 的首次调用参数 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getEngineOpts(): any {
  return mockCreateVenusEngine.mock.calls[0]![0]
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── createEngineFromConfig：配置校验 ──

describe('createEngineFromConfig - 配置校验', () => {
  it('缺少 baseUrl 时抛出错误', () => {
    expect(() => createEngineFromConfig({ ...BASE_CONFIG, venusProviderBaseUrl: '' })).toThrow()
  })

  it('缺少 apiKey 时抛出错误', () => {
    expect(() => createEngineFromConfig({ ...BASE_CONFIG, venusProviderApiKey: '' })).toThrow()
  })

  it('缺少 model 时抛出错误', () => {
    expect(() => createEngineFromConfig({ ...BASE_CONFIG, venusProviderModel: '' })).toThrow()
  })

  it('配置完整时不抛出', () => {
    expect(() => createEngineFromConfig({ ...BASE_CONFIG })).not.toThrow()
  })
})

// ── createEngineFromConfig：Provider 选择 ──

describe('createEngineFromConfig - Provider 选择', () => {
  it('默认使用 openai-chat provider', () => {
    createEngineFromConfig({ ...BASE_CONFIG })

    expect(mockCreateOpenAIChatProvider).toHaveBeenCalledWith({
      baseURL: 'https://api.example.com',
      apiKey: 'sk-test-key',
      timeout: undefined,
    })
    expect(mockCreateVenusEngine).toHaveBeenCalledOnce()
  })

  it('venusProviderType=openai-responses 时使用对应 provider', () => {
    createEngineFromConfig({ ...BASE_CONFIG, venusProviderType: 'openai-responses' })

    expect(mockCreateOpenAIResponsesProvider).toHaveBeenCalledWith({
      baseURL: 'https://api.example.com',
      apiKey: 'sk-test-key',
      timeout: undefined,
    })
    expect(mockCreateOpenAIChatProvider).not.toHaveBeenCalled()
  })

  it('venusProviderType=anthropic 时使用对应 provider', () => {
    createEngineFromConfig({ ...BASE_CONFIG, venusProviderType: 'anthropic' })

    expect(mockCreateAnthropicProvider).toHaveBeenCalledWith({
      apiKey: 'sk-test-key',
      baseURL: 'https://api.example.com',
      timeout: undefined,
    })
  })

  it('venusProviderType=gemini 时使用对应 provider', () => {
    createEngineFromConfig({ ...BASE_CONFIG, venusProviderType: 'gemini' })

    expect(mockCreateGeminiProvider).toHaveBeenCalledWith({
      apiKey: 'sk-test-key',
      baseURL: 'https://api.example.com',
      timeout: undefined,
    })
  })

  it('配置 timeout 时正确传递', () => {
    createEngineFromConfig({ ...BASE_CONFIG, venusProviderTimeout: 30000 })

    expect(mockCreateOpenAIChatProvider).toHaveBeenCalledWith({
      baseURL: 'https://api.example.com',
      apiKey: 'sk-test-key',
      timeout: 30000,
    })
  })
})

// ── createEngineFromConfig：每 Agent 独立配置 ──

describe('createEngineFromConfig - Agent 独立配置', () => {
  it('每 Agent 独立 Provider 覆盖全局', () => {
    createEngineFromConfig({
      ...BASE_CONFIG,
      venusProposerBaseUrl: 'https://proposer.example.com',
      venusProposerApiKey: 'sk-proposer',
      venusProposerProviderType: 'anthropic',
    })

    // 全局 provider 仍为 openai-chat
    expect(mockCreateOpenAIChatProvider).toHaveBeenCalledOnce()
    // proposer 独立使用 anthropic
    expect(mockCreateAnthropicProvider).toHaveBeenCalledWith({
      apiKey: 'sk-proposer',
      baseURL: 'https://proposer.example.com',
      timeout: undefined,
    })

    const engineOpts = getEngineOpts()
    expect(engineOpts.providers).toHaveProperty('proposer')
  })

  it('Agent 仅配置 baseUrl 而未配 apiKey 时回落到全局', () => {
    createEngineFromConfig({
      ...BASE_CONFIG,
      venusCriticBaseUrl: 'https://critic.example.com',
    })

    const engineOpts = getEngineOpts()
    expect(engineOpts.providers).toBeUndefined()
  })

  it('每 Agent 独立 model 覆盖', () => {
    createEngineFromConfig({
      ...BASE_CONFIG,
      venusArbiterModel: 'claude-sonnet-4-20250514',
    })

    const engineOpts = getEngineOpts()
    expect(engineOpts.models).toEqual({ arbiter: 'claude-sonnet-4-20250514' })
    expect(engineOpts.defaultModel).toBe('gpt-4o')
  })

  it('Agent 独立 timeout 继承全局 timeout', () => {
    createEngineFromConfig({
      ...BASE_CONFIG,
      venusProviderTimeout: 60000,
      venusCriticBaseUrl: 'https://critic.example.com',
      venusCriticApiKey: 'sk-critic',
      venusCriticTimeout: 120000,
    })

    // critic 使用独立 timeout
    expect(mockCreateOpenAIChatProvider).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 120000 }),
    )
  })
})

// ── createEngineFromConfig：Reasoning 配置 ──

describe('createEngineFromConfig - Reasoning 配置', () => {
  it('reasoning 全局配置传递', () => {
    createEngineFromConfig({
      ...BASE_CONFIG,
      venusReasoningEnabled: true,
      venusReasoningEffort: 'high',
      venusReasoningBudgetTokens: 8000,
    })

    const engineOpts = getEngineOpts()
    expect(engineOpts.reasoning).toEqual({
      effort: 'high',
      budgetTokens: 8000,
    })
  })

  it('reasoning 禁用时传递 enabled: false', () => {
    createEngineFromConfig({
      ...BASE_CONFIG,
      venusReasoningEnabled: false,
    })

    const engineOpts = getEngineOpts()
    expect(engineOpts.reasoning).toEqual({ enabled: false })
  })

  it('每 Agent reasoning effort 覆盖', () => {
    createEngineFromConfig({
      ...BASE_CONFIG,
      venusReasoningEnabled: true,
      venusCriticReasoningEffort: 'max',
      venusCriticReasoningBudgetTokens: 16000,
    })

    const engineOpts = getEngineOpts()
    expect(engineOpts.reasoning.agents).toEqual({
      critic: { effort: 'max', budgetTokens: 16000 },
    })
  })

  it('Agent reasoning effort=none 时传递 false（禁用该 Agent 推理）', () => {
    createEngineFromConfig({
      ...BASE_CONFIG,
      venusReasoningEnabled: true,
      venusGenreDetectorReasoningEffort: 'none',
    })

    const engineOpts = getEngineOpts()
    expect(engineOpts.reasoning.agents.genreDetector).toBe(false)
  })

  it('全局禁用但 Agent 有覆盖时仍传递 agents', () => {
    createEngineFromConfig({
      ...BASE_CONFIG,
      venusReasoningEnabled: false,
      venusProposerReasoningEffort: 'high',
    })

    const engineOpts = getEngineOpts()
    expect(engineOpts.reasoning.enabled).toBe(false)
    expect(engineOpts.reasoning.agents).toEqual({
      proposer: { effort: 'high', budgetTokens: undefined },
    })
  })
})

// ── createEngineFromConfig：其他选项 ──

describe('createEngineFromConfig - 其他选项', () => {
  it('maxRetries 正确传递', () => {
    createEngineFromConfig({ ...BASE_CONFIG, venusMaxRetries: 5 })

    const engineOpts = getEngineOpts()
    expect(engineOpts.maxRetries).toBe(5)
  })

  it('maxRetries 未配置时默认为 3', () => {
    createEngineFromConfig({ ...BASE_CONFIG })

    const engineOpts = getEngineOpts()
    expect(engineOpts.maxRetries).toBe(3)
  })

  it('无 Agent model 覆盖时不传 models 字段', () => {
    createEngineFromConfig({ ...BASE_CONFIG })

    const engineOpts = getEngineOpts()
    expect(engineOpts.models).toBeUndefined()
  })

  it('返回引擎实例', () => {
    const result = createEngineFromConfig({ ...BASE_CONFIG })
    expect(result).toEqual({ id: 'mock-engine' })
  })
})
