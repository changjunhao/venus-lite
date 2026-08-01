import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { Ref } from 'vue'
import { DOMWrapper, flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import SingleEvaluationFlow, {
  buildSingleMetadataItems,
  fill,
  mapProcessSteps,
  normalizeChallenges,
  severityVariant,
  type ProcessStepLabels,
} from '~/components/business/SingleEvaluationFlow.vue'

// 测试环境强制 zh locale：happy-dom 的 navigator.language 为 en-US，
// i18n detectBrowserLanguage 会探测为 en；cookie 优先生效（nuxt.config cookieKey 'venus-locale'）
document.cookie = 'venus-locale=zh'

// nuxt 测试环境文件间共享模块缓存（同 worker 内隔离关闭）：
// 本文件的 vi.mock 工厂会泄漏给后续文件（GroupEvaluationInput.spec 等
// 依赖真实 composable），须在文件结束时解除
afterAll(() => {
  vi.unmock('~/composables/useImageSelection')
  vi.unmock('~/composables/useExif')
  vi.unmock('~/composables/useOssUpload')
  vi.unmock('~/composables/useEvaluationStream')
  vi.unmock('~/composables/useEvalMetadata')
  vi.unmock('~/composables/useShareImage')
})

// ── composable mock 句柄（vi.hoisted 先于模块加载；工厂内赋值，测试内读写）──

interface SelectionMock {
  entries: Ref<unknown[]>
  errors: Ref<unknown[]>
  addFiles: Mock
}
interface ExifMock {
  exif: Ref<Record<string, unknown> | null>
  extract: Mock
}
interface OssMock {
  uploading: Ref<boolean>
  upload: Mock
}
interface StreamMock {
  phase: Ref<string>
  steps: Ref<unknown[]>
  reasoningBlocks: Ref<unknown[]>
  startSingle: Mock
}
interface MetadataMock {
  metadata: Ref<unknown>
  fetch: Mock
}
interface ShareMock {
  phase: Ref<string>
  previewUrl: Ref<string | null>
  generate: Mock
  download: Mock
  reset: Mock
}

const mocks = vi.hoisted(() => ({
  selection: null as SelectionMock | null,
  exif: null as ExifMock | null,
  oss: null as OssMock | null,
  stream: null as StreamMock | null,
  metadata: null as MetadataMock | null,
  share: null as ShareMock | null,
}))

// ── vi.mock：六个编排 composable 替换为可控桩（保留具名导出供子组件消费）──

vi.mock('~/composables/useImageSelection', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/composables/useImageSelection')>()
  const { shallowRef } = await vi.importActual<typeof import('vue')>('vue')
  const handle: SelectionMock = { entries: shallowRef([]), errors: shallowRef([]), addFiles: vi.fn() }
  mocks.selection = handle
  return {
    ...actual,
    useImageSelection: () => ({
      entries: handle.entries,
      errors: handle.errors,
      addFiles: handle.addFiles,
      removeEntry: vi.fn(),
      moveEntry: vi.fn(),
      clear: vi.fn(),
    }),
  }
})

