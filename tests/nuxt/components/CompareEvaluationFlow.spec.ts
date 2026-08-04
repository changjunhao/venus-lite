import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import CompareEvaluationFlow from '~/components/business/CompareEvaluationFlow.vue'
import {
  buildGroupMetadataItems,
  compareProposalContent,
  mapProcessSteps,
  type GroupMetadataItemLabels,
  type ProcessStepLabels,
} from '~/utils/evaluation-mapping'

// 测试环境强制 zh locale：happy-dom 的 navigator.language 为 en-US，
// i18n detectBrowserLanguage 会探测为 en；cookie 优先生效（nuxt.config cookieKey 'venus-locale'）
document.cookie = 'venus-locale=zh'

// nuxt 测试环境文件间共享模块缓存（同 worker 内隔离关闭）：
// 本文件的 vi.mock 工厂会泄漏给后续文件，须在文件结束时解除
// （SingleEvaluationFlow.spec L22-29 先例）
afterAll(() => {
  vi.unmock('~/composables/useImageSelection')
  vi.unmock('~/composables/useOssUpload')
  vi.unmock('~/composables/useEvaluationStream')
  vi.unmock('~/composables/useEvalMetadata')
})

// ── composable mock 句柄（vi.hoisted 先于模块加载；工厂内赋值，测试内读写）──

interface SelectionMock {
  entries: Ref<unknown[]>
  errors: Ref<unknown[]>
  count: Ref<number>
  canSubmit: Ref<boolean>
  addFiles: Mock
  removeEntry: Mock
  moveEntry: Mock
  clear: Mock
}
interface OssMock {
  uploading: Ref<boolean>
  upload: Mock
}
interface StreamMock {
  phase: Ref<string>
  steps: Ref<unknown[]>
  reasoningBlocks: Ref<unknown[]>
  startGroup: Mock
}
interface MetadataMock {
  metadata: Ref<unknown>
  fetch: Mock
}

const mocks = vi.hoisted(() => ({
  selection: null as SelectionMock | null,
  oss: null as OssMock | null,
  stream: null as StreamMock | null,
  metadata: null as MetadataMock | null,
}))

// ── vi.mock：编排 composable 替换为可控桩（保留具名导出供子组件消费）──

vi.mock('~/composables/useImageSelection', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/composables/useImageSelection')>()
  const { computed, shallowRef } = await vi.importActual<typeof import('vue')>('vue')
  const handle: SelectionMock = {
    entries: shallowRef([]),
    errors: shallowRef([]),
    count: computed(() => (mocks.selection?.entries.value ?? []).length) as unknown as Ref<number>,
    canSubmit: computed(() => (mocks.selection?.entries.value ?? []).length >= 2) as unknown as Ref<boolean>,
    addFiles: vi.fn(),
    removeEntry: vi.fn(),
    moveEntry: vi.fn(),
    clear: vi.fn(),
  }
  mocks.selection = handle
  return {
    ...actual,
    useImageSelection: () => ({
      entries: handle.entries,
      errors: handle.errors,
      count: handle.count,
      canSubmit: handle.canSubmit,
      addFiles: handle.addFiles,
      removeEntry: handle.removeEntry,
      moveEntry: handle.moveEntry,
      clear: handle.clear,
    }),
  }
})

vi.mock('~/composables/useOssUpload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/composables/useOssUpload')>()
  const { shallowRef } = await vi.importActual<typeof import('vue')>('vue')
  const handle: OssMock = { uploading: shallowRef(false), upload: vi.fn() }
  mocks.oss = handle
  return {
    ...actual,
    useOssUpload: () => ({
      uploading: handle.uploading,
      progress: shallowRef({ phase: 'preparing', percent: 0 }),
      error: shallowRef(null),
      upload: handle.upload,
      uploadMultiple: vi.fn(),
      reset: vi.fn(),
    }),
  }
})

vi.mock('~/composables/useEvaluationStream', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/composables/useEvaluationStream')>()
  const { shallowRef } = await vi.importActual<typeof import('vue')>('vue')
  const handle: StreamMock = {
    phase: shallowRef('idle'),
    steps: shallowRef([]),
    reasoningBlocks: shallowRef([]),
    startGroup: vi.fn(),
  }
  mocks.stream = handle
  return {
    ...actual,
    useEvaluationStream: () => ({
      phase: handle.phase,
      steps: handle.steps,
      reasoningBlocks: handle.reasoningBlocks,
      error: shallowRef(null),
      startSingle: vi.fn(),
      startGroup: handle.startGroup,
      abort: vi.fn(),
      reset: vi.fn(),
    }),
  }
})

