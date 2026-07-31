import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ScorePanel from '~/components/evaluation/ScorePanel.vue'

describe('ScorePanel', () => {
  // ── 结构回归（锚点 single.html L141-149）──

  it('渲染 .score-display 根节点与完整刻度结构', async () => {
    const wrapper = await mountSuspended(ScorePanel, { props: { score: 7.2 } })
    expect(wrapper.classes()).toContain('score-display')
    expect(wrapper.find('.score-readout').exists()).toBe(true)
    expect(wrapper.find('.score-scale-track').exists()).toBe(true)
    expect(wrapper.find('.score-scale-fill').exists()).toBe(true)

    const ends = wrapper.findAll('.score-scale-ends span')
    expect(ends).toHaveLength(2)
    expect(ends[0]!.text()).toBe('0')
    expect(ends[1]!.text()).toBe('10')
  })

  it('分数以真实文本渲染并附 / 10 标签（§9.10）', async () => {
    const wrapper = await mountSuspended(ScorePanel, { props: { score: 7.2 } })
    expect(wrapper.find('.score-number').text()).toBe('7.2')
    expect(wrapper.find('.score-max').text()).toBe('/ 10')
  })

  // ── 分数格式化（回归锚点：app.js L618 toFixed(1)）──

  it('分数保留一位小数', async () => {
    const wrapper = await mountSuspended(ScorePanel, { props: { score: 7.25 } })
    expect(wrapper.find('.score-number').text()).toBe('7.3')
  })

  it('整数分数补零展示', async () => {
    const wrapper = await mountSuspended(ScorePanel, { props: { score: 8 } })
    expect(wrapper.find('.score-number').text()).toBe('8.0')
  })

  // ── NaN 防御（回归锚点：app.js L616-617）──

  it('NaN 输入回退为 0.0 且 band 为 unformed', async () => {
    const wrapper = await mountSuspended(ScorePanel, { props: { score: Number.NaN } })
    expect(wrapper.find('.score-number').text()).toBe('0.0')
    expect(wrapper.find('.score-band').classes()).toContain('score-red')
    expect(wrapper.find('.score-band').text()).toBe('尚未成形')
  })

  // ── Band class 映射（回归锚点：venus utils.js L46-51 阈值）──

  it('4.9 → score-red + 尚未成形', async () => {
    const wrapper = await mountSuspended(ScorePanel, { props: { score: 4.9 } })
    const band = wrapper.find('.score-band')
    expect(band.classes()).toContain('score-red')
    expect(band.text()).toBe('尚未成形')
  })

  it('5.0 → score-orange + 基础成立', async () => {
    const wrapper = await mountSuspended(ScorePanel, { props: { score: 5.0 } })
    const band = wrapper.find('.score-band')
    expect(band.classes()).toContain('score-orange')
    expect(band.text()).toBe('基础成立')
  })

  it('6.5 → score-blue + 表达清晰', async () => {
    const wrapper = await mountSuspended(ScorePanel, { props: { score: 6.5 } })
    const band = wrapper.find('.score-band')
    expect(band.classes()).toContain('score-blue')
    expect(band.text()).toBe('表达清晰')
  })

  it('8.0 → score-green + 优势明确', async () => {
    const wrapper = await mountSuspended(ScorePanel, { props: { score: 8.0 } })
    const band = wrapper.find('.score-band')
    expect(band.classes()).toContain('score-green')
    expect(band.text()).toBe('优势明确')
  })

  // ── bandLabel prop 覆盖 ──

  it('传入 bandLabel 时覆盖默认 band.label', async () => {
    const wrapper = await mountSuspended(ScorePanel, {
      props: { score: 8.5, bandLabel: 'Distinct strength' },
    })
    expect(wrapper.find('.score-band').text()).toBe('Distinct strength')
    // class 仍由 score 派生
    expect(wrapper.find('.score-band').classes()).toContain('score-green')
  })

  // ── caption ──

  it('传入 caption 时渲染 .score-caption', async () => {
    const wrapper = await mountSuspended(ScorePanel, {
      props: { score: 7, caption: '综合评分' },
    })
    expect(wrapper.find('.score-caption').text()).toBe('综合评分')
  })

  it('未传 caption 时不渲染 .score-caption', async () => {
    const wrapper = await mountSuspended(ScorePanel, { props: { score: 7 } })
    expect(wrapper.find('.score-caption').exists()).toBe(false)
  })

  // ── 刻度条动画（回归锚点：app.js L628-631 rAF + width）──

  it('初始渲染 fill width 为 0%', async () => {
    // rAF 不执行回调时保持初始态
    vi.stubGlobal('requestAnimationFrame', () => 0)
    const wrapper = await mountSuspended(ScorePanel, { props: { score: 7.2 } })
    expect(wrapper.find('.score-scale-fill').attributes('style')).toContain('width: 0%')
    vi.unstubAllGlobals()
  })

  it('rAF 回调后 fill width 过渡到 score×10%', async () => {
    // rAF 同步化：立即执行回调
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    const wrapper = await mountSuspended(ScorePanel, { props: { score: 7.2 } })
    await nextTick()
    expect(wrapper.find('.score-scale-fill').attributes('style')).toContain('width: 72%')
    vi.unstubAllGlobals()
  })

  it('score 超出 10 时 fill 钳制为 100%', async () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    const wrapper = await mountSuspended(ScorePanel, { props: { score: 11 } })
    await nextTick()
    expect(wrapper.find('.score-scale-fill').attributes('style')).toContain('width: 100%')
    vi.unstubAllGlobals()
  })

  // ── 无障碍（§14.4）──

  it('.score-scale 携带 aria-hidden="true"', async () => {
    const wrapper = await mountSuspended(ScorePanel, { props: { score: 7 } })
    expect(wrapper.find('.score-scale').attributes('aria-hidden')).toBe('true')
  })

  // ── attrs 透传（先例 StreamSteps.spec.ts）──

  it('attrs 落根元素', async () => {
    const wrapper = await mountSuspended(ScorePanel, {
      props: { score: 7 },
      attrs: { id: 'result-score', class: 'extra' },
    })
    expect(wrapper.attributes('id')).toBe('result-score')
    expect(wrapper.classes()).toContain('extra')
    expect(wrapper.classes()).toContain('score-display')
  })
})
