import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ProcessSection from '~/components/home/ProcessSection.vue'
import type { ProcessStepItem } from '~/components/home/ProcessSection.vue'

/** venus index.html L119-124 源四步 */
const steps: ProcessStepItem[] = [
  { title: '门类识别', description: '识别摄影门类，为作品选择适合的评估维度和语境。' },
  { title: '提案者初评', description: '观察照片，形成维度评分、作品点评与初步建议。' },
  { title: '批判者质疑', description: '检查初评中的偏差、证据不足和评分不一致。' },
  { title: '仲裁者裁决', description: '综合双方论证，形成最终评分、排序或系列结论。' },
]

const requiredProps = {
  title: '不是一次回答，而是一场有依据的审美辩论。',
  steps,
}

const fullProps = {
  ...requiredProps,
  eyebrow: 'METHOD',
  lede: '三个评审角色从不同立场审视作品，让分数经得起质疑，也让建议能够回到下一次拍摄与编辑。',
}

describe('ProcessSection', () => {
  it('渲染为 section.home-process，aria-labelledby 指向章节标题', async () => {
    const wrapper = await mountSuspended(ProcessSection, { props: fullProps })
    const root = wrapper.find('section')
    expect(root.exists()).toBe(true)
    expect(root.classes()).toContain('home-process')
    // useId() 生成值不可预期，故断言指向关系而非字面量
    const titleId = wrapper.find('h2').attributes('id')
    expect(titleId).toBeTruthy()
    expect(root.attributes('aria-labelledby')).toBe(titleId)
  })

  it('导语区渲染眉标 / h2 / 导语', async () => {
    const wrapper = await mountSuspended(ProcessSection, { props: fullProps })
    const intro = wrapper.find('.home-process-intro')
    expect(intro.find('.section-index').text()).toBe(fullProps.eyebrow)
    expect(intro.find('h2').text()).toBe(fullProps.title)
    expect(intro.find('p').text()).toBe(fullProps.lede)
  })

  it('可选文案缺席时对应节点不渲染', async () => {
    const wrapper = await mountSuspended(ProcessSection, { props: requiredProps })
    const intro = wrapper.find('.home-process-intro')
    expect(intro.find('.section-index').exists()).toBe(false)
    expect(intro.find('p').exists()).toBe(false)
  })

  it('steps 按序渲染为 ol.home-process-list > li', async () => {
    const wrapper = await mountSuspended(ProcessSection, { props: fullProps })
    const list = wrapper.find('ol.home-process-list')
    expect(list.exists()).toBe(true)
    expect(list.findAll(':scope > li')).toHaveLength(steps.length)
  })

  it('编号按序补零派生', async () => {
    const wrapper = await mountSuspended(ProcessSection, { props: fullProps })
    const numbers = wrapper.findAll('.home-process-list > li')
      .map(li => li.find(':scope > span').text())
    expect(numbers).toEqual(['01', '02', '03', '04'])
  })

  it('每步渲染标题与说明', async () => {
    const wrapper = await mountSuspended(ProcessSection, { props: fullProps })
    wrapper.findAll('.home-process-list > li').forEach((li, index) => {
      const step = steps[index]
      expect(li.find('strong').text()).toBe(step?.title)
      expect(li.find('div > p').text()).toBe(step?.description)
    })
  })

  it('说明缺席时对应 p 不渲染', async () => {
    const wrapper = await mountSuspended(ProcessSection, {
      props: {
        ...requiredProps,
        steps: [{ title: '仅标题' }],
      },
    })
    expect(wrapper.find('.home-process-list strong').text()).toBe('仅标题')
    expect(wrapper.find('.home-process-list div > p').exists()).toBe(false)
  })

  // 调用方 class 是既定的语义扩展点，不得被内部 class 覆盖
  it('调用方 class 与内部 class 合并', async () => {
    const wrapper = await mountSuspended(ProcessSection, {
      props: requiredProps,
      attrs: { class: 'home-section' },
    })
    const classes = wrapper.find('section').classes()
    expect(classes).toContain('home-process')
    expect(classes).toContain('home-section')
  })

  // 锚点 id 归页面信息架构，经 attrs 透传而非组件内硬编码
  it('属性透传至根元素', async () => {
    const wrapper = await mountSuspended(ProcessSection, {
      props: requiredProps,
      attrs: { id: 'process' },
    })
    expect(wrapper.find('section').attributes('id')).toBe('process')
  })
})