vi.mock('~/composables/useEvalMetadata', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/composables/useEvalMetadata')>()
  const { computed, shallowRef } = await vi.importActual<typeof import('vue')>('vue')
  const handle: MetadataMock = { metadata: shallowRef(null), fetch: vi.fn() }
  mocks.metadata = handle
  return {
    ...actual,
    useEvalMetadata: () => ({
      metadata: handle.metadata,
      loading: shallowRef(false),
      error: shallowRef(null),
      fetch: handle.fetch,
      genreEntries: computed(() => []),
    }),
  }
})

// ── happy-dom 兜底：scrollToResult 依赖 matchMedia（§12.5 守卫）与 scrollIntoView ──

if (typeof window.matchMedia !== 'function') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })
}
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => {}
}

// ── 夹具 ──

/** 归一化组图对比结果（useEvaluationStream.normalizeResult 输出形状：顶层 camelCase，process 子结构保留 snake_case） */
const COMPARE_RESULT_FIXTURE = {
  genre: 'landscape',
  ranking: [
    { index: 1, rank: 1, score: 8.2, rationale: '光影层次丰富' },
    { index: 0, rank: 2, score: 7.5, rationale: '构图稳健' },
  ],
  comparisonSummary: '对比总结内容……',
  suggestions: ['对比改进建议……'],
  arbitrationNotes: { sceneTypeRuling: '场景判定明确。', decisions: [], finalRationale: '对比裁决说明……' },
  perImage: [
    { index: 0, score: 7.5, comment: '第一张点评' },
    { index: 1, score: 8.2, comment: '第二张点评' },
  ],
  process: {
    proposal: {
      result: {
        ranking: [
          { index: 1, rank: 1, score: 8.2, rationale: '' },
          { index: 0, rank: 2, score: 7.5, rationale: '' },
        ],
        comparison_summary: '提案对比分析',
      },
      reasoning: '提案推理',
    },
    critique: {
      result: {
        severity: 'LOW',
        overall_assessment: '整体质疑',
        challenges: [
          { dimension: 'light', issue: '评分差距依据不足', evidence: '第一张光比', suggested_score: 7.8 },
        ],
      },
      reasoning: '批判推理',
    },
    arbitration: {
      result: {
        ranking: [
          { index: 1, rank: 1, score: 8.2, rationale: '' },
          { index: 0, rank: 2, score: 7.5, rationale: '' },
        ],
        arbitration_notes: { scene_type_ruling: '场景判定明确。', decisions: [], final_rationale: '裁决内容' },
      },
      reasoning: '仲裁推理',
    },
  },
  metadata: { evaluatedAt: '2026-08-01T10:00:00.000Z', durationMs: 45678, rounds: 2, imageCount: 2 },
}

const LABELS: ProcessStepLabels = {
  stepProposal: '提案者初评',
  stepCritique: '批判者质疑',
  stepRevision: '提案者修正',
  stepArbitration: '仲裁者裁决',
  scoreBadge: '评分：{score}',
  sceneBadge: '场景：{scene}',
  severityBadge: '质疑程度：{level}',
  severityLow: '低',
  severityMedium: '中',
  severityHigh: '高',
  suggestedBadge: '建议：{score}',
  revisedBadge: '修正后：{score}',
  finalBadge: '最终：{score}',
  reasoningToggle: '{agent}分析过程',
  agentProposer: '提案者',
  agentCritic: '批判者',
  agentRevision: '提案者修正',
  agentArbiter: '仲裁者',
  sortedBadge: '已排序 {count} 张照片',
  resortedBadge: '已重新排序 {count} 张照片',
  finalRankBadge: '最终排序 {count} 张照片',
}

const GROUP_META_LABELS: GroupMetadataItemLabels = {
  images: '照片数量',
  duration: '评估耗时',
  rounds: '评估轮次',
  time: '评估时间',
}

const TEST_FILE_A = new File(['photo-a'], 'dawn.jpg', { type: 'image/jpeg' })
const TEST_FILE_B = new File(['photo-b'], 'dusk.jpg', { type: 'image/jpeg' })

