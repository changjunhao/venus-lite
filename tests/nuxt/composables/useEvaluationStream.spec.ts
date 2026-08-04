import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'

// ── vi.hoisted：mock 必须在模块加载前定义 ──

const { mockFetch } = vi.hoisted(() => {
  const mockFetch = vi.fn()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).fetch = mockFetch
  return { mockFetch }
})

// eslint-disable-next-line import/first
import {
  buildSteps,
  flushTrailingBuffer,
  normalizeResult,
  parseSSELines,
  resolveStreamAgent,
  useEvaluationStream,
} from '#imports'
// eslint-disable-next-line import/first
import type { StreamAgent } from '#shared/types/evaluation'

// ── 工具 ──

/** 构造 SSE 文本帧 */
function sseFrame(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

/** 构造 ReadableStream 响应（模拟 SSE 流） */
function createSSEResponse(frames: string[], ok = true): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const frame of frames) {
        controller.enqueue(encoder.encode(frame))
      }
      controller.close()
    },
  })
  return {
    ok,
    status: ok ? 200 : 500,
    body: stream,
  } as unknown as Response
}

const LABELS: Record<StreamAgent, string> = {
  genreDetector: '门类识别',
  proposer: '提案者初评',
  critic: '批判者质疑',
  'proposer-revision': '提案者修正',
  arbiter: '仲裁者裁决',
}

// ── 全局设置 ──

beforeEach(() => {
  vi.clearAllMocks()
})

// ── 纯函数测试 ──

describe('parseSSELines', () => {
  it('解析多个完整 SSE 帧', () => {
    const buffer = sseFrame({ type: 'agent_call', agent: 'proposer', round: 1 })
      + sseFrame({ type: 'reasoning_chunk', agent: 'proposer', content: '思考中' })

    const { events, remainder } = parseSSELines(buffer)

    expect(events).toHaveLength(2)
    expect(events[0]).toEqual({ type: 'agent_call', agent: 'proposer', round: 1 })
    expect(events[1]).toEqual({ type: 'reasoning_chunk', agent: 'proposer', content: '思考中' })
    expect(remainder).toBe('')
  })

  it('保留未完成的尾部行', () => {
    const buffer = 'data: {"type":"agent_call"}\n\ndata: {"type":"reas'

    const { events, remainder } = parseSSELines(buffer)

    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'agent_call' })
    expect(remainder).toBe('data: {"type":"reas')
  })

  it('跳过非 data: 前缀行', () => {
    const buffer = ': comment\nevent: message\ndata: {"type":"ok"}\n\n'

    const { events } = parseSSELines(buffer)

    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'ok' })
  })

  it('畸形 JSON 静默跳过', () => {
    const buffer = 'data: {invalid json}\n\ndata: {"type":"ok"}\n\n'

    const { events } = parseSSELines(buffer)

    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'ok' })
  })

  it('空 buffer 返回空数组', () => {
    const { events, remainder } = parseSSELines('')
    expect(events).toHaveLength(0)
    expect(remainder).toBe('')
  })
})

describe('flushTrailingBuffer', () => {
  it('解析完整的 trailing data 行', () => {
    const result = flushTrailingBuffer('data: {"type":"evaluation_complete","data":{}}')
    expect(result).toEqual({ type: 'evaluation_complete', data: {} })
  })

  it('非 data: 前缀返回 null', () => {
    expect(flushTrailingBuffer('some random text')).toBeNull()
    expect(flushTrailingBuffer('')).toBeNull()
  })

  it('畸形 JSON 返回 null', () => {
    expect(flushTrailingBuffer('data: {broken')).toBeNull()
  })
})

describe('resolveStreamAgent', () => {
  it('直传 proposer-revision', () => {
    expect(resolveStreamAgent('proposer-revision')).toBe('proposer-revision')
  })

  it('proposer + round >= 3 → proposer-revision（防御性兜底）', () => {
    expect(resolveStreamAgent('proposer', 3)).toBe('proposer-revision')
    expect(resolveStreamAgent('proposer', 4)).toBe('proposer-revision')
  })

  it('proposer + round < 3 → proposer', () => {
    expect(resolveStreamAgent('proposer', 1)).toBe('proposer')
    expect(resolveStreamAgent('proposer', 2)).toBe('proposer')
  })

  it('其余 agent 直传', () => {
    expect(resolveStreamAgent('genreDetector')).toBe('genreDetector')
    expect(resolveStreamAgent('critic', 2)).toBe('critic')
    expect(resolveStreamAgent('arbiter', 4)).toBe('arbiter')
  })
})