vi.mock('~/composables/useExif', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/composables/useExif')>()
  const { shallowRef } = await vi.importActual<typeof import('vue')>('vue')
  const handle: ExifMock = { exif: shallowRef(null), extract: vi.fn() }
  mocks.exif = handle
  return {
    ...actual,
    useExif: () => ({ exif: handle.exif, extracting: shallowRef(false), extract: handle.extract, reset: vi.fn() }),
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
    startSingle: vi.fn(),
  }
  mocks.stream = handle
  return {
    ...actual,
    useEvaluationStream: () => ({
      phase: handle.phase,
      steps: handle.steps,
      reasoningBlocks: handle.reasoningBlocks,
      error: shallowRef(null),
      startSingle: handle.startSingle,
      startGroup: vi.fn(),
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

vi.mock('~/composables/useShareImage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/composables/useShareImage')>()
  const { shallowRef } = await vi.importActual<typeof import('vue')>('vue')
  const handle: ShareMock = {
    phase: shallowRef('idle'),
    previewUrl: shallowRef(null),
    generate: vi.fn(),
    download: vi.fn(),
    reset: vi.fn(),
  }
  mocks.share = handle
  return {
    ...actual,
    useShareImage: () => ({
      phase: handle.phase,
      error: shallowRef(null),
      previewUrl: handle.previewUrl,
      filename: shallowRef(''),
      generate: handle.generate,
      download: handle.download,
      reset: handle.reset,
      revokePreview: vi.fn(),
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

/** 归一化评估结果（useEvaluationStream.normalizeResult 输出形状：顶层 camelCase，process 子结构保留 snake_case） */
const RESULT_FIXTURE = {
  imageUrl: 'https://oss.example/sunset.jpg',
  genre: 'landscape',
  sceneType: 'mountain',
  totalScore: 8.4,
  dimensions: { composition: 8.5, light: 8.2 },
  critique: '构图稳健……',
  suggestions: '压暗高光……',
  arbitrationNotes: '综合双方论证……',
  process: {
    proposal: {
      result: { total_score: 8.5, scene_type: 'mountain', critique: '初评内容' },
      reasoning: '提案推理',
    },
    critique: {
      result: {
        severity: 'MEDIUM',
        suggested_total_score: 8.0,
        overall_assessment: '整体质疑',
        challenges: [
          { dimension: 'light', issue: '高光溢出', evidence: '右上角天空', suggested_score: 8.0 },
        ],
      },
      reasoning: '批判推理',
    },
    arbitration: {
      result: { total_score: 8.4, arbitration_notes: '裁决内容' },
      reasoning: '仲裁推理',
    },
  },
  metadata: { evaluatedAt: '2026-08-01T10:00:00.000Z', durationMs: 12345, rounds: 3 },
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
}

const TEST_FILE = new File(['photo'], 'sunset.jpg', { type: 'image/jpeg' })

/** 注入一张已选图片（addFiles 桩模拟 useImageSelection single 模式替换语义） */
function mockSelectedEntry(): void {
  mocks.selection!.addFiles.mockImplementation(async () => {
    mocks.selection!.entries.value = [{
      id: 'image-1',
      identity: 'sunset.jpg:5:0',
      file: TEST_FILE,
      objectURL: 'blob:mock-1',
      width: 1920,
      height: 1080,
    }]
  })
}

/** happy path：选片 → 上传成功 → 流式完成回放归一结果 */
async function mountAndComplete(): Promise<ReturnType<typeof mountSuspended>> {
  mockSelectedEntry()
  mocks.oss!.upload.mockResolvedValue({ url: 'https://oss.example/sunset.jpg', key: 'k', deduplicated: false, fallback: false })
  mocks.stream!.startSingle.mockImplementation(async (_options: unknown, callbacks: { onComplete: (result: unknown) => void }) => {
    mocks.stream!.phase.value = 'streaming'
    mocks.stream!.phase.value = 'complete'
    callbacks.onComplete(RESULT_FIXTURE)
  })
  const wrapper = await mountSuspended(SingleEvaluationFlow)
  await wrapper.find('.upload-zone').trigger('drop', { dataTransfer: { files: [TEST_FILE] } })
  await flushPromises()
  await wrapper.find('.btn-primary').trigger('click')
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.selection!.entries.value = []
  mocks.selection!.errors.value = []
  mocks.exif!.exif.value = null
  mocks.oss!.uploading.value = false
  mocks.stream!.phase.value = 'idle'
  mocks.stream!.steps.value = []
  mocks.stream!.reasoningBlocks.value = []
  mocks.share!.phase.value = 'idle'
  mocks.share!.previewUrl.value = null
  // 清理 Teleport 到 body 的弹窗残留（BaseModal L61）
  document.body.replaceChildren()
})

// ── 纯函数：fill ──

describe('fill', () => {
  it('替换已知占位符', () => {
    expect(fill('评分：{score}', { score: '8.5' })).toBe('评分：8.5')
  })

  it('同一占位符多次出现全部替换', () => {
    expect(fill('{a}-{a}', { a: 'x' })).toBe('x-x')
  })

  it('未知占位符原样保留', () => {
    expect(fill('{known} {unknown}', { known: 'v' })).toBe('v {unknown}')
  })

  it('数字参数转字符串', () => {
    expect(fill('{width}×{height}', { width: 7680, height: 4320 })).toBe('7680×4320')
  })
})

// ── 纯函数：severityVariant（app.js L696 || 'LOW' 兜底）──

describe('severityVariant', () => {
  it('三档映射', () => {
    expect(severityVariant('LOW')).toBe('severity-low')
    expect(severityVariant('MEDIUM')).toBe('severity-medium')
    expect(severityVariant('HIGH')).toBe('severity-high')
  })

  it('小写输入同样映射', () => {
    expect(severityVariant('high')).toBe('severity-high')
  })

  it('未知/空值回退 low', () => {
    expect(severityVariant('')).toBe('severity-low')
    expect(severityVariant(undefined)).toBe('severity-low')
    expect(severityVariant('CRITICAL')).toBe('severity-low')
  })
})

// ── 纯函数：normalizeChallenges（app.js L708-714 双写归一）──

describe('normalizeChallenges', () => {
  it('非数组返回空数组', () => {
    expect(normalizeChallenges(undefined)).toEqual([])
    expect(normalizeChallenges({})).toEqual([])
  })

  it('snake_case 字段读取', () => {
    const items = normalizeChallenges([
      { dimension: 'light', issue: '高光溢出', evidence: '右上角', suggested_score: 8.0 },
    ])
    expect(items).toEqual([{ dimension: 'light', issue: '高光溢出', evidence: '右上角', suggestedScore: 8.0 }])
  })

  it('camelCase 字段读取', () => {
    const items = normalizeChallenges([{ dimension: 'composition', suggestedScore: 7.5 }])
    expect(items[0]!.suggestedScore).toBe(7.5)
  })

  it('建议分非有限值归 null（group.js L952-954 健壮版）', () => {
    const items = normalizeChallenges([
      { dimension: 'a', suggested_score: Number.NaN },
      { dimension: 'b' },
    ])
    expect(items[0]!.suggestedScore).toBeNull()
    expect(items[1]!.suggestedScore).toBeNull()
  })

  it('缺失字段归空串，跳过非对象项', () => {
    const items = normalizeChallenges([{ issue: '仅问题' }, 'garbage', null])
    expect(items).toHaveLength(1)
    expect(items[0]).toEqual({ dimension: '', issue: '仅问题', evidence: '', suggestedScore: null })
  })
})

// ── 纯函数：mapProcessSteps（app.js renderProcess L663-766）──

describe('mapProcessSteps', () => {
  const FULL_PROCESS = {
    proposal: {
      result: { total_score: 8.5, scene_type: 'mountain', critique: '初评内容' },
      reasoning: '提案推理',
    },
    critique: {
      result: {
        severity: 'MEDIUM',
        suggested_total_score: 8.0,
        overall_assessment: '整体质疑',
        challenges: [{ dimension: 'light', issue: '高光溢出', evidence: '右上角', suggested_score: 8.0 }],
      },
      reasoning: '批判推理',
    },
    revision: {
      result: { total_score: 8.2, critique: '修正内容' },
      reasoning: '修正推理',
    },
    arbitration: {
      result: { total_score: 8.4, arbitration_notes: '裁决内容' },
      reasoning: '仲裁推理',
    },
  }

  it('四步齐全时按 proposal→critique→revision→arbitration 排序', () => {
    const steps = mapProcessSteps(FULL_PROCESS, LABELS)
    expect(steps.map(s => s.kind)).toEqual(['proposal', 'critique', 'revision', 'arbitration'])
  })

  it('无 revision 时仅三步（条件步骤，DESIGN §9.9）', () => {
    const { revision: _revision, ...rest } = FULL_PROCESS
    const steps = mapProcessSteps(rest, LABELS)
    expect(steps.map(s => s.kind)).toEqual(['proposal', 'critique', 'arbitration'])
  })

  it('proposal 徽章：评分 toFixed(1) + 场景徽章经 resolveScene 解析', () => {
    const steps = mapProcessSteps(FULL_PROCESS, LABELS, scene => `${scene}-resolved`)
    const proposal = steps[0]!
    expect(proposal.title).toBe('提案者初评')
    expect(proposal.badges).toEqual([
      { variant: 'step-score', text: '评分：8.5' },
      { variant: 'step-tag', text: '场景：mountain-resolved' },
    ])
    expect(proposal.content).toBe('初评内容')
  })

  it('scene 为空时不渲染场景徽章', () => {
    const process = { proposal: { result: { total_score: 7.0, critique: '无场景' } } }
    const steps = mapProcessSteps(process, LABELS)
    expect(steps[0]!.badges).toEqual([{ variant: 'step-score', text: '评分：7.0' }])
  })

  it('critique 徽章：severity variant + 质疑程度文案 + 建议分', () => {
    const steps = mapProcessSteps(FULL_PROCESS, LABELS)
    const critique = steps[1]!
    expect(critique.badges).toEqual([
      { variant: 'severity-medium', text: '质疑程度：中' },
      { variant: 'step-score', text: '建议：8.0' },
    ])
    expect(critique.content).toBe('整体质疑')
    expect(critique.challenges).toEqual([
      { dimension: 'light', issue: '高光溢出', evidence: '右上角', suggestedScore: 8.0 },
    ])
  })

  it('建议分缺失时不渲染建议徽章（app.js L704 条件）', () => {
    const process = { critique: { result: { severity: 'LOW', overall_assessment: '轻微' } } }
    const steps = mapProcessSteps(process, LABELS)
    expect(steps[0]!.badges).toEqual([{ variant: 'severity-low', text: '质疑程度：低' }])
  })

  it('revision 徽章「修正后」，arbitration 徽章「最终」+ arbitration_notes 内容', () => {
    const steps = mapProcessSteps(FULL_PROCESS, LABELS)
    expect(steps[2]!.badges).toEqual([{ variant: 'step-score', text: '修正后：8.2' }])
    expect(steps[3]!.badges).toEqual([{ variant: 'step-score', text: '最终：8.4' }])
    expect(steps[3]!.content).toBe('裁决内容')
  })

  it('camelCase 分数字段兼容（totalScore / arbitrationNotes）', () => {
    const process = {
      proposal: { result: { totalScore: 7.5, critique: '' } },
      arbitration: { result: { totalScore: 7.8, arbitrationNotes: '裁决' } },
    }
    const steps = mapProcessSteps(process, LABELS)
    expect(steps[0]!.badges[0]!.text).toBe('评分：7.5')
    expect(steps[1]!.content).toBe('裁决')
  })

  it('分数缺失时回退 "-"（app.js L684 || \'-\'）', () => {
    const steps = mapProcessSteps({ proposal: { result: { critique: '无分数' } } }, LABELS)
    expect(steps[0]!.badges[0]!.text).toBe('评分：-')
  })

  it('reasoning 空串归 null（ProcessStep 双条件守卫），toggle 文案恒填充', () => {
    const process = { proposal: { result: { total_score: 8.0, critique: '' }, reasoning: '' } }
    const steps = mapProcessSteps(process, LABELS)
    expect(steps[0]!.reasoning).toBeNull()
    expect(steps[0]!.reasoningToggle).toBe('提案者分析过程')
  })

  it('无 wrapper 时回退对象本身（app.js L669-671 data?.result || data）', () => {
    const steps = mapProcessSteps({ arbitration: { total_score: 9.0, arbitration_notes: '裸结果' } }, LABELS)
    expect(steps[0]!.badges[0]!.text).toBe('最终：9.0')
    expect(steps[0]!.content).toBe('裸结果')
  })

  it('空过程返回空数组', () => {
    expect(mapProcessSteps({}, LABELS)).toEqual([])
  })
})

// ── 纯函数：buildSingleMetadataItems（app.js L558-562）──

describe('buildSingleMetadataItems', () => {
  const META_LABELS = { duration: '评估耗时', rounds: '评估轮次', time: '评估时间' }

  it('单图 3 项，顺序为耗时/轮次/时间', () => {
    const items = buildSingleMetadataItems(
      { durationMs: 12345, rounds: 3, evaluatedAt: '2026-08-01T10:00:00.000Z' },
      META_LABELS,
      'zh-CN',
    )
    expect(items.map(i => i.label)).toEqual(['评估耗时', '评估轮次', '评估时间'])
    expect(items[0]!.value).toBe('12.3 秒')
    expect(items[1]!.value).toBe('3')
    expect(items[2]!.value).not.toBe('')
  })

  it('毫秒档耗时（<1000ms）', () => {
    const items = buildSingleMetadataItems({ durationMs: 450 }, META_LABELS, 'zh-CN')
    expect(items[0]!.value).toBe('450 毫秒')
  })

  it('rounds 缺失回退 "-"（app.js L561）', () => {
    const items = buildSingleMetadataItems({ durationMs: 1000 }, META_LABELS, 'zh-CN')
    expect(items[1]!.value).toBe('-')
  })

  it('meta 为 null 时全部兜底', () => {
    const items = buildSingleMetadataItems(null, META_LABELS, 'zh-CN')
    expect(items[0]!.value).toBe('0 毫秒')
    expect(items[1]!.value).toBe('-')
  })

  it('locale 传参生效（en 单位）', () => {
    const items = buildSingleMetadataItems({ durationMs: 12345, rounds: 4 }, { duration: 'Duration', rounds: 'Rounds', time: 'At' }, 'en-US')
    expect(items[0]!.value).toBe('12.3 s')
  })
})

// ── 编排：mount 测试（vi.mock 六 composable 桩）──

describe('SingleEvaluationFlow 编排', () => {
  // ── 初始态（single.html L54-104 输入卡结构）──

  it('初始态：输入卡结构完整，无结果区与进度卡', async () => {
    const wrapper = await mountSuspended(SingleEvaluationFlow)

    expect(wrapper.find('.input-sheet').exists()).toBe(true)
    expect(wrapper.find('.input-sheet-header h2').text()).toBe('选择一张作品')
    expect(wrapper.find('.input-sheet-header p').text()).toContain('选择摄影门类并上传照片')
    expect(wrapper.find('.image-count-badge').exists()).toBe(true)
    expect(wrapper.find('select').exists()).toBe(true)
    expect(wrapper.find('.upload-zone').exists()).toBe(true)
    expect(wrapper.find('.btn-primary').text()).toBe('开始单图评估')
    expect(wrapper.find('.single-preview').exists()).toBe(false)
    expect(wrapper.find('.review-progress').exists()).toBe(false)
    expect(wrapper.find('.single-results').exists()).toBe(false)
    expect(wrapper.find('[role="status"]').text()).toBe('')
    wrapper.unmount()
  })

  // ── 选片（app.js L212-226）──

  it('拖入照片后渲染预览并即时提取 EXIF', async () => {
    mockSelectedEntry()
    mocks.exif!.extract.mockImplementation(async () => {
      mocks.exif!.exif.value = { cameraModel: 'X100V' }
      return mocks.exif!.exif.value
    })
    const wrapper = await mountSuspended(SingleEvaluationFlow)

    await wrapper.find('.upload-zone').trigger('drop', { dataTransfer: { files: [TEST_FILE] } })
    await flushPromises()

    expect(mocks.selection!.addFiles).toHaveBeenCalledWith([TEST_FILE])
    expect(mocks.exif!.extract).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.single-preview').exists()).toBe(true)
    wrapper.unmount()
  })

  it('选片校验失败时映射错误码为 i18n 文案（app.js L180-209）', async () => {
    mocks.selection!.addFiles.mockImplementation(async () => {
      mocks.selection!.errors.value = [{ code: 'exceeds-8k', fileName: 'huge.jpg', params: { width: 8000, height: 6000 } }]
    })
    const wrapper = await mountSuspended(SingleEvaluationFlow)

    await wrapper.find('.upload-zone').trigger('drop', { dataTransfer: { files: [TEST_FILE] } })
    await flushPromises()

    expect(wrapper.find('.error-message').text()).toBe('照片尺寸为 8000×6000，超过 8K 上限（7680×4320），请缩小后重试')
    wrapper.unmount()
  })

  // ── 评估（app.js L243-405）──

  it('未选照片点击评估：行内错误提示（app.js L247-250）', async () => {
    const wrapper = await mountSuspended(SingleEvaluationFlow)
    await wrapper.find('.btn-primary').trigger('click')
    await flushPromises()

    expect(wrapper.find('.error-message').text()).toBe('请先选择一张照片')
    expect(mocks.oss!.upload).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('happy path：上传 → 流式完成 → 结果区渲染完整报告', async () => {
    mocks.exif!.extract.mockImplementation(async () => {
      mocks.exif!.exif.value = { cameraModel: 'X100V' }
      return mocks.exif!.exif.value
    })
    const wrapper = await mountAndComplete()

    // 请求接线
    expect(mocks.oss!.upload).toHaveBeenCalledWith(TEST_FILE)
    expect(mocks.stream!.startSingle).toHaveBeenCalledTimes(1)
    const [options] = mocks.stream!.startSingle.mock.calls[0]!
    expect(options.imageUrl).toBe('https://oss.example/sunset.jpg')
    expect(options.genre).toBeUndefined() // auto → undefined（app.js L359）
    expect(options.context).toEqual({ exif: { cameraModel: 'X100V' } })

    // 结果区（single.html L125-188）
    expect(wrapper.find('.single-results').exists()).toBe(true)
    expect(wrapper.find('.result-masthead h2').text()).toBe('单图评估结果')
    expect(wrapper.find('.result-tag').text()).toBe('landscape · 未分类')
    expect(wrapper.find('.result-photo-frame img').attributes('src')).toBe('blob:mock-1')
    expect(wrapper.find('.score-number').text()).toBe('8.4')
    expect(wrapper.findAll('.dimension-item')).toHaveLength(2)
    expect(wrapper.findAll('.process-step')).toHaveLength(3)
    // 徽章模板经 template()（locale AST loc.source）保留占位符 + fill 插值
    expect(wrapper.find('.step-title').text()).toContain('评分：8.5')
    expect(wrapper.find('.step-title').text()).toContain('场景：mountain')
    expect(wrapper.find('.challenge-item').exists()).toBe(true)
    expect(wrapper.find('.thinking-toggle').text()).toContain('提案者分析过程')
    expect(wrapper.find('.exif-grid').exists()).toBe(true)
    expect(wrapper.findAll('.meta-item')).toHaveLength(3)
    expect(wrapper.find('.btn-share').exists()).toBe(true)

    // 进度卡隐藏 + §14.5 完成播报一次
    expect(wrapper.find('.review-progress').exists()).toBe(false)
    expect(wrapper.find('[role="status"]').text()).toBe('评估完成，可以查看结果')
    wrapper.unmount()
  })

  it('门类选择传入流式请求（app.js L359 genre !== auto）', async () => {
    mockSelectedEntry()
    mocks.oss!.upload.mockResolvedValue({ url: 'https://oss.example/sunset.jpg', key: 'k', deduplicated: false, fallback: false })
    mocks.stream!.startSingle.mockResolvedValue(undefined)
    const wrapper = await mountSuspended(SingleEvaluationFlow)

    await wrapper.find('.upload-zone').trigger('drop', { dataTransfer: { files: [TEST_FILE] } })
    await flushPromises()
    await wrapper.find('select').setValue('portrait')
    await wrapper.find('.btn-primary').trigger('click')
    await flushPromises()

    const [options] = mocks.stream!.startSingle.mock.calls[0]!
    expect(options.genre).toBe('portrait')
    wrapper.unmount()
  })

  it('门类变更使旧结果失效（component-plan §1.3）', async () => {
    const wrapper = await mountAndComplete()
    expect(wrapper.find('.single-results').exists()).toBe(true)

    await wrapper.find('select').setValue('portrait')
    await flushPromises()

    expect(wrapper.find('.single-results').exists()).toBe(false)
    expect(mocks.share!.reset).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('上传失败：照片准备失败错误，不发起评估（app.js L333-337）', async () => {
    mockSelectedEntry()
    mocks.oss!.upload.mockRejectedValue(new Error('sts-failed'))
    const wrapper = await mountSuspended(SingleEvaluationFlow)

    await wrapper.find('.upload-zone').trigger('drop', { dataTransfer: { files: [TEST_FILE] } })
    await flushPromises()
    await wrapper.find('.btn-primary').trigger('click')
    await flushPromises()

    expect(wrapper.find('.error-message').text()).toBe('照片准备失败，请稍后重试')
    expect(mocks.stream!.startSingle).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('流式错误：onError 回调显示错误，结果区不渲染', async () => {
    mockSelectedEntry()
    mocks.oss!.upload.mockResolvedValue({ url: 'https://oss.example/sunset.jpg', key: 'k', deduplicated: false, fallback: false })
    mocks.stream!.startSingle.mockImplementation(async (_options: unknown, callbacks: { onError?: (message: string) => void }) => {
      mocks.stream!.phase.value = 'streaming'
      mocks.stream!.phase.value = 'error'
      callbacks.onError?.('评估未能完成，请重试')
    })
    const wrapper = await mountSuspended(SingleEvaluationFlow)

    await wrapper.find('.upload-zone').trigger('drop', { dataTransfer: { files: [TEST_FILE] } })
    await flushPromises()
    await wrapper.find('.btn-primary').trigger('click')
    await flushPromises()

    expect(wrapper.find('.error-message').text()).toBe('评估未能完成，请重试')
    expect(wrapper.find('.single-results').exists()).toBe(false)
    wrapper.unmount()
  })

  // ── 进度文案（§15.4 派生自 phase + steps）──

  it('上传中显示「正在准备照片…」，流开始无步骤时显示「正在开始评估…」', async () => {
    mockSelectedEntry()
    let resolveUpload: (value?: unknown) => void = () => {}
    mocks.oss!.upload.mockImplementation(() => {
      mocks.oss!.uploading.value = true
      return new Promise((resolve) => {
        resolveUpload = () => {
          mocks.oss!.uploading.value = false
          resolve({ url: 'https://oss.example/sunset.jpg', key: 'k', deduplicated: false, fallback: false })
        }
      })
    })
    mocks.stream!.startSingle.mockImplementation(() => {
      mocks.stream!.phase.value = 'streaming'
      return new Promise(() => {}) // 挂起
    })
    const wrapper = await mountSuspended(SingleEvaluationFlow)
    await wrapper.find('.upload-zone').trigger('drop', { dataTransfer: { files: [TEST_FILE] } })
    await flushPromises()

    await wrapper.find('.btn-primary').trigger('click')
    await flushPromises()

    expect(wrapper.find('.review-progress').exists()).toBe(true)
    expect(wrapper.find('.loading-text').text()).toBe('正在准备照片…')
    expect(wrapper.find('.btn-primary').attributes('disabled')).toBeDefined()

    resolveUpload()
    await flushPromises()
    expect(wrapper.find('.loading-text').text()).toBe('正在开始评估…')
    wrapper.unmount()
  })

  it('步骤 active 项派生主/副文案（app.js L417-424 label + hint）', async () => {
    mockSelectedEntry()
    mocks.oss!.upload.mockResolvedValue({ url: 'https://oss.example/sunset.jpg', key: 'k', deduplicated: false, fallback: false })
    mocks.stream!.startSingle.mockImplementation((_options: unknown, callbacks: { onGenreDetected?: (genre: string) => void }) => {
      mocks.stream!.phase.value = 'streaming'
      mocks.stream!.steps.value = [
        { agent: 'genreDetector', label: '门类识别', status: 'done' },
        { agent: 'proposer', label: '提案者初评', status: 'pending' },
        { agent: 'critic', label: '批判者质疑', status: 'pending' },
        { agent: 'arbiter', label: '仲裁者裁决', status: 'pending' },
      ]
      callbacks.onGenreDetected?.('landscape')
      return new Promise(() => {})
    })
    const wrapper = await mountSuspended(SingleEvaluationFlow)
    await wrapper.find('.upload-zone').trigger('drop', { dataTransfer: { files: [TEST_FILE] } })
    await flushPromises()
    await wrapper.find('.btn-primary').trigger('click')
    await flushPromises()

    // 门类识别完成、下一 agent 未开始：门类文案（app.js L457-463），done 态无副文案
    expect(wrapper.find('.loading-text').text()).toBe('摄影门类：landscape')
    expect(wrapper.find('.loading-subtext').exists()).toBe(false)

    // proposer 开始：label + hint
    mocks.stream!.steps.value = [
      { agent: 'genreDetector', label: '门类识别', status: 'done' },
      { agent: 'proposer', label: '提案者初评', status: 'active' },
      { agent: 'critic', label: '批判者质疑', status: 'pending' },
      { agent: 'arbiter', label: '仲裁者裁决', status: 'pending' },
    ]
    await flushPromises()
    expect(wrapper.find('.loading-text').text()).toBe('提案者初评中')
    expect(wrapper.find('.loading-subtext').text()).toBe('逐项评估构图、光影、主体与技术完成度')
    wrapper.unmount()
  })

  // ── 分享（app.js L254-295 / L91-120）──

  it('分享流程：生成 → 预览弹窗 → 下载并清理', async () => {
    const wrapper = await mountAndComplete()
    mocks.share!.generate.mockResolvedValue({ blob: new Blob(['poster']), filename: 'venus_20260801_1000.png' })

    await wrapper.find('.btn-share').trigger('click')
    await flushPromises()

    // 生成参数（app.js L268-284）
    expect(mocks.share!.generate).toHaveBeenCalledTimes(1)
    const shareOptions = mocks.share!.generate.mock.calls[0]![0]!
    expect(shareOptions.photoSrc).toBe('blob:mock-1')
    expect(shareOptions.totalScore).toBe(8.4)
    expect(shareOptions.genre).toBe('landscape')
    expect(shareOptions.genreLabel).toBe('landscape')
    expect(shareOptions.sceneLabel).toBe('mountain')
    expect(shareOptions.evaluatedAt).toBe('2026-08-01T10:00:00.000Z')

    // 弹窗经 Teleport 落在 body（BaseModal L61）；previewUrl 桩为 null → img 不渲染
    expect(document.body.querySelector('.modal-panel')).toBeTruthy()
    expect(document.body.querySelector('.share-preview-body img')).toBeNull()

    // 下载：先下载后关闭并 reset（app.js L111-120）
    const downloadBtn = new DOMWrapper(document.body.querySelector('.share-preview-actions .btn-primary')!)
    await downloadBtn.trigger('click')
    await flushPromises()

    expect(mocks.share!.download).toHaveBeenCalledTimes(1)
    expect(mocks.share!.reset).toHaveBeenCalled()
    await vi.waitFor(() => {
      expect(document.body.querySelector('.modal-panel')).toBeNull()
    })
    wrapper.unmount()
  })
})
