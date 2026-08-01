import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MarkdownRender from 'markstream-vue'
import RankingCard from '~/components/evaluation/RankingCard.vue'
import type { RankingItem } from '#shared/types/evaluation'
import type { ImageEntry } from '~/composables/useImageSelection'

/** 构造 RankingItem 形状 mock */
function createItem(overrides: Partial<RankingItem> = {}): RankingItem {
  return {
    index: 0,
    rank: 1,
    score: 8.5,
    rationale: '光影层次丰富，构图稳健。',
    ...overrides,
  }
}

/** 构造 ImageEntry 形状 mock（objectURL 以 blob: 占位，先例 ContactSheet.spec.ts L7-16） */
function createEntry(index: number, width = 1200, height = 800): ImageEntry {
  return {
    id: `entry-${index}`,
    identity: `photo-${index}.jpg:1024:1722400000000`,
    file: new File([], `photo-${index}.jpg`, { type: 'image/jpeg' }),
    objectURL: `blob:mock-${index}`,
    width,
    height,
  }
}

describe('RankingCard', () => {
  // ── 结构回归（锚点 group.js L659-698）──

  it('渲染为 article.ranking-card，包含 .ranking-media 与 .ranking-body', async () => {
    const wrapper = await mountSuspended(RankingCard, {
      props: { item: createItem(), entry: createEntry(0) },
    })
    expect(wrapper.element.tagName).toBe('ARTICLE')
    expect(wrapper.classes()).toContain('ranking-card')
    expect(wrapper.find('.ranking-media').exists()).toBe(true)
    expect(wrapper.find('.ranking-body').exists()).toBe(true)
    expect(wrapper.find('.ranking-position').exists()).toBe(true)
    expect(wrapper.find('.ranking-source').exists()).toBe(true)
    expect(wrapper.find('.ranking-heading').exists()).toBe(true)
  })

  // ── winner 高亮（锚点 group.js L660/L689、style.css L1018/L1023）──

  it('rank=1 时携带 .ranking-winner class，h4 为 本组最佳', async () => {
    const wrapper = await mountSuspended(RankingCard, {
      props: { item: createItem({ rank: 1 }), entry: createEntry(0) },
    })
    expect(wrapper.classes()).toContain('ranking-winner')
    expect(wrapper.find('.ranking-heading h4').text()).toBe('本组最佳')
  })

  it('rank>1 时无 .ranking-winner class，h4 为 第 N 名', async () => {
    const wrapper = await mountSuspended(RankingCard, {
      props: { item: createItem({ rank: 3 }), entry: createEntry(0) },
    })
    expect(wrapper.classes()).not.toContain('ranking-winner')
    expect(wrapper.find('.ranking-heading h4').text()).toBe('第 3 名')
  })

  it('角标渲染 #rank 文本', async () => {
    const wrapper = await mountSuspended(RankingCard, {
      props: { item: createItem({ rank: 3 }), entry: createEntry(0) },
    })
    expect(wrapper.find('.ranking-position').text()).toBe('#3')
  })

  // ── 分数格式（锚点 group.js L691 + ScorePanel L36-39 NaN 防御）──

  it('score 格式为 X.X / 10', async () => {
    const wrapper = await mountSuspended(RankingCard, {
      props: { item: createItem({ score: 8.5 }), entry: createEntry(0) },
    })
    expect(wrapper.find('.ranking-heading strong').text()).toBe('8.5 / 10')
  })

  it('score 为 NaN 时防御为 0.0 / 10', async () => {
    const wrapper = await mountSuspended(RankingCard, {
      props: { item: createItem({ score: Number.NaN }), entry: createEntry(0) },
    })
    expect(wrapper.find('.ranking-heading strong').text()).toBe('0.0 / 10')
  })

  // ── 图片渲染（锚点 group.js L664-668）──

  it('有 entry 时渲染 img：src/alt 插值/width/height/loading=lazy', async () => {
    const entry = createEntry(2, 900, 1600)
    const wrapper = await mountSuspended(RankingCard, {
      props: { item: createItem({ rank: 2, index: 2 }), entry },
    })
    const img = wrapper.find('.ranking-media img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('blob:mock-2')
    expect(img.attributes('alt')).toBe('排名第 2：第 3 张照片')
    expect(img.attributes('width')).toBe('900')
    expect(img.attributes('height')).toBe('1600')
    expect(img.attributes('loading')).toBe('lazy')
    expect(img.attributes('decoding')).toBe('async')
  })

  it('有 entry 时 .ranking-source 渲染文件名（UiFileName）', async () => {
    const wrapper = await mountSuspended(RankingCard, {
      props: { item: createItem({ index: 1 }), entry: createEntry(1) },
    })
    const source = wrapper.find('.ranking-source')
    expect(source.text()).toContain('第 2 张照片')
    expect(source.text()).toContain('·')
    expect(source.find('.file-name').exists()).toBe(true)
    expect(source.find('.file-name').attributes('title')).toBe('photo-1.jpg')
  })

  // ── 缺图占位（锚点 group.js L669-671）──

  it('entry=null 时渲染 .media-missing 占位文案，无 img 与 FileName', async () => {
    const wrapper = await mountSuspended(RankingCard, {
      props: { item: createItem({ index: 5 }), entry: null },
    })
    const media = wrapper.find('.ranking-media')
    expect(media.classes()).toContain('media-missing')
    expect(media.find('.media-missing-text').text()).toBe('照片已从当前列表移除，重新上传后可查看预览')
    expect(media.find('img').exists()).toBe(false)
    expect(wrapper.find('.file-name').exists()).toBe(false)
    expect(wrapper.find('.ranking-source').text()).not.toContain('·')
  })

  // ── rationale Markdown（锚点 group.js L693-695）──

  it('rationale 非空时 MarkdownRender 接收 content 与 final=true', async () => {
    const rationale = '光影层次丰富，**构图稳健**。'
    const wrapper = await mountSuspended(RankingCard, {
      props: { item: createItem({ rationale }), entry: createEntry(0) },
    })
    const rationaleEl = wrapper.find('.ranking-rationale')
    expect(rationaleEl.exists()).toBe(true)
    const renderer = wrapper.findComponent(MarkdownRender)
    expect(renderer.props('content')).toBe(rationale)
    expect(renderer.props('final')).toBe(true)
  })

  it('rationale 为空串时不渲染 .ranking-rationale', async () => {
    const wrapper = await mountSuspended(RankingCard, {
      props: { item: createItem({ rationale: '' }), entry: createEntry(0) },
    })
    expect(wrapper.find('.ranking-rationale').exists()).toBe(false)
    expect(wrapper.findComponent(MarkdownRender).exists()).toBe(false)
  })

  // ── 文案模板覆盖 ──

  it('自定义文案模板生效', async () => {
    const wrapper = await mountSuspended(RankingCard, {
      props: {
        item: createItem({ rank: 2, index: 0 }),
        entry: createEntry(0),
        rankTitleTemplate: 'Rank {rank}',
        photoLabelTemplate: 'Photo {index}',
        altTemplate: 'Rank {rank}, photo {index}',
      },
    })
    expect(wrapper.find('.ranking-heading h4').text()).toBe('Rank 2')
    expect(wrapper.find('.ranking-source').text()).toContain('Photo 1')
    expect(wrapper.find('img').attributes('alt')).toBe('Rank 2, photo 1')
  })

  // ── attrs 透传（先例 CritiqueReport.spec.ts L122-130）──

  it('attrs 落根元素', async () => {
    const wrapper = await mountSuspended(RankingCard, {
      props: { item: createItem(), entry: createEntry(0) },
      attrs: { id: 'ranking-card-1', class: 'extra' },
    })
    expect(wrapper.attributes('id')).toBe('ranking-card-1')
    expect(wrapper.classes()).toContain('extra')
    expect(wrapper.classes()).toContain('ranking-card')
  })
})