describe('buildSteps', () => {
  it('初始状态：四步全 pending', () => {
    const steps = buildSteps(null, 'pending', false, LABELS)
    expect(steps).toHaveLength(4)
    expect(steps.every(s => s.status === 'pending')).toBe(true)
    expect(steps.map(s => s.agent)).toEqual(['genreDetector', 'proposer', 'critic', 'arbiter'])
  })

  it('active 状态：目标之前全 done，目标 active', () => {
    const steps = buildSteps('critic', 'active', false, LABELS)
    expect(steps[0]!.status).toBe('done') // genreDetector
    expect(steps[1]!.status).toBe('done') // proposer
    expect(steps[2]!.status).toBe('active') // critic
    expect(steps[3]!.status).toBe('pending') // arbiter
  })

  it('done 状态：目标及之前全 done', () => {
    const steps = buildSteps('proposer', 'done', false, LABELS)
    expect(steps[0]!.status).toBe('done')
    expect(steps[1]!.status).toBe('done')
    expect(steps[2]!.status).toBe('pending')
  })

  it('hasRevision=true 时插入 proposer-revision', () => {
    const steps = buildSteps('proposer-revision', 'active', true, LABELS)
    expect(steps).toHaveLength(5)
    expect(steps[3]!.agent).toBe('proposer-revision')
    expect(steps[3]!.status).toBe('active')
    expect(steps[4]!.agent).toBe('arbiter')
  })

  it('allDone：activeAgent=null + done → 全部 done', () => {
    const steps = buildSteps(null, 'done', false, LABELS)
    expect(steps.every(s => s.status === 'done')).toBe(true)
  })
})

describe('normalizeResult', () => {
  it('不再把旧顶层 arbitration_notes 转换为 arbitrationNotes', () => {
    const raw = {
      total_score: 7.5,
      scene_type: 'golden_hour',
      arbitration_notes: { scene_type_ruling: '旧字段', decisions: [], final_rationale: '旧字段' },
      genre: 'landscape',
    }
    const result = normalizeResult(raw)

    expect(result.totalScore).toBe(7.5)
    expect(result.sceneType).toBe('golden_hour')
    expect(result.arbitrationNotes).toBeUndefined()
    expect(result.genre).toBe('landscape')
  })

  it('已有 camelCase 字段不覆盖', () => {
    const raw = { totalScore: 8.0, total_score: 7.0 }
    const result = normalizeResult(raw)
    expect(result.totalScore).toBe(8.0)
  })

  it('归一 metadata 子对象', () => {
    const raw = {
      metadata: { duration_ms: 3200, evaluated_at: '2026-01-01T00:00:00Z', rounds: 3 },
    }
    const result = normalizeResult(raw)
    const meta = result.metadata as Record<string, unknown>

    expect(meta.durationMs).toBe(3200)
    expect(meta.evaluatedAt).toBe('2026-01-01T00:00:00Z')
    expect(meta.rounds).toBe(3)
  })

  it('不修改原始引用', () => {
    const raw = { total_score: 7.5, metadata: { duration_ms: 100 } }
    normalizeResult(raw)
    expect(raw).toEqual({ total_score: 7.5, metadata: { duration_ms: 100 } })
  })

  it('归一组图特有字段', () => {
    const raw = { group_analysis: '系列分析', comparison_summary: '对比总结' }
    const result = normalizeResult(raw)
    expect(result.groupAnalysis).toBe('系列分析')
    expect(result.comparisonSummary).toBe('对比总结')
  })
})

// ── Composable 集成测试 ──

