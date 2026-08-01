import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { nextTick } from 'vue'
import FocusCompare from '~/components/evaluation/FocusCompare.vue'
import type { RankingItem } from '#shared/types/evaluation'
import type { ImageEntry } from '~/composables/useImageSelection'

/** 构造 RankingItem[] mock：specs = [index, rank, score?][] */
function createItems(specs: Array<[number, number, number?]>): RankingItem[] {
  return specs.map(([index, rank, score = 7.5]) => ({
    index,
    rank,
    score,
    rationale: `理由 ${index}`,
  }))
}

/** 构造 ImageEntry[] mock（先例 RankingCard.spec.ts L20-29） */
function createEntries(count: number): ImageEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `entry-${i}`,
    identity: `photo-${i}.jpg:1024:1722400000000`,
    file: new File([], `photo-${i}.jpg`, { type: 'image/jpeg' }),
    objectURL: `blob:mock-${i}`,
    width: 1200,
    height: 800,
  }))
}

describe('FocusCompare', () => {
  // ── 节级隐藏（锚点 group.js L709-710）──

  it('有效排名项 < 2 时不渲染', async () => {
    const wrapper = await mountSuspended(FocusCompare, {
      props: { items: createItems([[0, 1]]), entries: createEntries(1) },
    })
    expect(wrapper.find('.compare-focus').exists()).toBe(false)
  })

  it('entry 缺失的排名项被过滤后 < 2 时不渲染（锚点 group.js L706-708）', async () => {
    const wrapper = await mountSuspended(FocusCompare, {
      props: { items: createItems([[0, 1], [5, 2]]), entries: createEntries(1) },
    })
    expect(wrapper.find('.compare-focus').exists()).toBe(false)
  })

  // ── 结构与初始 pair（锚点 group.js L713-716 / L549-552）──

  it('渲染 heading/intro/controls/grid，pair 初始为前两名 ranked index', async () => {
    // ranked 序：index2(rank1) → index0(rank2) → index1(rank3)
    const wrapper = await mountSuspended(FocusCompare, {
      props: { items: createItems([[0, 2], [1, 3], [2, 1]]), entries: createEntries(3) },
    })
    expect(wrapper.find('.compare-focus').exists()).toBe(true)
    expect(wrapper.find('.compare-focus-heading').exists()).toBe(true)
    expect(wrapper.find('.compare-focus-intro').exists()).toBe(true)
    expect(wrapper.find('.compare-focus-controls').exists()).toBe(true)
    expect(wrapper.find('.compare-focus-grid').exists()).toBe(true)

    // pair = [2, 0]：左侧 FRAME 03 · #1，右侧 FRAME 01 · #2
    const badges = wrapper.findAll('.compare-focus-media > span')
    expect(badges[0]!.text()).toBe('FRAME 03 · #1')
    expect(badges[1]!.text()).toBe('FRAME 01 · #2')

    // select 值与 pair 一致
    const selects = wrapper.findAll('select')
    expect((selects[0]!.element as HTMLSelectElement).value).toBe('2')
    expect((selects[1]!.element as HTMLSelectElement).value).toBe('0')
  })

  it('section aria-labelledby 指向标题文本', async () => {
    const wrapper = await mountSuspended(FocusCompare, {
      props: { items: createItems([[0, 1], [1, 2]]), entries: createEntries(2) },
    })
    const labelledby = wrapper.find('.compare-focus').attributes('aria-labelledby')
    expect(labelledby).toBeTruthy()
    const heading = wrapper.find(`#${labelledby}`)
    expect(heading.exists()).toBe(true)
    expect(heading.text()).toBe('双图聚焦比较')
  })

  // ── options 构建（锚点 group.js L718-728）──

  it('options 按 rank 升序，label 为 #{rank} · 第 {index} 张 · {name}', async () => {
    const wrapper = await mountSuspended(FocusCompare, {
      props: { items: createItems([[0, 2], [1, 1]]), entries: createEntries(2) },
    })
    const options = wrapper.findAll('select')[0]!.findAll('option')
    expect(options).toHaveLength(2)
    expect(options[0]!.text()).toBe('#1 · 第 2 张 · photo-1.jpg')
    expect(options[1]!.text()).toBe('#2 · 第 1 张 · photo-0.jpg')
  })

  it('optionTemplate 覆盖生效', async () => {
    const wrapper = await mountSuspended(FocusCompare, {
      props: {
        items: createItems([[0, 1], [1, 2]]),
        entries: createEntries(2),
        optionTemplate: 'R{rank} P{index} {name}',
      },
    })
    const options = wrapper.findAll('select')[0]!.findAll('option')
    expect(options[0]!.text()).toBe('R1 P1 photo-0.jpg')
  })

  // ── 互斥选择（锚点 group.js L840-850 逐行移植）──

  it('选中对侧已选项时，对侧替换为 ranked 首个 index≠next 者（非朴素交换）', async () => {
    // ranked indices: [1, 2, 0]（rank1→index1, rank2→index2, rank3→index0）
    const wrapper = await mountSuspended(FocusCompare, {
      props: { items: createItems([[0, 3], [1, 1], [2, 2]]), entries: createEntries(3) },
    })
    // 初始 pair = [1, 2]
    // 左侧选 0（无冲突）→ pair = [0, 2]
    await wrapper.findAll('select')[0]!.setValue('0')
    await nextTick()
    let selects = wrapper.findAll('select')
    expect((selects[0]!.element as HTMLSelectElement).value).toBe('0')
    expect((selects[1]!.element as HTMLSelectElement).value).toBe('2')

    // 右侧选 0（与左冲突）→ replacement = ranked 首个 ≠ 0 = 1 → pair = [1, 0]
    // 朴素交换语义会得到 [2, 0]（对侧拿本侧旧值），此断言钉死替换策略
    await wrapper.findAll('select')[1]!.setValue('0')
    await nextTick()
    selects = wrapper.findAll('select')
    expect((selects[0]!.element as HTMLSelectElement).value).toBe('1')
    expect((selects[1]!.element as HTMLSelectElement).value).toBe('0')
  })

  it('无冲突选择直接生效', async () => {
    const wrapper = await mountSuspended(FocusCompare, {
      props: { items: createItems([[0, 1], [1, 2], [2, 3]]), entries: createEntries(3) },
    })
    // 初始 pair = [0, 1]；右侧选 2 → pair = [0, 2]
    await wrapper.findAll('select')[1]!.setValue('2')
    await nextTick()
    const selects = wrapper.findAll('select')
    expect((selects[0]!.element as HTMLSelectElement).value).toBe('0')
    expect((selects[1]!.element as HTMLSelectElement).value).toBe('2')
  })

  // ── pair 校验（锚点 group.js L713-716）──

  it('items 变更使 pair 非法时回退前两名', async () => {
    const wrapper = await mountSuspended(FocusCompare, {
      props: { items: createItems([[0, 1], [1, 2], [2, 3]]), entries: createEntries(3) },
    })
    // 初始 pair = [0, 1]；新 items 无 index 0 → pair 非法
    // 新 ranked：index2(rank1) → index1(rank2) → 回退 pair = [2, 1]
    await wrapper.setProps({ items: createItems([[1, 2], [2, 1]]) })
    await nextTick()
    const selects = wrapper.findAll('select')
    expect((selects[0]!.element as HTMLSelectElement).value).toBe('2')
    expect((selects[1]!.element as HTMLSelectElement).value).toBe('1')
  })

  // ── 沉浸模式（锚点 group.js L798-817）──

  it('非沉浸态无 dialog 语义，关闭按钮不在 DOM（v-if 回归）', async () => {
    const wrapper = await mountSuspended(FocusCompare, {
      props: { items: createItems([[0, 1], [1, 2]]), entries: createEntries(2) },
    })
    const section = wrapper.find('.compare-focus')
    expect(section.attributes('role')).toBeUndefined()
    expect(section.attributes('aria-modal')).toBeUndefined()
    expect(section.attributes('tabindex')).toBe('-1')
    expect(wrapper.find('.focus-compare-close').exists()).toBe(false)
  })

  it('zoom 进入沉浸：is-immersive + role/aria-modal + 聚焦关闭按钮；Esc 关闭并回焦', async () => {
    // focus/activeElement 只对文档内元素生效（BaseModal.spec L115-126 配方）
    const wrapper = await mountSuspended(FocusCompare, {
      props: { items: createItems([[0, 1], [1, 2]]), entries: createEntries(2) },
      attachTo: document.body,
    })
    const media = wrapper.find('.compare-focus-media').element as HTMLButtonElement
    media.focus()
    await wrapper.find('.compare-focus-media').trigger('click')
    await nextTick()
    await nextTick()

    expect(wrapper.find('.compare-focus').classes()).toContain('is-immersive')
    expect(wrapper.find('.compare-focus').attributes('role')).toBe('dialog')
    expect(wrapper.find('.compare-focus').attributes('aria-modal')).toBe('true')
    const closeBtn = wrapper.find('.focus-compare-close').element as HTMLButtonElement
    expect(document.activeElement).toBe(closeBtn)

    // Esc 关闭（源 L1125-1128 window keydown）+ 回焦触发元素（源 L815）
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrapper.find('.compare-focus').classes()).not.toContain('is-immersive')
    expect(wrapper.find('.compare-focus').attributes('role')).toBeUndefined()
    expect(wrapper.find('.focus-compare-close').exists()).toBe(false)
    expect(document.activeElement).toBe(media)
    wrapper.unmount()
  })

  it('退出按钮关闭沉浸模式', async () => {
    const wrapper = await mountSuspended(FocusCompare, {
      props: { items: createItems([[0, 1], [1, 2]]), entries: createEntries(2) },
      attachTo: document.body,
    })
    await wrapper.find('.compare-focus-media').trigger('click')
    await nextTick()
    await nextTick()
    expect(wrapper.find('.compare-focus').classes()).toContain('is-immersive')

    await wrapper.find('.focus-compare-close').trigger('click')
    await nextTick()
    expect(wrapper.find('.compare-focus').classes()).not.toContain('is-immersive')
    wrapper.unmount()
  })

  // ── 文案 props 与透传 ──

  it('标题区文案 props 生效', async () => {
    const wrapper = await mountSuspended(FocusCompare, {
      props: {
        items: createItems([[0, 1], [1, 2]]),
        entries: createEntries(2),
        eyebrow: 'FOCUS',
        title: '聚焦比较',
        intro: '自定义引言',
        leftLabel: '左',
        rightLabel: '右',
      },
    })
    expect(wrapper.find('.card-heading > span').text()).toBe('FOCUS')
    expect(wrapper.find('.card-heading h3').text()).toBe('聚焦比较')
    expect(wrapper.find('.compare-focus-intro').text()).toBe('自定义引言')
    const labels = wrapper.findAll('.control-label')
    expect(labels[0]!.text()).toBe('左')
    expect(labels[1]!.text()).toBe('右')
  })

  it('子组件透传 props 生效', async () => {
    const wrapper = await mountSuspended(FocusCompare, {
      props: {
        items: createItems([[0, 1], [1, 2]]),
        entries: createEntries(2),
        rationaleLabel: '优劣分析',
        deltaHeadingLabel: 'Score gap',
      },
    })
    const labels = wrapper.findAll('.compare-focus-label')
    expect(labels[0]!.text()).toBe('优劣分析')
    expect(labels[1]!.text()).toBe('优劣分析')
    expect(wrapper.find('.compare-delta-heading span').text()).toBe('Score gap')
  })

  // ── attrs 透传（先例 RankingCard.spec.ts L171-179）──

  it('attrs 落根元素', async () => {
    const wrapper = await mountSuspended(FocusCompare, {
      props: { items: createItems([[0, 1], [1, 2]]), entries: createEntries(2) },
      attrs: { id: 'focus-compare', class: 'extra' },
    })
    const section = wrapper.find('.compare-focus')
    expect(section.attributes('id')).toBe('focus-compare')
    expect(section.classes()).toContain('extra')
  })
})
