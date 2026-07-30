import { describe, expect, it } from 'vitest'
import { splitFileName } from '#shared/utils/format'

describe('splitFileName', () => {
  it('常规文件名拆分为主体与含点扩展名', () => {
    expect(splitFileName('photo.jpg')).toEqual({ stem: 'photo', ext: '.jpg' })
  })

  it('多点文件名只在最后一个点拆分', () => {
    expect(splitFileName('a.b.c.jpg')).toEqual({ stem: 'a.b.c', ext: '.jpg' })
  })

  it('无点文件名不拆分', () => {
    expect(splitFileName('photo')).toEqual({ stem: 'photo', ext: '' })
  })

  // dot === 0 视为无扩展名（点开头的隐藏文件）
  it('点开头文件名不拆分', () => {
    expect(splitFileName('.gitignore')).toEqual({ stem: '.gitignore', ext: '' })
  })

  it('点结尾文件名不拆分', () => {
    expect(splitFileName('photo.')).toEqual({ stem: 'photo.', ext: '' })
  })

  // 含点扩展名最长 8 字符：恰好 8 保留，9 起不拆
  it('扩展名长度边界', () => {
    expect(splitFileName('a.abcdefg')).toEqual({ stem: 'a', ext: '.abcdefg' })
    expect(splitFileName('a.abcdefgh')).toEqual({ stem: 'a.abcdefgh', ext: '' })
  })

  it('空字符串返回空主体与空扩展名', () => {
    expect(splitFileName('')).toEqual({ stem: '', ext: '' })
  })
})
