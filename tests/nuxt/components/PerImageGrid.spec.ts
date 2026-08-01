import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PerImageGrid from '~/components/evaluation/PerImageGrid.vue'
import PerImageCard from '~/components/evaluation/PerImageCard.vue'
import type { PerImageDetail } from '#shared/types/evaluation'
import type { ImageEntry } from '~/composables/useImageSelection'

/** 构造 PerImageDetail 形状 mock */
function createDetail(overrides: Partial<PerImageDetail> = {}): PerImageDetail {
  return {
    index: 0,
    score: 8.5,
    comment: '光影层次丰富。',
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

/** 乱序逐图明细数据（group.js L857 排序行为验证前提） */
const shuffledItems = [
  createDetail({ index: 2, score: 6.2 }),
  createDetail({ index: 0, score: 8.9 }),
  createDetail({ index: 1, score: 7.4 }),
]

const entries = [createEntry(0), createEntry(1), createEntry(2)]

describe('PerImageGrid', () => {
  // ── 排序（锚点 group.js L857）──

  it('乱序 items 按 index 升序渲染', async () => {
    const wrapper = await mountSuspended(PerImageGrid, {
      props: { items: shuffledItems, entries },
    })
    const badges = wrapper.findAll('.per-image-badge')
    expect(badges.map((el) => el.text())).toEqual(['01', '02', '03'])
  })

  it('卡数等于 items 数', async () => {
    const wrapper = await mountSuspended(PerImageGrid, {
      props: { items: shuffledItems, entries },
    })
    expect(wrapper.findAll('article.per-image-card')).toHaveLength(3)
  })

  // ── entries 连接（锚点 group.js L859 getEntryByIndex）──

  it('entries 按 detail.index 配对：各卡 img src 对应', async () => {
    const wrapper = await mountSuspended(PerImageGrid, {
      props: { items: shuffledItems, entries },
    })
    const images = wrapper.findAll('.per-image-media img')
    // index 升序后：index 0 → blob:mock-0, index 1 → blob:mock-1, index 2 → blob:mock-2
    expect(images[0]!.attributes('src')).toBe('blob:mock-0')
    expect(images[1]!.attributes('src')).toBe('blob:mock-1')
    expect(images[2]!.attributes('src')).toBe('blob:mock-2')
  })

  it('index 越界时该卡无 img 且 h4 回退「第 N 张」', async () => {
    const items = [
      createDetail({ index: 0 }),
      createDetail({ index: 9 }),
    ]
    const wrapper = await mountSuspended(PerImageGrid, {
      props: { items, entries: [createEntry(0)] },
    })
    const cards = wrapper.findAll('article.per-image-card')
    expect(cards[0]!.find('img').exists()).toBe(true)
    expect(cards[1]!.find('img').exists()).toBe(false)
    expect(cards[1]!.find('.per-image-heading h4').text()).toBe('第 10 张')
  })

  // ── 文案 props 透传 ──

  it('文案 props 透传至子卡', async () => {
    const wrapper = await mountSuspended(PerImageGrid, {
      props: {
        items: shuffledItems,
        entries,
        altTemplate: 'Detail for photo {index}',
        fallbackNameTemplate: 'Photo {index}',
      },
    })
    const cards = wrapper.findAllComponents(PerImageCard)
    expect(cards).toHaveLength(3)
    for (const card of cards) {
      expect(card.props('altTemplate')).toBe('Detail for photo {index}')
      expect(card.props('fallbackNameTemplate')).toBe('Photo {index}')
    }
  })

  // ── 边界状态 ──

  it('空 items 时根节点存在但无子卡（隐藏归 Flow，§9.14）', async () => {
    const wrapper = await mountSuspended(PerImageGrid, {
      props: { items: [], entries },
    })
    expect(wrapper.find('div.per-image-grid').exists()).toBe(true)
    expect(wrapper.findAll('article.per-image-card')).toHaveLength(0)
  })

  // ── attrs 透传（先例 RankingList.spec.ts L118-126）──

  it('attrs 落根元素', async () => {
    const wrapper = await mountSuspended(PerImageGrid, {
      props: { items: shuffledItems, entries },
      attrs: { id: 'per-image-grid', class: 'extra' },
    })
    expect(wrapper.attributes('id')).toBe('per-image-grid')
    expect(wrapper.classes()).toContain('extra')
    expect(wrapper.classes()).toContain('per-image-grid')
  })
})
