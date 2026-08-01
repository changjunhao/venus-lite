import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ResultMasthead from '~/components/evaluation/ResultMasthead.vue'

describe('ResultMasthead', () => {
  // ── 结构回归（锚点 single.html L126-129 / group-joint.html L104）──

  it('渲染 .result-masthead 根节点与完整结构', async () => {
    const wrapper = await mountSuspended(ResultMasthead, {
      props: { title: '单图评估结果', tag: '人像 · 室内人像' },
    })
    expect(wrapper.classes()).toContain('result-masthead')
    expect(wrapper.find('.section-index').exists()).toBe(true)
    expect(wrapper.find('h2').exists()).toBe(true)
    expect(wrapper.find('.result-tags').exists()).toBe(true)
    expect(wrapper.find('.result-tag').exists()).toBe(true)
  })

  it('RESULT 眉标硬编码于模板（§4.2 摄影语义常量）', async () => {
    const wrapper = await mountSuspended(ResultMasthead, {
      props: { title: '单图评估结果' },
    })
    expect(wrapper.find('.section-index').text()).toBe('RESULT')
  })

  // ── 标题渲染 ──

  it('h2 渲染 title prop 文本', async () => {
    const wrapper = await mountSuspended(ResultMasthead, {
      props: { title: '组图联合评估结果' },
    })
    expect(wrapper.find('h2').text()).toBe('组图联合评估结果')
  })

  it('标题使用 h2 级别（结果区直隶页面 h1）', async () => {
    const wrapper = await mountSuspended(ResultMasthead, {
      props: { title: '组图对比评估结果' },
    })
    expect(wrapper.find('h2').element.tagName).toBe('H2')
  })

  // ── 门类·场景标签（§15.1）──

  it('传入 tag 时渲染 .result-tag 文本', async () => {
    const wrapper = await mountSuspended(ResultMasthead, {
      props: { title: '单图评估结果', tag: '风光 · 山岳' },
    })
    expect(wrapper.find('.result-tag').text()).toBe('风光 · 山岳')
  })

  it('未传 tag 时不渲染 .result-tags 区域', async () => {
    const wrapper = await mountSuspended(ResultMasthead, {
      props: { title: '组图对比评估结果' },
    })
    expect(wrapper.find('.result-tags').exists()).toBe(false)
  })

  it('tag 为空串时不渲染 .result-tags 区域', async () => {
    const wrapper = await mountSuspended(ResultMasthead, {
      props: { title: '组图对比评估结果', tag: '' },
    })
    expect(wrapper.find('.result-tags').exists()).toBe(false)
  })

  // ── attrs 透传（先例 ScorePanel.spec.ts）──

  it('attrs 落根元素', async () => {
    const wrapper = await mountSuspended(ResultMasthead, {
      props: { title: '单图评估结果' },
      attrs: { id: 'result-masthead', class: 'extra' },
    })
    expect(wrapper.attributes('id')).toBe('result-masthead')
    expect(wrapper.classes()).toContain('extra')
    expect(wrapper.classes()).toContain('result-masthead')
  })
})