const ENTRY_A = { id: 'image-a', identity: 'dawn.jpg:5:0', file: TEST_FILE_A, objectURL: 'blob:mock-a', width: 1920, height: 1080 }
const ENTRY_B = { id: 'image-b', identity: 'dusk.jpg:5:0', file: TEST_FILE_B, objectURL: 'blob:mock-b', width: 1920, height: 1080 }

/** 注入两张已选图片（addFiles 桩模拟 useImageSelection multi 模式追加语义） */
function mockSelectedEntries(): void {
  mocks.selection!.addFiles.mockImplementation(async () => {
    mocks.selection!.entries.value = [ENTRY_A, ENTRY_B]
  })
}

/** happy path：选片 → 逐张上传成功 → 流式完成回放归一结果 */
async function mountAndComplete(): Promise<ReturnType<typeof mountSuspended>> {
  mockSelectedEntries()
  mocks.oss!.upload
    .mockResolvedValueOnce({ url: 'https://oss.example/dawn.jpg', key: 'k1', deduplicated: false, fallback: false })
    .mockResolvedValueOnce({ url: 'https://oss.example/dusk.jpg', key: 'k2', deduplicated: false, fallback: false })
  mocks.stream!.startGroup.mockImplementation(async (_options: unknown, callbacks: { onComplete: (result: unknown) => void }) => {
    mocks.stream!.phase.value = 'streaming'
    mocks.stream!.phase.value = 'complete'
    callbacks.onComplete(COMPARE_RESULT_FIXTURE)
  })
  const wrapper = await mountSuspended(CompareEvaluationFlow)
  await wrapper.find('.upload-zone').trigger('drop', { dataTransfer: { files: [TEST_FILE_A, TEST_FILE_B] } })
  await flushPromises()
  await wrapper.find('.group-evaluate-button').trigger('click')
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.selection!.entries.value = []
  mocks.selection!.errors.value = []
  mocks.oss!.uploading.value = false
  mocks.stream!.phase.value = 'idle'
  mocks.stream!.steps.value = []
  mocks.stream!.reasoningBlocks.value = []
})

// ── 纯函数：compareProposalContent（group.js L989 else 分支）──

describe('compareProposalContent', () => {
  it('comparison_summary 优先', () => {
    expect(compareProposalContent({ comparison_summary: '对比分析', critique: '初评' })).toBe('对比分析')
  })

  it('camelCase comparisonSummary 双读', () => {
    expect(compareProposalContent({ comparisonSummary: '归一对比分析', critique: '初评' })).toBe('归一对比分析')
  })

  it('无 comparison_summary 不回退 critique（源 L989 else 分支语义）', () => {
    expect(compareProposalContent({ critique: '初评内容' })).toBe('')
  })

  it('全缺失回退空串', () => {
    expect(compareProposalContent({})).toBe('')
  })
})

// ── mapProcessSteps mode='compare' 徽章策略（group.js L979-986/L1010-1012/L1022-1025）──

