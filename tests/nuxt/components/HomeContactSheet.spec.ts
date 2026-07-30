import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import HomeContactSheet from '~/components/home/HomeContactSheet.vue'

/** venus index.html L57-74 源三帧 */
const frames = [
  {
    src: '/assets/editorial/landscape.jpg',
    alt: '山脉与云层的风光摄影示例',
    caption: 'LANDSCAPE',
    width: 1200,
    height: 1800,
  },
  {
    src: '/assets/editorial/forest.jpg',
    alt: '森林光影摄影示例',
    caption: 'LIGHT',
    width: 1000,
    height: 666,
  },
  {
    src: '/assets/editorial/water.jpg',
    alt: '水面纹理摄影示例',
    caption: 'RHYTHM',
    width: 1000,
    height: 667,
  },
]

const requiredProps = {
  frames,
  ariaLabel: '摄影作品接触印样示例',
}

describe('HomeContactSheet', () => {
  it('渲染为 aside.home-contact-sheet，aria-label 正确', async () => {
    const wrapper = await mountSuspended(HomeContactSheet, {
      props: requiredProps,
    })
    const root = wrapper.find('aside')
    expect(root.exists()).toBe(true)
    expect(root.classes()).toContain('home-contact-sheet')
    expect(root.attributes('aria-label')).toBe('摄影作品接触印样示例')
  })

  it('frames 按序渲染为 figure.contact-frame，img 绑定 src/alt/width/height', async () => {
    const wrapper = await mountSuspended(HomeContactSheet, {
      props: requiredProps,
    })
    const figures = wrapper.findAll('figure.contact-frame')
    expect(figures).toHaveLength(3)
    figures.forEach((figure, index) => {
      const img = figure.find('img')
      expect(img.attributes('src')).toBe(frames[index]?.src)
      expect(img.attributes('alt')).toBe(frames[index]?.alt)
      expect(img.attributes('width')).toBe(String(frames[index]?.width))
      expect(img.attributes('height')).toBe(String(frames[index]?.height))
    })
  })

  it('仅首帧含 contact-frame-primary', async () => {
    const wrapper = await mountSuspended(HomeContactSheet, {
      props: requiredProps,
    })
    const figures = wrapper.findAll('figure.contact-frame')
    expect(figures[0]?.classes()).toContain('contact-frame-primary')
    expect(figures[1]?.classes()).not.toContain('contact-frame-primary')
    expect(figures[2]?.classes()).not.toContain('contact-frame-primary')
  })

  it('FRAME 编号按序补零生成，figcaption 第二个 span 为 caption', async () => {
    const wrapper = await mountSuspended(HomeContactSheet, {
      props: requiredProps,
    })
    const captions = wrapper.findAll('figcaption')
    expect(captions.map(caption => caption.findAll('span')[0]?.text()))
      .toEqual(['FRAME 01', 'FRAME 02', 'FRAME 03'])
    expect(captions.map(caption => caption.findAll('span')[1]?.text()))
      .toEqual(['LANDSCAPE', 'LIGHT', 'RHYTHM'])
  })

  it('noteLabel/noteText 齐备时渲染注记行', async () => {
    const wrapper = await mountSuspended(HomeContactSheet, {
      props: {
        ...requiredProps,
        noteLabel: 'CONTACT / 01—03',
        noteText: '先看见照片之间的关系，再形成判断。',
      },
    })
    const note = wrapper.find('.contact-sheet-note')
    expect(note.exists()).toBe(true)
    expect(note.find('span').text()).toBe('CONTACT / 01—03')
    expect(note.find('p').text()).toBe('先看见照片之间的关系，再形成判断。')
  })

  it('noteLabel/noteText 均缺席时不渲染注记行', async () => {
    const wrapper = await mountSuspended(HomeContactSheet, {
      props: requiredProps,
    })
    expect(wrapper.find('.contact-sheet-note').exists()).toBe(false)
  })

  // 调用方 class 是既定的语义扩展点，不得被内部 class 覆盖
  it('调用方 class 与内部 class 合并', async () => {
    const wrapper = await mountSuspended(HomeContactSheet, {
      props: requiredProps,
      attrs: { class: 'home-hero-sheet' },
    })
    const classes = wrapper.find('aside').classes()
    expect(classes).toContain('home-contact-sheet')
    expect(classes).toContain('home-hero-sheet')
  })

  it('属性透传至根元素', async () => {
    const wrapper = await mountSuspended(HomeContactSheet, {
      props: requiredProps,
      attrs: { id: 'home-contact-sheet' },
    })
    expect(wrapper.find('aside').attributes('id')).toBe('home-contact-sheet')
  })
})
