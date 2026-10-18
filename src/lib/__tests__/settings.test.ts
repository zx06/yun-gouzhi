import { describe, expect, it } from 'vitest'
import { changeColor, colorAt, currentColor, sanitizeColorChanges, trimColorChanges } from '../colors'
import { defaultSettings, loadSettings, parseSettings, resolveView, saveSettings, SETTINGS_KEY } from '../settings'

const kv = () => {
  const m = new Map<string, string>()
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

describe('settings persistence', () => {
  it('defaults: auto view, sound on', () => {
    expect(defaultSettings()).toEqual({ view: null, muted: false })
    expect(loadSettings(kv())).toEqual({ view: null, muted: false })
  })
  it('saves and loads view + mute', () => {
    const s = kv()
    expect(saveSettings(s, { view: '2d', muted: true })).toBe(true)
    expect(JSON.parse(s.m.get(SETTINGS_KEY)!)).toMatchObject({ version: 1, view: '2d', muted: true })
    expect(loadSettings(s)).toEqual({ view: '2d', muted: true })
  })
  it('ignores garbage', () => {
    expect(parseSettings('{bad')).toEqual(defaultSettings())
    expect(parseSettings('{"view":"4d","muted":"yes"}')).toEqual(defaultSettings())
    expect(parseSettings('null')).toEqual(defaultSettings())
    const throwing = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('quota')
      },
    }
    expect(loadSettings(throwing)).toEqual(defaultSettings())
    expect(saveSettings(throwing, defaultSettings())).toBe(false)
  })
  it('resolves 3D only when WebGL works', () => {
    expect(resolveView({ view: null, muted: false }, true)).toBe('3d')
    expect(resolveView({ view: null, muted: false }, false)).toBe('2d')
    expect(resolveView({ view: '2d', muted: false }, true)).toBe('2d')
    expect(resolveView({ view: '3d', muted: false }, false)).toBe('2d')
  })
})

describe('colour changes', () => {
  it('changing before the first stitch changes the base colour', () => {
    expect(changeColor('#ff0000', [], 0, '#00FF00')).toEqual({ base: '#00ff00', changes: [] })
  })
  it('records a change from the next stitch and colours stitches accordingly', () => {
    let st = changeColor('#ff0000', [], 6, '#00ff00')
    expect(st.changes).toEqual([{ from: 6, color: '#00ff00' }])
    st = changeColor(st.base, st.changes, 6, '#0000ff') // 同一位置再换：只留最后一次
    expect(st.changes).toEqual([{ from: 6, color: '#0000ff' }])
    st = changeColor(st.base, st.changes, 10, '#0000ff') // 换成当前颜色：不记录
    expect(st.changes).toHaveLength(1)
    st = changeColor(st.base, st.changes, 12, '#ff0000')
    expect([0, 5, 6, 11, 12, 99].map((i) => colorAt(i, st.base, st.changes))).toEqual(['#ff0000', '#ff0000', '#0000ff', '#0000ff', '#ff0000', '#ff0000'])
    expect(currentColor(st.base, st.changes)).toBe('#ff0000')
  })
  it('trim drops changes that start after the undo point but keeps a pending one', () => {
    const ch = [
      { from: 6, color: '#00ff00' },
      { from: 12, color: '#0000ff' },
    ]
    expect(trimColorChanges(ch, 12)).toEqual(ch)
    expect(trimColorChanges(ch, 11)).toEqual([ch[0]])
  })
  it('sanitizes stored changes', () => {
    expect(
      sanitizeColorChanges([{ from: 9, color: '#ABCDEF' }, { from: 3, color: '#111111' }, { from: 3, color: '#222222' }, { from: -1, color: '#333333' }, { from: 1.5, color: '#444444' }, { from: 4, color: 'red' }, null]),
    ).toEqual([
      { from: 3, color: '#222222' },
      { from: 9, color: '#abcdef' },
    ])
    expect(sanitizeColorChanges('x')).toEqual([])
  })
})