describe('useEvaluationStream', () => {
  function createApi() {
    let api!: ReturnType<typeof useEvaluationStream>
    const scope = effectScope()
    scope.run(() => {
      api = useEvaluationStream()
    })
    return { api, scope }
  }

  it('初始状态：idle + 空数组', () => {
    const { api, scope } = createApi()
    expect(api.phase.value).toBe('idle')
    expect(api.steps.value).toEqual([])
    expect(api.reasoningBlocks.value).toEqual([])
    expect(api.error.value).toBeNull()
    scope.stop()
  })

  it('单图完整流：phase 转换 + steps + result', async () => {
    const completeData = {
      totalScore: 7.8,
      genre: 'landscape',
      sceneType: 'golden_hour',
      dimensions: { composition: 8.0 },
      critique: '构图精巧',
      suggestions: ['建议加强光影'],
      arbitrationNotes: { sceneTypeRuling: '场景判定明确。', decisions: [], finalRationale: '综合判断' },
      metadata: { evaluatedAt: '2026-01-01', durationMs: 2500, rounds: 3 },
    }

    mockFetch.mockResolvedValue(createSSEResponse([
      sseFrame({ type: 'evaluation_start', data: { imageUrl: 'test.jpg', genre: 'landscape' }, timestamp: 1 }),
      sseFrame({ type: 'genre_detected', data: { genre: 'landscape', reasoning: null }, timestamp: 2 }),
      sseFrame({ type: 'agent_call', round: 1, agent: 'proposer', timestamp: 3 }),
      sseFrame({ type: 'reasoning_chunk', agent: 'proposer', content: '分析构图', timestamp: 4 }),
      sseFrame({ type: 'reasoning_chunk', agent: 'proposer', content: '与光影', timestamp: 5 }),
      sseFrame({ type: 'agent_complete', round: 1, agent: 'proposer', data: { result: { total_score: 7.5 }, reasoning: '推理' }, timestamp: 6 }),
      sseFrame({ type: 'agent_call', round: 2, agent: 'critic', timestamp: 7 }),
      sseFrame({ type: 'agent_complete', round: 2, agent: 'critic', data: { result: { severity: 'LOW' }, reasoning: null }, timestamp: 8 }),
      sseFrame({ type: 'agent_call', round: 3, agent: 'arbiter', timestamp: 9 }),
      sseFrame({ type: 'agent_complete', round: 3, agent: 'arbiter', data: { result: {}, reasoning: null }, timestamp: 10 }),
      sseFrame({ type: 'evaluation_complete', data: completeData, timestamp: 11 }),
    ]))

    const { api, scope } = createApi()
    const onComplete = vi.fn()
    const onGenreDetected = vi.fn()

    await api.startSingle(
      { imageUrl: 'test.jpg' },
      { onComplete, onGenreDetected },
      LABELS,
    )

    expect(api.phase.value).toBe('complete')
    expect(onComplete).toHaveBeenCalledOnce()
    expect(onComplete.mock.calls[0]![0].totalScore).toBe(7.8)
    expect(onGenreDetected).toHaveBeenCalledWith('landscape')

    // steps 全部 done
    expect(api.steps.value.every(s => s.status === 'done')).toBe(true)

    // reasoning 累积
    const proposerBlock = api.reasoningBlocks.value.find(b => b.agent === 'proposer')
    expect(proposerBlock?.content).toBe('分析构图与光影')
    expect(proposerBlock?.final).toBe(true)

    scope.stop()
  })

  it('组图流：group_evaluation_start + group_evaluation_complete', async () => {
    const groupResult = {
      mode: 'joint',
      totalScore: 8.2,
      genre: 'documentary',
      groupAnalysis: '系列叙事完整',
      metadata: { evaluatedAt: '2026-01-01', durationMs: 5000, rounds: 3, imageCount: 3 },
    }

    mockFetch.mockResolvedValue(createSSEResponse([
      sseFrame({ type: 'group_evaluation_start', data: { imageUrls: ['a.jpg', 'b.jpg'], mode: 'joint', genre: 'documentary' }, timestamp: 1 }),
      sseFrame({ type: 'agent_call', round: 1, agent: 'proposer', timestamp: 2 }),
      sseFrame({ type: 'agent_complete', round: 1, agent: 'proposer', data: { result: { total_score: 8.0 }, reasoning: null }, timestamp: 3 }),
      sseFrame({ type: 'group_evaluation_complete', data: groupResult, timestamp: 4 }),
    ]))

    const { api, scope } = createApi()
    const onComplete = vi.fn()

    await api.startGroup(
      { imageUrls: ['a.jpg', 'b.jpg'], mode: 'joint' },
      { onComplete },
      LABELS,
    )

    expect(api.phase.value).toBe('complete')
    expect(onComplete).toHaveBeenCalledOnce()
    expect(onComplete.mock.calls[0]![0].totalScore).toBe(8.2)
    expect(onComplete.mock.calls[0]![0].groupAnalysis).toBe('系列叙事完整')

    // 验证请求体
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/evaluate/group/stream',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"streamMode":"updates"'),
      }),
    )

    scope.stop()
  })

  it('error 事件：phase=error + callbacks.onError', async () => {
    mockFetch.mockResolvedValue(createSSEResponse([
      sseFrame({ type: 'evaluation_start', data: { imageUrl: 'x.jpg', genre: 'portrait' }, timestamp: 1 }),
      sseFrame({ type: 'error', error: { message: '模型超时', code: 'TIMEOUT' }, timestamp: 2 }),
    ]))

    const { api, scope } = createApi()
    const onComplete = vi.fn()
    const onError = vi.fn()

    await api.startSingle({ imageUrl: 'x.jpg' }, { onComplete, onError }, LABELS)

    expect(api.phase.value).toBe('error')
    expect(api.error.value).toBe('模型超时')
    expect(onError).toHaveBeenCalledWith('模型超时')
    expect(onComplete).not.toHaveBeenCalled()

    scope.stop()
  })

  it('HTTP 错误：phase=error', async () => {
    mockFetch.mockResolvedValue(createSSEResponse([], false))

    const { api, scope } = createApi()
    const onError = vi.fn()

    await api.startSingle({ imageUrl: 'x.jpg' }, { onComplete: vi.fn(), onError }, LABELS)

    expect(api.phase.value).toBe('error')
    expect(api.error.value).toBe('评估未能开始，请稍后重试')
    expect(onError).toHaveBeenCalled()

    scope.stop()
  })

  it('abort：中止流式评估', async () => {
    // 创建一个响应 abort 信号的流
    const stream = new ReadableStream({
      start() { /* 不主动 close */ },
      cancel() { /* abort 时 reader.cancel 触发 */ },
    })

    mockFetch.mockImplementation((_url: string, init: RequestInit) => {
      const signal = init.signal!
      // 包装 reader 使其响应 abort
      const originalGetReader = stream.getReader.bind(stream)
      const wrappedBody = {
        getReader() {
          const reader = originalGetReader()
          const originalRead = reader.read.bind(reader)
          reader.read = () => new Promise((resolve, reject) => {
            if (signal.aborted) {
              reject(new DOMException('Aborted', 'AbortError'))
              return
            }
            signal.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'))
            }, { once: true })
            originalRead().then(resolve, reject)
          })
          return reader
        },
      }
      return Promise.resolve({ ok: true, status: 200, body: wrappedBody } as unknown as Response)
    })

    const { api, scope } = createApi()

    const promise = api.startSingle({ imageUrl: 'x.jpg' }, { onComplete: vi.fn() }, LABELS)
    // 等待 fetch 发出并进入 readLoop
    await new Promise(r => setTimeout(r, 10))

    expect(api.phase.value).toBe('streaming')
    api.abort()

    await promise
    // abort 后静默返回，phase 回到 idle
    expect(api.phase.value).toBe('idle')

    scope.stop()
  })

  it('reset：清除所有状态', async () => {
    mockFetch.mockResolvedValue(createSSEResponse([
      sseFrame({ type: 'evaluation_start', data: { imageUrl: 'x.jpg', genre: 'portrait' }, timestamp: 1 }),
      sseFrame({ type: 'error', error: { message: '失败' }, timestamp: 2 }),
    ]))

    const { api, scope } = createApi()
    await api.startSingle({ imageUrl: 'x.jpg' }, { onComplete: vi.fn() }, LABELS)

    expect(api.phase.value).toBe('error')
    expect(api.error.value).not.toBeNull()

    api.reset()
    expect(api.phase.value).toBe('idle')
    expect(api.steps.value).toEqual([])
    expect(api.reasoningBlocks.value).toEqual([])
    expect(api.error.value).toBeNull()

    scope.stop()
  })

  it('proposer-revision 条件步骤插入', async () => {
    mockFetch.mockResolvedValue(createSSEResponse([
      sseFrame({ type: 'evaluation_start', data: { imageUrl: 'x.jpg', genre: 'portrait' }, timestamp: 1 }),
      sseFrame({ type: 'agent_call', round: 1, agent: 'proposer', timestamp: 2 }),
      sseFrame({ type: 'agent_complete', round: 1, agent: 'proposer', data: { result: {}, reasoning: null }, timestamp: 3 }),
      sseFrame({ type: 'agent_call', round: 2, agent: 'critic', timestamp: 4 }),
      sseFrame({ type: 'agent_complete', round: 2, agent: 'critic', data: { result: { severity: 'HIGH' }, reasoning: null }, timestamp: 5 }),
      sseFrame({ type: 'agent_call', round: 3, agent: 'proposer-revision', timestamp: 6 }),
      sseFrame({ type: 'agent_complete', round: 3, agent: 'proposer-revision', data: { result: {}, reasoning: null }, timestamp: 7 }),
      sseFrame({ type: 'agent_call', round: 4, agent: 'arbiter', timestamp: 8 }),
      sseFrame({ type: 'agent_complete', round: 4, agent: 'arbiter', data: { result: {}, reasoning: null }, timestamp: 9 }),
      sseFrame({ type: 'evaluation_complete', data: { totalScore: 7.0 }, timestamp: 10 }),
    ]))

    const { api, scope } = createApi()
    await api.startSingle({ imageUrl: 'x.jpg' }, { onComplete: vi.fn() }, LABELS)

    // 5 步（含 proposer-revision）
    expect(api.steps.value).toHaveLength(5)
    expect(api.steps.value[3]!.agent).toBe('proposer-revision')
    expect(api.steps.value.every(s => s.status === 'done')).toBe(true)

    scope.stop()
  })

  it('响应式 labels：切换标签源后 steps/reasoningBlocks 即时重新解析（locale 切换场景）', async () => {
    const EN_LABELS: Record<StreamAgent, string> = {
      genreDetector: 'Genre identification',
      proposer: 'Proposer\'s initial review',
      critic: 'Critic\'s challenge',
      'proposer-revision': 'Proposer\'s revision',
      arbiter: 'Arbitrator\'s verdict',
    }
    const labelsRef = ref<Record<StreamAgent, string>>({ ...LABELS })

    mockFetch.mockResolvedValue(createSSEResponse([
      sseFrame({ type: 'evaluation_start', data: { imageUrl: 'x.jpg', genre: 'portrait' }, timestamp: 1 }),
      sseFrame({ type: 'agent_call', round: 1, agent: 'proposer', timestamp: 2 }),
      sseFrame({ type: 'reasoning_chunk', agent: 'proposer', content: '分析', timestamp: 3 }),
      sseFrame({ type: 'agent_complete', round: 1, agent: 'proposer', data: { result: {}, reasoning: null }, timestamp: 4 }),
      sseFrame({ type: 'evaluation_complete', data: { totalScore: 7.0 }, timestamp: 5 }),
    ]))

    const { api, scope } = createApi()
    await api.startSingle({ imageUrl: 'x.jpg' }, { onComplete: vi.fn() }, labelsRef)

    // zh 标签（流开始时的 locale）
    expect(api.steps.value[0]!.label).toBe('门类识别')
    expect(api.reasoningBlocks.value[0]!.label).toBe('提案者初评')

    // 模拟 locale 切换：Flow 的 stepLabels computed 重新求值，
    // composable 经 toValue 重新解析——无需事件驱动
    labelsRef.value = EN_LABELS
    expect(api.steps.value[0]!.label).toBe('Genre identification')
    expect(api.steps.value[1]!.label).toBe('Proposer\'s initial review')
    expect(api.reasoningBlocks.value[0]!.label).toBe('Proposer\'s initial review')

    scope.stop()
  })

  it('scope dispose 中止流', async () => {
    const { api, scope } = createApi()

    mockFetch.mockImplementation((_url: string, init: RequestInit) => {
      const signal = init.signal!
      const stream = new ReadableStream({ start() {} })
      const originalGetReader = stream.getReader.bind(stream)
      const wrappedBody = {
        getReader() {
          const reader = originalGetReader()
          const originalRead = reader.read.bind(reader)
          reader.read = () => new Promise((resolve, reject) => {
            if (signal.aborted) {
              reject(new DOMException('Aborted', 'AbortError'))
              return
            }
            signal.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'))
            }, { once: true })
            originalRead().then(resolve, reject)
          })
          return reader
        },
      }
      return Promise.resolve({ ok: true, status: 200, body: wrappedBody } as unknown as Response)
    })

    const promise = api.startSingle({ imageUrl: 'x.jpg' }, { onComplete: vi.fn() }, LABELS)
    await new Promise(r => setTimeout(r, 10))

    scope.stop() // 触发 onScopeDispose → abort
    await promise

    expect(api.phase.value).toBe('idle')
  })
})
