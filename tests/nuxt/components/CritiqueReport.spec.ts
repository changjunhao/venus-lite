import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MarkdownRender from 'markstream-vue'
import CritiqueReport from '~/components/evaluation/CritiqueReport.vue'

/** 三章全传的基准 props */
const fullProps = {
  critique: '构图稳健，光影层次丰富。',
  suggestions: '建议强化前景引导线。',
  arbitrationNotes: '综合双方论证，维持初评判断。',
}

describe('CritiqueReport', () => {
  // ── 结构回归（锚点 single.html L153-157）──

  it('三章全传时渲染 .editorial-report-body 根节点与 3 个 .report-chapter', async () => {
    const wrapper = await mountSuspended(CritiqueReport, { props: fullProps })
    expect(wrapper.classes()).toContain('editorial-report-body')
    expect(wrapper.findAll('.report-chapter')).toHaveLength(3)
  })

  it('各章包含 .section-index 眉标 + h3 标题 + .critique-text 正文', async () => {
    const wrapper = await mountSuspended(CritiqueReport, { props: fullProps })
    const chapters = wrapper.findAll('.report-chapter')
    for (const chapter of chapters) {
      expect(chapter.find('.section-index').exists()).toBe(true)
      expect(chapter.find('h3.chapter-title').exists()).toBe(true)
      expect(chapter.find('.critique-text').exists()).toBe(true)
      expect(chapter.find('.critique-text .markstream-vue').exists()).toBe(true)
    }
  })

  it('眉标文本依次为 CRITIQUE / ACTION / VERDICT', async () => {
    const wrapper = await mountSuspended(CritiqueReport, { props: fullProps })
    const labels = wrapper.findAll('.section-index').map((el) => el.text())
    expect(labels).toEqual(['CRITIQUE', 'ACTION', 'VERDICT'])
  })

  // ── 章节显隐（锚点 group-compare.html L156-160）──

  it('showCritique 为 false 时仅渲染 ACTION + VERDICT 两章', async () => {
    const wrapper = await mountSuspended(CritiqueReport, {
      props: { ...fullProps, showCritique: false },
    })
    const chapters = wrapper.findAll('.report-chapter')
    expect(chapters).toHaveLength(2)
    const labels = wrapper.findAll('.section-index').map((el) => el.text())
    expect(labels).toEqual(['ACTION', 'VERDICT'])
  })

  it('critique 为空字符串时 CRITIQUE 章不渲染', async () => {
    const wrapper = await mountSuspended(CritiqueReport, {
      props: { ...fullProps, critique: '' },
    })
    const labels = wrapper.findAll('.section-index').map((el) => el.text())
    expect(labels).toEqual(['ACTION', 'VERDICT'])
  })

  it('三章内容全空时根节点存在但无 .report-chapter', async () => {
    const wrapper = await mountSuspended(CritiqueReport)
    expect(wrapper.classes()).toContain('editorial-report-body')
    expect(wrapper.findAll('.report-chapter')).toHaveLength(0)
  })

  // ── 眉标与标题 ──

  it('默认标题为中文（专业点评 / 改进建议 / 裁决说明）', async () => {
    const wrapper = await mountSuspended(CritiqueReport, { props: fullProps })
    const titles = wrapper.findAll('h3.chapter-title').map((el) => el.text())
    expect(titles).toEqual(['专业点评', '改进建议', '裁决说明'])
  })

  it('传入自定义标题时覆盖默认值', async () => {
    const wrapper = await mountSuspended(CritiqueReport, {
      props: {
        ...fullProps,
        critiqueTitle: 'Expert Critique',
        suggestionsTitle: 'Suggestions',
        arbitrationTitle: 'Verdict Notes',
      },
    })
    const titles = wrapper.findAll('h3.chapter-title').map((el) => el.text())
    expect(titles).toEqual(['Expert Critique', 'Suggestions', 'Verdict Notes'])
  })

  // ── 修饰符 class（锚点 style.css L939-940）──

  it('ACTION 章携带 .report-suggestions class', async () => {
    const wrapper = await mountSuspended(CritiqueReport, { props: fullProps })
    const chapters = wrapper.findAll('.report-chapter')
    expect(chapters[1]!.classes()).toContain('report-suggestions')
  })

  it('VERDICT 章携带 .report-arbitration class', async () => {
    const wrapper = await mountSuspended(CritiqueReport, { props: fullProps })
    const chapters = wrapper.findAll('.report-chapter')
    expect(chapters[2]!.classes()).toContain('report-arbitration')
  })

  it('CRITIQUE 章无附加修饰 class', async () => {
    const wrapper = await mountSuspended(CritiqueReport, { props: fullProps })
    const chapters = wrapper.findAll('.report-chapter')
    expect(chapters[0]!.classes()).toEqual(['report-chapter'])
  })

  // ── BaseMarkdown 集成 ──

  it('各章 MarkdownRender 接收对应 content 与 final=true', async () => {
    const wrapper = await mountSuspended(CritiqueReport, { props: fullProps })
    const renderers = wrapper.findAllComponents(MarkdownRender)
    expect(renderers).toHaveLength(3)
    expect(renderers[0]!.props('content')).toBe(fullProps.critique)
    expect(renderers[1]!.props('content')).toBe(fullProps.suggestions)
    expect(renderers[2]!.props('content')).toBe(fullProps.arbitrationNotes)
    for (const renderer of renderers) {
      expect(renderer.props('final')).toBe(true)
    }
  })

  // ── attrs 透传（先例 ScorePanel.spec.ts L145-153）──

  it('attrs 落根元素', async () => {
    const wrapper = await mountSuspended(CritiqueReport, {
      props: fullProps,
      attrs: { id: 'critique-report', class: 'extra' },
    })
    expect(wrapper.attributes('id')).toBe('critique-report')
    expect(wrapper.classes()).toContain('extra')
    expect(wrapper.classes()).toContain('editorial-report-body')
  })
})
