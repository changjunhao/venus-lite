import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ResultSample from '~/components/home/ResultSample.vue'
import type { ResultProofItem } from '~/components/home/ResultSample.vue'

/** venus index.html L137-141 源三组依据 */
const proofs: ResultProofItem[] = [
  { term: '优势', detail: '光线方向明确，层次与节奏相互支持。' },
  { term: '改进', detail: '压低边缘高光，让观看路径停留得更久。' },
  { term: '依据', detail: '构图、光影、主体与视觉影响力的综合判断。' },
]

const requiredProps = {
  title: '不止给出分数，也说明判断如何形成。',
  score: 8.2,
  proofs,
  imageSrc: '/assets/editorial/forest.jpg',
  imageAlt: '森林光影摄影作品评估示例',
}

const fullProps = {
  ...requiredProps,
  eyebrow: 'REVIEW SAMPLE',
  scoreCaption: '示例评分',
  scoreBand: '优势明确',
  lede: '光线把观看路径引向画面深处，重复的树干建立稳定节奏；但右侧高光略早终止了视线，削弱了空间延续。',
  imageWidth: 1000,
  imageHeight: 666,
  frameLabel: 'FRAME 02 / REVIEWED',
}

describe('ResultSample', () => {
  it('渲染为 section.home-result-example，aria-labelledby 指向章节标题', async () => {
    const wrapper = await mountSuspended(ResultSample, { props: fullProps })
    const root = wrapper.find('section')
    expect(root.exists()).toBe(true)
    expect(root.classes()).toContain('home-result-example')
    // useId() 生成值不可预期，故断言指向关系而非字面量
    const titleId = wrapper.find('h2').attributes('id')
    expect(titleId).toBeTruthy()
    expect(root.attributes('aria-labelledby')).toBe(titleId)
  })

  it('报告区渲染眉标 / 分数 / 说明 / 标题 / 导语', async () => {
    const wrapper = await mountSuspended(ResultSample, { props: fullProps })
    const report = wrapper.find('article.home-result-report')
    expect(report.find('.section-index').text()).toBe(fullProps.eyebrow)
    expect(report.find('.sample-score strong').text()).toBe('8.2')
    expect(report.find('.sample-score span').text()).toContain('/ 10')
    expect(report.find('.sample-score span').text()).toContain(fullProps.scoreCaption)
    expect(report.find('.sample-score-band').text()).toBe(fullProps.scoreBand)
    expect(report.find('h2').text()).toBe(fullProps.title)
    expect(report.find('.result-lead').text()).toBe(fullProps.lede)
  })

  it('分数以 toFixed(1) 格式化', async () => {
    const wrapper = await mountSuspended(ResultSample, {
      props: { ...requiredProps, score: 8 },
    })
    expect(wrapper.find('.sample-score strong').text()).toBe('8.0')
  })

  it('可选 props 缺席时对应节点不渲染', async () => {
    const wrapper = await mountSuspended(ResultSample, { props: requiredProps })
    expect(wrapper.find('.section-index').exists()).toBe(false)
    expect(wrapper.find('.sample-score-band').exists()).toBe(false)
    expect(wrapper.find('.result-lead').exists()).toBe(false)
    expect(wrapper.find('.frame-index').exists()).toBe(false)
    // scoreCaption 缺席时 span 仅保留 "/ 10"
    expect(wrapper.find('.sample-score span').text()).toBe('/ 10')
  })

  it('proofs 按序渲染为 dl.result-proof-list > div 的 dt/dd', async () => {
    const wrapper = await mountSuspended(ResultSample, { props: fullProps })
    const list = wrapper.find('dl.result-proof-list')
    expect(list.exists()).toBe(true)
    const rows = list.findAll(':scope > div')
    expect(rows).toHaveLength(proofs.length)
    rows.forEach((row, index) => {
      expect(row.find('dt').text()).toBe(proofs[index]?.term)
      expect(row.find('dd').text()).toBe(proofs[index]?.detail)
    })
  })

  it('媒体区图片绑定 src/alt/width/height 并延迟加载', async () => {
    const wrapper = await mountSuspended(ResultSample, { props: fullProps })
    const img = wrapper.find('.home-result-media img')
    expect(img.attributes('src')).toBe(fullProps.imageSrc)
    expect(img.attributes('alt')).toBe(fullProps.imageAlt)
    expect(img.attributes('width')).toBe('1000')
    expect(img.attributes('height')).toBe('666')
    expect(img.attributes('loading')).toBe('lazy')
    expect(img.attributes('decoding')).toBe('async')
  })

  it('帧号角标渲染于媒体区', async () => {
    const wrapper = await mountSuspended(ResultSample, { props: fullProps })
    const badge = wrapper.find('.home-result-media .frame-index')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe(fullProps.frameLabel)
  })

  // 调用方 class 是既定的语义扩展点，不得被内部 class 覆盖
  it('调用方 class 与内部 class 合并', async () => {
    const wrapper = await mountSuspended(ResultSample, {
      props: requiredProps,
      attrs: { class: 'home-section' },
    })
    const classes = wrapper.find('section').classes()
    expect(classes).toContain('home-result-example')
    expect(classes).toContain('home-section')
  })

  // 锚点 id 归页面信息架构，经 attrs 透传而非组件内硬编码
  it('属性透传至根元素', async () => {
    const wrapper = await mountSuspended(ResultSample, {
      props: requiredProps,
      attrs: { id: 'sample' },
    })
    expect(wrapper.find('section').attributes('id')).toBe('sample')
  })
})