describe('mapProcessSteps mode=compare', () => {
  const compareProcess = {
    proposal: {
      result: {
        ranking: [{ index: 0, rank: 1 }, { index: 1, rank: 2 }],
        comparison_summary: '提案对比分析',
      },
    },
    revision: {
      result: {
        ranking: [{ index: 1, rank: 1 }, { index: 0, rank: 2 }],
        comparison_summary: '修正对比分析',
      },
    },
    arbitration: {
      result: {
        ranking: [{ index: 1, rank: 1 }, { index: 0, rank: 2 }],
        arbitration_notes: { scene_type_ruling: '场景判定明确。', decisions: [], final_rationale: '裁决内容' },
      },
    },
  }

  it('proposal 徽章为排序计数（无 score/scene 徽章）', () => {
    const steps = mapProcessSteps(compareProcess, LABELS, undefined, compareProposalContent, 'compare')
    const proposal = steps.find(s => s.kind === 'proposal')!
    expect(proposal.badges).toHaveLength(1)
    expect(proposal.badges[0]).toEqual({ variant: 'step-score', text: '已排序 2 张照片' })
  })

  it('revision 徽章为重排计数（无 revisedBadge）', () => {
    const steps = mapProcessSteps(compareProcess, LABELS, undefined, compareProposalContent, 'compare')
    const revision = steps.find(s => s.kind === 'revision')!
    expect(revision.badges).toHaveLength(1)
    expect(revision.badges[0]).toEqual({ variant: 'step-score', text: '已重新排序 2 张照片' })
  })

  it('arbitration 徽章为终排计数（无 finalBadge）', () => {
    const steps = mapProcessSteps(compareProcess, LABELS, undefined, compareProposalContent, 'compare')
    const arbitration = steps.find(s => s.kind === 'arbitration')!
    expect(arbitration.badges).toHaveLength(1)
    expect(arbitration.badges[0]).toEqual({ variant: 'step-score', text: '最终排序 2 张照片' })
  })

  it('content 取 comparison_summary（compareProposalContent）', () => {
    const steps = mapProcessSteps(compareProcess, LABELS, undefined, compareProposalContent, 'compare')
    expect(steps.find(s => s.kind === 'proposal')!.content).toBe('提案对比分析')
    expect(steps.find(s => s.kind === 'revision')!.content).toBe('修正对比分析')
  })

  it('ranking 缺失时计数回退 0（group.js `?.length || 0`）', () => {
    const steps = mapProcessSteps(
      { proposal: { result: { comparison_summary: '分析' } } },
      LABELS,
      undefined,
      compareProposalContent,
      'compare',
    )
    expect(steps[0]!.badges[0]!.text).toBe('已排序 0 张照片')
  })

  it('不传 mode 时行为不变（joint/single 路径回归）', () => {
    const jointProcess = {
      proposal: { result: { total_score: 7.9, scene_type: 'mountain', group_analysis: '系列分析' } },
    }
    const steps = mapProcessSteps(jointProcess, LABELS, scene => scene)
    expect(steps[0]!.badges[0]).toEqual({ variant: 'step-score', text: '评分：7.9' })
    expect(steps[0]!.badges[1]).toEqual({ variant: 'step-tag', text: '场景：mountain' })
  })
})

// ── 纯函数：buildGroupMetadataItems（group.js L563-567，Joint 同构复用）──

describe('buildGroupMetadataItems', () => {
  it('4 项：照片数量 / 耗时 / 轮次 / 时间', () => {
    const items = buildGroupMetadataItems(
      { imageCount: 3, durationMs: 12345, rounds: 2, evaluatedAt: '2026-08-01T10:00:00.000Z' },
      5,
      GROUP_META_LABELS,
      'zh',
    )
    expect(items).toHaveLength(4)
    expect(items[0]).toEqual({ label: '照片数量', value: '3' })
    expect(items[2]).toEqual({ label: '评估轮次', value: '2' })
  })
})

// ── 编排：全流程 ──

