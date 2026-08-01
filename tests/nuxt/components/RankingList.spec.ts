import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import RankingList from '~/components/evaluation/RankingList.vue'
import RankingCard from '~/components/evaluation/RankingCard.vue'
import type { RankingItem } from '#shared/types/evaluation'
import type { ImageEntry } from '~/composables/useImageSelection'

/** 构造 RankingItem 形状 mock */
function createItem(overrides: Partial<RankingItem> = {}): RankingItem {
  return {
    index: 0,
    rank: 1,
    score: 8.5,
    rationale: '光影层次丰富。',
    ...overrides,
  }
}

/** 构造 ImageEntry 形状 mock（先例 ContactSheet.spec.ts L7-16） */
function createEntry(index: number): ImageEntry {
  return {
    id: `entry-${index}`,
    identity: `photo-${index}.jpg:1024:1722400000000`,
    file: new File([], `photo-${index}.jpg`, { type: 'image/jpeg' }),
    objectURL: `blob:mock-${index}`,
    width: 1200,
    height: 800,
  }
}

/** 乱序排名数据（group.js L657 排序行为验证前提） */
const shuffledItems = [
  createItem({ index: 2, rank: 3, score: 6.2 }),
  createItem({ index: 0, rank: 1, score: 8.9 }),
  createItem({ index: 1, rank: 2, score: 7.4 }),
]

const entries = [createEntry(0), createEntry(1), createEntry(2)]

describe('RankingList', () => {
  // ── 排序（锚点 group.js L657）──

  it('乱序 items 按 rank 升序渲染', async () => {
    const wrapper = await mountSuspended(RankingList, {
      props: { items: shuffledItems, entries },
    })
    const badges = wrapper.findAll('.ranking-position')
    expect(badges.map((el) => el.text())).toEqual(['#1', '#2', '#3'])
  })

  it('卡数等于 items 数', async () => {
    const wrapper = await mountSuspended(RankingList, {
      props: { items: shuffledItems, entries },
    })
    expect(wrapper.findAll('article.ranking-card')).toHaveLength(3)
  })

  // ── entries 连接（锚点 group.js L635-637 getEntryByIndex）──

  it('entries 按 item.index 配对：各卡 img src 对应', async () => {
    const wrapper = await mountSuspended(RankingList, {
      props: { items: shuffledItems, entries },
    })
    const images = wrapper.findAll('.ranking-media img')
    // rank 升序后：index 0 → blob:mock-0, index 1 → blob:mock-1, index 2 → blob:mock-2
    expect(images[0]!.attributes('src')).toBe('blob:mock-0')
    expect(images[1]!.attributes('src')).toBe('blob:mock-1')
    expect(images[2]!.attributes('src')).toBe('blob:mock-2')
  })

  it('index 越界时该卡渲染缺图占位', async () => {
    const items = [
      createItem({ index: 0, rank: 1 }),
      createItem({ index: 9, rank: 2 }),
    ]
    const wrapper = await mountSuspended(RankingList, {
      props: { items, entries: [createEntry(0)] },
    })
    const cards = wrapper.findAll('article.ranking-card')
    expect(cards[0]!.find('img').exists()).toBe(true)
    expect(cards[1]!.find('.media-missing').exists()).toBe(true)
    expect(cards[1]!.find('img').exists()).toBe(false)
  })

  // ── 文案 props 透传 ──

  it('文案 props 透传至子卡', async () => {
    const wrapper = await mountSuspended(RankingList, {
      props: {
        items: shuffledItems,
        entries,
        winnerTitle: 'Best of Group',
        rankTitleTemplate: 'Rank {rank}',
        missingText: 'Photo removed',
      },
    })
    const cards = wrapper.findAllComponents(RankingCard)
    expect(cards).toHaveLength(3)
    for (const card of cards) {
      expect(card.props('winnerTitle')).toBe('Best of Group')
      expect(card.props('rankTitleTemplate')).toBe('Rank {rank}')
      expect(card.props('missingText')).toBe('Photo removed')
    }
  })

  // ── 边界状态 ──

  it('空 items 时根节点存在但无子卡', async () => {
    const wrapper = await mountSuspended(RankingList, {
      props: { items: [], entries },
    })
    expect(wrapper.find('div.ranking-list').exists()).toBe(true)
    expect(wrapper.findAll('article.ranking-card')).toHaveLength(0)
  })

  // ── attrs 透传（先例 CritiqueReport.spec.ts L122-130）──

  it('attrs 落根元素', async () => {
    const wrapper = await mountSuspended(RankingList, {
      props: { items: shuffledItems, entries },
      attrs: { id: 'ranking-list', class: 'extra' },
    })
    expect(wrapper.attributes('id')).toBe('ranking-list')
    expect(wrapper.classes()).toContain('extra')
    expect(wrapper.classes()).toContain('ranking-list')
  })
})
