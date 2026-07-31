import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import DimensionList from '~/components/evaluation/DimensionList.vue'
import type { GenreMetadata } from '#shared/types/evaluation'

/** 测试用门类元数据（形状对齐 venus-core schema GenreMetadata） */
const metadata: Record<string, GenreMetadata> = {
  portrait: {
    label: '人像',
    dimensionLabels: ['光影质量', '构图与视觉引导'],
    subtypes: [{ value: 'studio', label: '棚拍' }],
    dimensions: [
      { key: 'lighting_quality', label: '光影质量' },
      { key: 'composition_depth', label: '构图与视觉引导' },
      { key: 'emotional_resonance', label: '情感共鸣' },
    ],
  },
}

const dimensions = {
  lighting_quality: 7.2,
  composition_depth: 8,
  emotional_resonance: 6.5,
}

describe('DimensionList', () => {
  // ── 结构回归（锚点 single.html L150 / style.css L910-925）──

  it('渲染 .dimension-list 根节点与逐行三列结构', async () => {
    const wrapper = await mountSuspended(DimensionList, { props: { dimensions } })
    expect(wrapper.classes()).toContain('dimension-list')

    const items = wrapper.findAll('.dimension-item')
    expect(items).toHaveLength(3)
    for (const item of items) {
      expect(item.find('.dimension-label').exists()).toBe(true)
      expect(item.find('.dimension-bar').exists()).toBe(true)
      expect(item.find('.dimension-fill').exists()).toBe(true)
      expect(item.find('.dimension-score').exists()).toBe(true)
    }
  })

  it('空 dimensions 渲染根节点但无行', async () => {
    const wrapper = await mountSuspended(DimensionList, { props: { dimensions: {} } })
    expect(wrapper.classes()).toContain('dimension-list')
    expect(wrapper.findAll('.dimension-item')).toHaveLength(0)
  })

  // ── 分数格式化（回归锚点：app.js L653 toFixed(1)）──

  it('分数保留一位小数', async () => {
    const wrapper = await mountSuspended(DimensionList, {
      props: { dimensions: { a: 7.25 } },
    })
    expect(wrapper.find('.dimension-score').text()).toBe('7.3')
  })

  it('整数分数补零展示', async () => {
    const wrapper = await mountSuspended(DimensionList, {
      props: { dimensions: { a: 8 } },
    })
    expect(wrapper.find('.dimension-score').text()).toBe('8.0')
  })

  // ── NaN 防御（回归锚点：group.js L628）──

  it('NaN 输入显示 - 且 fill 目标为 0%', async () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    const wrapper = await mountSuspended(DimensionList, {
      props: { dimensions: { a: Number.NaN } },
    })
    await nextTick()
    expect(wrapper.find('.dimension-score').text()).toBe('-')
    expect(wrapper.find('.dimension-fill').attributes('style')).toContain('width: 0%')
    vi.unstubAllGlobals()
  })

  // ── 名称解析（回归锚点：venus utils.js L79-95）──

  it('传入 metadata + genre 时显示中文 label', async () => {
    const wrapper = await mountSuspended(DimensionList, {
      props: { dimensions, genre: 'portrait', metadata },
    })
    const labels = wrapper.findAll('.dimension-label').map(el => el.text())
    expect(labels).toEqual(['光影质量', '构图与视觉引导', '情感共鸣'])
  })

  it('未传 metadata 时显示原始 key', async () => {
    const wrapper = await mountSuspended(DimensionList, { props: { dimensions } })
    const labels = wrapper.findAll('.dimension-label').map(el => el.text())
    expect(labels).toEqual(['lighting_quality', 'composition_depth', 'emotional_resonance'])
  })

  // ── 延迟动画（回归锚点：app.js L656-658 setTimeout(100 + index×100)）──

  it('初始渲染全部 fill width 为 0%', async () => {
    // rAF 不执行回调时保持初始态
    vi.stubGlobal('requestAnimationFrame', () => 0)
    const wrapper = await mountSuspended(DimensionList, { props: { dimensions } })
    for (const fill of wrapper.findAll('.dimension-fill')) {
      expect(fill.attributes('style')).toContain('width: 0%')
    }
    vi.unstubAllGlobals()
  })

  it('rAF 回调后各行 fill width 过渡到 score×10%', async () => {
    // rAF 同步化：立即执行回调
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    const wrapper = await mountSuspended(DimensionList, { props: { dimensions } })
    await nextTick()
    const fills = wrapper.findAll('.dimension-fill')
    expect(fills[0]!.attributes('style')).toContain('width: 72%')
    expect(fills[1]!.attributes('style')).toContain('width: 80%')
    expect(fills[2]!.attributes('style')).toContain('width: 65%')
    vi.unstubAllGlobals()
  })

  it('各行 transition-delay 按 100 + index×100 ms 交错', async () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    const wrapper = await mountSuspended(DimensionList, { props: { dimensions } })
    await nextTick()
    const fills = wrapper.findAll('.dimension-fill')
    expect(fills[0]!.attributes('style')).toContain('transition-delay: 100ms')
    expect(fills[1]!.attributes('style')).toContain('transition-delay: 200ms')
    expect(fills[2]!.attributes('style')).toContain('transition-delay: 300ms')
    vi.unstubAllGlobals()
  })

  it('score 超出 10 时 fill 钳制为 100%', async () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    const wrapper = await mountSuspended(DimensionList, {
      props: { dimensions: { a: 11 } },
    })
    await nextTick()
    expect(wrapper.find('.dimension-fill').attributes('style')).toContain('width: 100%')
    vi.unstubAllGlobals()
  })

  it('负分 fill 钳制为 0%', async () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    const wrapper = await mountSuspended(DimensionList, {
      props: { dimensions: { a: -2 } },
    })
    await nextTick()
    expect(wrapper.find('.dimension-fill').attributes('style')).toContain('width: 0%')
    vi.unstubAllGlobals()
  })

  // ── 无障碍（§14.4）──

  it('.dimension-bar 携带 aria-hidden="true"', async () => {
    const wrapper = await mountSuspended(DimensionList, { props: { dimensions } })
    for (const bar of wrapper.findAll('.dimension-bar')) {
      expect(bar.attributes('aria-hidden')).toBe('true')
    }
  })

  // ── attrs 透传（先例 ScorePanel.spec.ts）──

  it('attrs 落根元素', async () => {
    const wrapper = await mountSuspended(DimensionList, {
      props: { dimensions },
      attrs: { 'aria-label': '维度评分', class: 'extra' },
    })
    expect(wrapper.attributes('aria-label')).toBe('维度评分')
    expect(wrapper.classes()).toContain('extra')
    expect(wrapper.classes()).toContain('dimension-list')
  })
})