describe('CompareEvaluationFlow 全流程', () => {
  it('初始态：输入卡渲染、无结果区', async () => {
    const wrapper = await mountSuspended(CompareEvaluationFlow)
    expect(wrapper.find('.group-input-card').exists()).toBe(true)
    expect(wrapper.find('.group-results').exists()).toBe(false)
    expect(wrapper.find('.review-progress').exists()).toBe(false)
  })

  it('逐张上传按序调用 + startGroup 收到 mode=compare 载荷', async () => {
    await mountAndComplete()
    expect(mocks.oss!.upload).toHaveBeenCalledTimes(2)
    expect(mocks.oss!.upload).toHaveBeenNthCalledWith(1, TEST_FILE_A)
    expect(mocks.oss!.upload).toHaveBeenNthCalledWith(2, TEST_FILE_B)
    expect(mocks.stream!.startGroup).toHaveBeenCalledTimes(1)
    const [options] = mocks.stream!.startGroup.mock.calls[0]!
    expect(options).toMatchObject({
      imageUrls: ['https://oss.example/dawn.jpg', 'https://oss.example/dusk.jpg'],
      mode: 'compare',
      genre: undefined,
      includePerImage: false,
    })
  })

  it('完成后结果区渲染：masthead / 排名 / 聚焦比较 / 对比总结 / 逐图 / 两章 / 元数据', async () => {
    const wrapper = await mountAndComplete()
    // masthead（group-compare.html L104）
    expect(wrapper.find('.result-masthead').text()).toContain('组图对比评估结果')
    // 排名卡（group-compare.html L128-130）：2 张排名卡按 rank 排序
    expect(wrapper.find('.comparison-report').exists()).toBe(true)
    expect(wrapper.findAll('.ranking-card')).toHaveLength(2)
    expect(wrapper.find('.ranking-winner').exists()).toBe(true)
    // 双图聚焦比较（group-compare.html L132-143）
    expect(wrapper.find('.compare-focus').exists()).toBe(true)
    // 对比总结（SummaryCard comparison 变体，group-compare.html L146-149）
    expect(wrapper.find('.comparison-summary').exists()).toBe(true)
    expect(wrapper.text()).toContain('对比总结内容……')
    // 逐图明细 2 卡（group.js renderPerImage）
    expect(wrapper.find('.per-image-section').exists()).toBe(true)
    expect(wrapper.findAll('.per-image-card')).toHaveLength(2)
    // 点评两章（group-compare.html L156-160）：无 CRITIQUE 章
    expect(wrapper.text()).toContain('对比改进建议……')
    expect(wrapper.text()).toContain('对比裁决说明……')
    // 元数据 4 项（group.js L563-567）
    const metaText = wrapper.find('.group-metadata-card').text()
    expect(metaText).toContain('照片数量')
    expect(metaText).toContain('评估耗时')
    expect(metaText).toContain('评估轮次')
    expect(metaText).toContain('评估时间')
  })

  it('结果区不含 joint 专属区块（无分数卡/接触印样/CRITIQUE 章）', async () => {
    const wrapper = await mountAndComplete()
    expect(wrapper.find('.joint-score-card').exists()).toBe(false)
    expect(wrapper.find('.result-contact-frame').exists()).toBe(false)
    // CritiqueReport showCritique=false：CRITIQUE 章节索引不渲染
    expect(wrapper.find('.group-critique-section').text()).not.toContain('专业点评')
  })

  it('排名使用原始 index 映射缩略图（§10.4 不得用 rank - 1）', async () => {
    const wrapper = await mountAndComplete()
    // rank=1 对应 index=1（ENTRY_B dusk.jpg）——winner 卡图片 src 为 ENTRY_B objectURL
    const winnerImg = wrapper.find('.ranking-winner img')
    expect(winnerImg.attributes('src')).toBe('blob:mock-b')
  })

  it('过程区渲染（compare 排序徽章）', async () => {
    const wrapper = await mountAndComplete()
    const disclosure = wrapper.find('.report-disclosure')
    expect(disclosure.exists()).toBe(true)
  })

  it('播报：完成后 role=status 文本为「评估完成，可以查看结果」', async () => {
    const wrapper = await mountAndComplete()
    const announcer = wrapper.find('[role="status"]')
    expect(announcer.exists()).toBe(true)
    expect(announcer.text()).toBe('评估完成，可以查看结果')
  })
})

// ── 编排：上传失败 ──

describe('CompareEvaluationFlow 上传失败', () => {
  it('首失败即止：错误文案含索引且不调 startGroup', async () => {
    mockSelectedEntries()
    mocks.oss!.upload.mockRejectedValue(new Error('network'))
    const wrapper = await mountSuspended(CompareEvaluationFlow)
    await wrapper.find('.upload-zone').trigger('drop', { dataTransfer: { files: [TEST_FILE_A, TEST_FILE_B] } })
    await flushPromises()
    await wrapper.find('.group-evaluate-button').trigger('click')
    await flushPromises()
    // 首失败即止（group.js L310-314）：第二张不上传
    expect(mocks.oss!.upload).toHaveBeenCalledTimes(1)
    expect(mocks.stream!.startGroup).not.toHaveBeenCalled()
    // 错误文案含索引（review.groupUploadFailed）
    expect(wrapper.text()).toContain('第 1/2 张照片准备失败')
    // 无结果区
    expect(wrapper.find('.group-results').exists()).toBe(false)
  })
})

// ── 编排：失效语义（group.js L117-121 / L1083-1087）──

describe('CompareEvaluationFlow 失效语义', () => {
  it('结果态下门类变更清空结果', async () => {
    const wrapper = await mountAndComplete()
    expect(wrapper.find('.group-results').exists()).toBe(true)
    await wrapper.find('select').setValue('portrait')
    await flushPromises()
    expect(wrapper.find('.group-results').exists()).toBe(false)
  })

  it('结果态下选片变更清空结果', async () => {
    const wrapper = await mountAndComplete()
    expect(wrapper.find('.group-results').exists()).toBe(true)
    // 模拟选片变更：移除一张 → selectionChange 事件
    mocks.selection!.entries.value = [ENTRY_A]
    mocks.selection!.removeEntry.mockImplementation(() => {
      mocks.selection!.entries.value = [ENTRY_A]
    })
    await wrapper.find('.group-preview-card .preview-remove, .group-preview-card button').trigger('click')
    await flushPromises()
    expect(wrapper.find('.group-results').exists()).toBe(false)
  })
})

