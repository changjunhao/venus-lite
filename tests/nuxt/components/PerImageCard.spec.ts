import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MarkdownRender from 'markstream-vue'
import PerImageCard from '~/components/evaluation/PerImageCard.vue'
import type { PerImageDetail } from '#shared/types/evaluation'
import type { ImageEntry } from '~/composables/useImageSelection'

/** 构造 PerImageDetail 形状 mock */
function createDetail(overrides: Partial<PerImageDetail> = {}): PerImageDetail {
  return {
    index: 0,
    score: 8.5,
    comment: '光影层次丰富，构图稳健。',
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

describe('PerImageCard', () => {
  // ── 结构回归（锚点 group.js L860-893）──

  it('渲染为 article.per-image-card，包含 .per-image-media 与 .per-image-body', async () => {
    const wrapper = await mountSuspended(PerImageCard, {
      props: { detail: createDetail(), entry: createEntry(0) },
    })
    expect(wrapper.element.tagName).toBe('ARTICLE')
    expect(wrapper.classes()).toContain('per-image-card')
    expect(wrapper.find('.per-image-media').exists()).toBe(true)
    expect(wrapper.find('.per-image-body').exists()).toBe(true)
    expect(wrapper.find('.per-image-badge').exists()).toBe(true)
    expect(wrapper.find('.per-image-heading').exists()).toBe(true)
  })

  // ── 角标补零（锚点 group.js L872）──

  it('角标补零：index=0 → 01', async () => {
    const wrapper = await mountSuspended(PerImageCard, {
      props: { detail: createDetail({ index: 0 }), entry: createEntry(0) },
    })
    expect(wrapper.find('.per-image-badge').text()).toBe('01')
  })

  it('角标补零：index=9 → 10', async () => {
    const wrapper = await mountSuspended(PerImageCard, {
      props: { detail: createDetail({ index: 9 }), entry: createEntry(9) },
    })
    expect(wrapper.find('.per-image-badge').text()).toBe('10')
  })

  // ── 分数格式（锚点 group.js L886 + ScorePanel L36-39 NaN 防御）──

  it('score 为裸 X.X 格式，不带 / 10 后缀', async () => {
    const wrapper = await mountSuspended(PerImageCard, {
      props: { detail: createDetail({ score: 8.5 }), entry: createEntry(0) },
    })
    expect(wrapper.find('.per-image-heading strong').text()).toBe('8.5')
  })

  it('score 为 NaN 时防御为 0.0', async () => {
    const wrapper = await mountSuspended(PerImageCard, {
      props: { detail: createDetail({ score: Number.NaN }), entry: createEntry(0) },
    })
    expect(wrapper.find('.per-image-heading strong').text()).toBe('0.0')
  })

  // ── 图片渲染（锚点 group.js L865-870）──

  it('有 entry 时渲染 img：src/alt 插值/width/height/loading=lazy/decoding=async', async () => {
    const entry = createEntry(2, 900, 1600)
    const wrapper = await mountSuspended(PerImageCard, {
      props: { detail: createDetail({ index: 2 }), entry },
    })
    const img = wrapper.find('.per-image-media img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('blob:mock-2')
    expect(img.attributes('alt')).toBe('第 3 张照片的评估明细')
    expect(img.attributes('width')).toBe('900')
    expect(img.attributes('height')).toBe('1600')
    expect(img.attributes('loading')).toBe('lazy')
    expect(img.attributes('decoding')).toBe('async')
  })

  // ── 文件名与缺图回退（锚点 group.js L879-884）──

  it('有 entry 时 h4 渲染文件名（UiFileName + title）', async () => {
    const wrapper = await mountSuspended(PerImageCard, {
      props: { detail: createDetail({ index: 1 }), entry: createEntry(1) },
    })
    const h4 = wrapper.find('.per-image-heading h4')
    expect(h4.find('.file-name').exists()).toBe(true)
    expect(h4.find('.file-name').attributes('title')).toBe('photo-1.jpg')
  })

  it('entry=null 时无 img 无占位文案，h4 回退「第 N 张」', async () => {
    const wrapper = await mountSuspended(PerImageCard, {
      props: { detail: createDetail({ index: 4 }), entry: null },
    })
    const media = wrapper.find('.per-image-media')
    expect(media.find('img').exists()).toBe(false)
    // 源 renderPerImage 缺图仅不渲染 img（L865-870），无占位文案——区别于 RankingCard
    expect(media.find('.media-missing').exists()).toBe(false)
    expect(media.find('.media-missing-text').exists()).toBe(false)
    // 角标恒渲染（L871-873）
    expect(media.find('.per-image-badge').text()).toBe('05')
    // h4 回退名（L883）
    expect(wrapper.find('.per-image-heading h4').text()).toBe('第 5 张')
    expect(wrapper.find('.file-name').exists()).toBe(false)
  })

  // ── comment Markdown（锚点 group.js L888-889）──

  it('comment 非空时 MarkdownRender 接收 content 与 final=true', async () => {
    const comment = '光影层次丰富，**构图稳健**。'
    const wrapper = await mountSuspended(PerImageCard, {
      props: { detail: createDetail({ comment }), entry: createEntry(0) },
    })
    const commentEl = wrapper.find('.per-image-comment')
    expect(commentEl.exists()).toBe(true)
    const renderer = wrapper.findComponent(MarkdownRender)
    expect(renderer.props('content')).toBe(comment)
    expect(renderer.props('final')).toBe(true)
  })

  it('comment 为空串时不渲染 .per-image-comment，不实例化 MarkdownRender', async () => {
    const wrapper = await mountSuspended(PerImageCard, {
      props: { detail: createDetail({ comment: '' }), entry: createEntry(0) },
    })
    expect(wrapper.find('.per-image-comment').exists()).toBe(false)
    expect(wrapper.findComponent(MarkdownRender).exists()).toBe(false)
  })

  // ── 文案模板覆盖 ──

  it('自定义文案模板生效', async () => {
    const wrapper = await mountSuspended(PerImageCard, {
      props: {
        detail: createDetail({ index: 0 }),
        entry: createEntry(0),
        altTemplate: 'Detail for photo {index}',
        fallbackNameTemplate: 'Photo {index}',
      },
    })
    expect(wrapper.find('img').attributes('alt')).toBe('Detail for photo 1')
  })

  it('自定义 fallbackNameTemplate 在缺图时生效', async () => {
    const wrapper = await mountSuspended(PerImageCard, {
      props: {
        detail: createDetail({ index: 2 }),
        entry: null,
        fallbackNameTemplate: 'Photo {index}',
      },
    })
    expect(wrapper.find('.per-image-heading h4').text()).toBe('Photo 3')
  })

  // ── attrs 透传（先例 RankingCard.spec.ts L171-179）──

  it('attrs 落根元素', async () => {
    const wrapper = await mountSuspended(PerImageCard, {
      props: { detail: createDetail(), entry: createEntry(0) },
      attrs: { id: 'per-image-card-1', class: 'extra' },
    })
    expect(wrapper.attributes('id')).toBe('per-image-card-1')
    expect(wrapper.classes()).toContain('extra')
    expect(wrapper.classes()).toContain('per-image-card')
  })
})
