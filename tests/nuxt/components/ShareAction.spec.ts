import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ShareAction from '~/components/share/ShareAction.vue'

// venus single.html L179-184 #share-btn 的真实文案
const label = '生成分享图'

describe('ShareAction', () => {
  it('idle 态渲染 .btn-share 变体与默认文案，图标 aria-hidden', async () => {
    const wrapper = await mountSuspended(ShareAction)
    const button = wrapper.find('button')
    expect(button.classes()).toContain('btn')
    expect(button.classes()).toContain('btn-share')
    expect(button.text()).toBe(label)
    expect(button.attributes('disabled')).toBeUndefined()
    expect(button.attributes('aria-busy')).toBeUndefined()

    const svg = button.find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.attributes('aria-hidden')).toBe('true')
  })

  it('disabled=true 时按钮禁用', async () => {
    const wrapper = await mountSuspended(ShareAction, {
      props: { disabled: true },
    })
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it.each([
    ['loading-image', '正在读取照片…'],
    ['generating', '正在生成分享图…'],
    ['exporting', '正在准备预览…'],
  ] as const)('phase=%s 时 loading 禁用 + aria-busy + 文案「%s」', async (phase, text) => {
    const wrapper = await mountSuspended(ShareAction, {
      props: { phase },
    })
    const button = wrapper.find('button')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('aria-busy')).toBe('true')
    expect(button.text()).toBe(text)
  })

  it('error 非空且 idle 时显示失败文案，按钮恢复可点击（app.js L290-292）', async () => {
    const wrapper = await mountSuspended(ShareAction, {
      props: { error: '生成分享图失败' },
    })
    const button = wrapper.find('button')
    expect(button.text()).toBe('生成失败，请重试')
    expect(button.attributes('disabled')).toBeUndefined()
    expect(button.attributes('aria-busy')).toBeUndefined()
  })

  it('phase 非 idle 时 error 不覆盖进度文案', async () => {
    const wrapper = await mountSuspended(ShareAction, {
      props: { phase: 'generating', error: '生成分享图失败' },
    })
    expect(wrapper.find('button').text()).toBe('正在生成分享图…')
  })

  it('点击 emit generate', async () => {
    const wrapper = await mountSuspended(ShareAction)
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('generate')).toHaveLength(1)
  })

  it('i18n labels 由调用方传入覆盖默认值', async () => {
    const wrapper = await mountSuspended(ShareAction, {
      props: { label: 'Generate share image', phase: 'generating', generatingLabel: 'Generating share image…' },
    })
    expect(wrapper.find('button').text()).toBe('Generating share image…')

    await wrapper.setProps({ phase: 'idle' })
    expect(wrapper.find('button').text()).toBe('Generate share image')
  })
})
