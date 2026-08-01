import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MarkdownRender from 'markstream-vue'
import CompareFrame from '~/components/evaluation/CompareFrame.vue'
import type { RankingItem } from '#shared/types/evaluation'
import type { ImageEntry } from '~/composables/useImageSelection'

/** 构造 RankingItem 形状 mock（先例 RankingCard.spec.ts L9-17） */
function createItem(overrides: Partial<RankingItem> = {}): RankingItem {
  return {
    index: 0,
    rank: 1,
    score: 8.5,
    rationale: '光影层次丰富，构图稳健。',
    ...overrides,
  }
}

/** 构造 ImageEntry 形状 mock（先例 RankingCard.spec.ts L20-29） */
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

describe('CompareFrame', () => {
  // ── 结构回归（锚点 group.js L743-776）──

  it('渲染为 article.compare-focus-frame，包含 media button 与 body', async () => {
    const wrapper = await mountSuspended(CompareFrame, {
      props: { item: createItem(), entry: createEntry(0) },
    })
    expect(wrapper.element.tagName).toBe('ARTICLE')
    expect(wrapper.classes()).toContain('compare-focus-frame')
    const media = wrapper.find('.compare-focus-media')
    expect(media.exists()).toBe(true)
    expect(media.element.tagName).toBe('BUTTON')
    expect(media.attributes('type')).toBe('button')
    expect(wrapper.find('.compare-focus-body').exists()).toBe(true)
    expect(wrapper.find('.compare-focus-score').exists()).toBe(true)
    expect(wrapper.find('.compare-focus-label').exists()).toBe(true)
    expect(wrapper.find('.compare-focus-rationale').exists()).toBe(true)
  })

  // ── badge 文本（锚点 group.js L754）──

  it('badge 渲染 FRAME 补零编号 + 名次', async () => {
    const wrapper = await mountSuspended(CompareFrame, {
      props: { item: createItem({ index: 2, rank: 3 }), entry: createEntry(2) },
    })
    expect(wrapper.find('.compare-focus-media > span').text()).toBe('FRAME 03 · #3')
  })

  // ── 图片渲染（锚点 group.js L750-752）──

  it('img 渲染 src/alt 插值/width/height/loading=lazy/decoding=async', async () => {
    const entry = createEntry(1, 900, 1600)
    const wrapper = await mountSuspended(CompareFrame, {
      props: { item: createItem({ index: 1 }), entry },
    })
    const img = wrapper.find('.compare-focus-media img')
    expect(img.attributes('src')).toBe('blob:mock-1')
    expect(img.attributes('alt')).toBe('第 2 张照片：photo-1.jpg')
    expect(img.attributes('width')).toBe('900')
    expect(img.attributes('height')).toBe('1600')
    expect(img.attributes('loading')).toBe('lazy')
    expect(img.attributes('decoding')).toBe('async')
  })

  // ── media aria-label（锚点 group.js L749）──

  it('media aria-label 默认含侧标签与照片序号', async () => {
    const wrapper = await mountSuspended(CompareFrame, {
      props: { item: createItem({ index: 1 }), entry: createEntry(1) },
    })
    expect(wrapper.find('.compare-focus-media').attributes('aria-label'))
      .toBe('左侧第 2 张照片，进入沉浸对比')
  })

  it('sideLabel 与模板覆盖生效', async () => {
    const wrapper = await mountSuspended(CompareFrame, {
      props: {
        item: createItem({ index: 0 }),
        entry: createEntry(0),
        sideLabel: '右侧',
        zoomAriaTemplate: '{side}照片 {index}，放大',
      },
    })
    expect(wrapper.find('.compare-focus-media').attributes('aria-label'))
      .toBe('右侧照片 1，放大')
  })

  // ── 评分格式（锚点 group.js L766 + RankingCard L58-62 NaN 防御）──

  it('评分格式为 X.X / 10', async () => {
    const wrapper = await mountSuspended(CompareFrame, {
      props: { item: createItem({ score: 8.5 }), entry: createEntry(0) },
    })
    expect(wrapper.find('.compare-focus-score strong').text()).toBe('8.5 / 10')
  })

  it('score 为 NaN 时防御为 0.0 / 10', async () => {
    const wrapper = await mountSuspended(CompareFrame, {
      props: { item: createItem({ score: Number.NaN }), entry: createEntry(0) },
    })
    expect(wrapper.find('.compare-focus-score strong').text()).toBe('0.0 / 10')
  })

  // ── 文件名（锚点 group.js L763-764）──

  it('h4 渲染 UiFileName 并携带 title', async () => {
    const wrapper = await mountSuspended(CompareFrame, {
      props: { item: createItem(), entry: createEntry(0) },
    })
    const h4 = wrapper.find('.compare-focus-score h4')
    expect(h4.attributes('title')).toBe('photo-0.jpg')
    expect(h4.find('.file-name').exists()).toBe(true)
  })

  // ── rationale（锚点 group.js L768-773）──

  it('rationale 标签默认为 优势与限制', async () => {
    const wrapper = await mountSuspended(CompareFrame, {
      props: { item: createItem(), entry: createEntry(0) },
    })
    expect(wrapper.find('.compare-focus-label').text()).toBe('优势与限制')
  })

  it('rationale 非空时 MarkdownRender 接收 content 与 final=true', async () => {
    const rationale = '光影层次丰富，**构图稳健**。'
    const wrapper = await mountSuspended(CompareFrame, {
      props: { item: createItem({ rationale }), entry: createEntry(0) },
    })
    const renderer = wrapper.findComponent(MarkdownRender)
    expect(renderer.props('content')).toBe(rationale)
    expect(renderer.props('final')).toBe(true)
  })

  it('rationale 为空串时走 fallback 文案（贴源 L773）', async () => {
    const wrapper = await mountSuspended(CompareFrame, {
      props: { item: createItem({ rationale: '' }), entry: createEntry(0) },
    })
    const renderer = wrapper.findComponent(MarkdownRender)
    expect(renderer.props('content')).toBe('暂无进一步判断依据')
    expect(renderer.props('final')).toBe(true)
  })

  // ── zoom 事件（锚点 group.js L756）──

  it('点击 media 发出 zoom', async () => {
    const wrapper = await mountSuspended(CompareFrame, {
      props: { item: createItem(), entry: createEntry(0) },
    })
    await wrapper.find('.compare-focus-media').trigger('click')
    expect(wrapper.emitted('zoom')).toHaveLength(1)
  })

  // ── attrs 透传（先例 RankingCard.spec.ts L171-179）──

  it('attrs 落根元素', async () => {
    const wrapper = await mountSuspended(CompareFrame, {
      props: { item: createItem(), entry: createEntry(0) },
      attrs: { id: 'frame-1', class: 'extra' },
    })
    expect(wrapper.attributes('id')).toBe('frame-1')
    expect(wrapper.classes()).toContain('extra')
    expect(wrapper.classes()).toContain('compare-focus-frame')
  })
})
