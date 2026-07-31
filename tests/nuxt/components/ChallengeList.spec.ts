import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ChallengeList from '~/components/evaluation/ChallengeList.vue'
import type { ChallengeItem, GenreMetadata } from '#shared/types/evaluation'

// 回归锚点：app.js L707-715 / group.js L944-964 challenge-list 结构
const challenges: ChallengeItem[] = [
  { dimension: 'composition', issue: '主体偏移', evidence: '三分线右侧留白过多', suggestedScore: 7.5 },
  { dimension: 'light', issue: '高光溢出', evidence: '右上角天空细节丢失', suggestedScore: null },
]

const metadata: Record<string, GenreMetadata> = {
  landscape: {
    label: '风光',
    dimensionLabels: [],
    subtypes: [],
    dimensions: [
      { key: 'composition', label: '构图' },
      { key: 'light', label: '光影' },
    ],
  },
}

describe('ChallengeList', () => {
  // ── 边界 ──

  // 回归锚点：group.js L944 challenges 为空不渲染列表
  it('challenges 为空数组时不渲染根节点', async () => {
    const wrapper = await mountSuspended(ChallengeList, { props: { challenges: [] } })
    expect(wrapper.find('.challenge-list').exists()).toBe(false)
  })

  // ── 列表渲染（回归锚点：app.js L708-714 三项结构）──

  it('渲染 <ul>/<li> 语义列表，每项含 dimension/issue/evidence', async () => {
    const wrapper = await mountSuspended(ChallengeList, { props: { challenges } })
    expect(wrapper.element.tagName).toBe('UL')
    expect(wrapper.classes()).toContain('challenge-list')

    const items = wrapper.findAll('li.challenge-item')
    expect(items).toHaveLength(2)
    expect(items[0]!.find('.challenge-issue').text()).toBe('主体偏移')
    expect(items[0]!.find('.challenge-evidence').text()).toBe('三分线右侧留白过多')
    expect(items[1]!.find('.challenge-issue').text()).toBe('高光溢出')
  })

  // ── 维度名解析（DimensionList L42 先例：resolveDimensionName 内部解析）──

  it('genre + metadata 传入时维度名解析为中文标签', async () => {
    const wrapper = await mountSuspended(ChallengeList, {
      props: { challenges, genre: 'landscape', metadata },
    })
    const dimensions = wrapper.findAll('.challenge-dimension')
    expect(dimensions[0]!.text()).toContain('构图')
    expect(dimensions[1]!.text()).toContain('光影')
  })

  // 回归锚点：venus utils.js L94 metadata 缺省回退原始 key
  it('metadata 缺省时维度名回退原始 key', async () => {
    const wrapper = await mountSuspended(ChallengeList, { props: { challenges } })
    expect(wrapper.find('.challenge-dimension').text()).toContain('composition')
  })

  // ── 建议分尾缀（回归锚点：group.js L952-954 健壮版）──

  it('suggestedScore 有值时渲染「 → x.x」尾缀（toFixed(1)）', async () => {
    const wrapper = await mountSuspended(ChallengeList, { props: { challenges } })
    expect(wrapper.find('.challenge-dimension').text()).toContain('→ 7.5')
  })

  it('suggestedScore 为 null 时不渲染箭头尾缀', async () => {
    const wrapper = await mountSuspended(ChallengeList, { props: { challenges } })
    const second = wrapper.findAll('.challenge-dimension')[1]!
    expect(second.text()).not.toContain('→')
  })

  // NaN 防御对齐 DimensionList L44 决策（修正 app.js L710 无防御缺陷）
  it('suggestedScore 为 NaN 时不渲染箭头尾缀', async () => {
    const nanChallenges: ChallengeItem[] = [
      { dimension: 'composition', issue: '问题', evidence: '证据', suggestedScore: Number.NaN },
    ]
    const wrapper = await mountSuspended(ChallengeList, { props: { challenges: nanChallenges } })
    expect(wrapper.find('.challenge-dimension').text()).not.toContain('→')
  })

  // ── 透传 ──

  it('属性透传至根元素', async () => {
    const wrapper = await mountSuspended(ChallengeList, {
      props: { challenges },
      attrs: { 'data-testid': 'challenge-list' },
    })
    expect(wrapper.find('.challenge-list').attributes('data-testid')).toBe('challenge-list')
  })
})