// ── 编排：perImage 守卫（group.js L854 / DESIGN §9.14）──

describe('CompareEvaluationFlow perImage 守卫', () => {
  it('perImage 为空时逐图明细区不渲染', async () => {
    mockSelectedEntries()
    mocks.oss!.upload
      .mockResolvedValueOnce({ url: 'https://oss.example/dawn.jpg', key: 'k1', deduplicated: false, fallback: false })
      .mockResolvedValueOnce({ url: 'https://oss.example/dusk.jpg', key: 'k2', deduplicated: false, fallback: false })
    const { perImage: _dropped, ...fixtureWithoutPerImage } = COMPARE_RESULT_FIXTURE
    mocks.stream!.startGroup.mockImplementation(async (_options: unknown, callbacks: { onComplete: (result: unknown) => void }) => {
      mocks.stream!.phase.value = 'streaming'
      callbacks.onComplete(fixtureWithoutPerImage)
    })
    const wrapper = await mountSuspended(CompareEvaluationFlow)
    await wrapper.find('.upload-zone').trigger('drop', { dataTransfer: { files: [TEST_FILE_A, TEST_FILE_B] } })
    await flushPromises()
    await wrapper.find('.group-evaluate-button').trigger('click')
    await flushPromises()
    expect(wrapper.find('.group-results').exists()).toBe(true)
    expect(wrapper.find('.per-image-section').exists()).toBe(false)
  })
})

// ── 编排：flicker 防护（uploading 间隙 isEvaluating 恒 true）──

describe('CompareEvaluationFlow flicker 防护', () => {
  it('上传循环期间 loading 恒为 true（uploading 间隙不解锁按钮）', async () => {
    mockSelectedEntries()
    const loadingStates: boolean[] = []
    let resolveFirst!: (value: unknown) => void
    mocks.oss!.upload
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
      .mockImplementationOnce(async () => ({ url: 'https://oss.example/dusk.jpg', key: 'k2', deduplicated: false, fallback: false }))
    mocks.stream!.startGroup.mockImplementation(async (_options: unknown, callbacks: { onComplete: (result: unknown) => void }) => {
      mocks.stream!.phase.value = 'streaming'
      callbacks.onComplete(COMPARE_RESULT_FIXTURE)
    })
    const wrapper = await mountSuspended(CompareEvaluationFlow)
    await wrapper.find('.upload-zone').trigger('drop', { dataTransfer: { files: [TEST_FILE_A, TEST_FILE_B] } })
    await flushPromises()
    await wrapper.find('.group-evaluate-button').trigger('click')
    // 第一张上传中
    loadingStates.push(wrapper.find('.group-evaluate-button').attributes('disabled') !== undefined)
    // 第一张完成、第二张开始前的间隙（uploading=false 但 preparing=true）
    resolveFirst({ url: 'https://oss.example/dawn.jpg', key: 'k1', deduplicated: false, fallback: false })
    await vi.waitFor(() => {
      expect(mocks.oss!.upload).toHaveBeenCalledTimes(2)
    })
    loadingStates.push(wrapper.find('.group-evaluate-button').attributes('disabled') !== undefined)
    await flushPromises()
    // 全程锁定：两次采样均为 disabled
    expect(loadingStates).toEqual([true, true])
  })

  it('上传进度文案含逐张索引（group.js L305-307）', async () => {
    mockSelectedEntries()
    let resolveFirst!: (value: unknown) => void
    mocks.oss!.upload
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
      .mockImplementationOnce(async () => ({ url: 'https://oss.example/dusk.jpg', key: 'k2', deduplicated: false, fallback: false }))
    mocks.stream!.startGroup.mockResolvedValue(undefined)
    const wrapper = await mountSuspended(CompareEvaluationFlow)
    await wrapper.find('.upload-zone').trigger('drop', { dataTransfer: { files: [TEST_FILE_A, TEST_FILE_B] } })
    await flushPromises()
    await wrapper.find('.group-evaluate-button').trigger('click')
    await flushPromises()
    // 第一张上传中：主文案含索引，副文案为文件名
    expect(wrapper.find('.review-progress').text()).toContain('第 1/2 张 · 正在准备照片')
    expect(wrapper.find('.review-progress').text()).toContain('dawn.jpg')
    resolveFirst({ url: 'https://oss.example/dawn.jpg', key: 'k1', deduplicated: false, fallback: false })
    await flushPromises()
  })
})
