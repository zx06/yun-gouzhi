import { describe, expect, it } from 'vitest'
import { buildProfile, buildShape, roundCounts, stuffing, ROUND_H } from '../shape3d'
import { LEVELS } from '../../patterns/levels'
import type { StitchType } from '../../types/stitch'

const byId = Object.fromEntries(LEVELS.map((l) => [l.id, l]))
const rep = (s: StitchType, n: number): StitchType[] => Array(n).fill(s)
const shapeOf = (id: string) => buildShape([...byId[id].rounds, []], { ringSize: 6 })
const ratio = (s: { height: number; maxRadius: number }) => s.height / (2 * s.maxRadius)

describe('roundCounts', () => {
  it('uses produced stitches for finished rounds and predicts the round in progress', () => {
    expect(roundCounts([rep('sc', 6), rep('inc', 6), []])).toEqual([6, 12])
    // 第 2 圈钩了 2 个加针：预计 2×2 + 剩下 4 针短针 = 8
    expect(roundCounts([rep('sc', 6), ['inc', 'inc']])).toEqual([6, 8])
    // 魔术环进行中：关卡里按目标针数，沙盒至少 6
    expect(roundCounts([['sc', 'sc']], { ringSize: 8 })).toEqual([8])
    expect(roundCounts([['sc', 'sc']])).toEqual([6])
    expect(roundCounts([[]])).toEqual([])
  })
})

describe('profile from stitch counts', () => {
  it('+6 stitches per round stays flat', () => {
    const p = buildProfile([6, 12, 18, 24, 30, 36])
    expect(Math.max(...p.map((x) => x.y))).toBeLessThan(0.05)
    // 半径每圈增加约一圈高
    expect(p[5].r - p[4].r).toBeCloseTo(ROUND_H, 1)
  })
  it('straight rounds rise into a vertical tube', () => {
    const p = buildProfile([6, 6, 6, 6, 6, 6, 6])
    const r = p.map((x) => x.r)
    expect(Math.max(...r) - Math.min(...r)).toBeLessThan(0.2)
    expect(p[6].y).toBeGreaterThan(4.5 * ROUND_H)
  })
  it('stuffing only kicks in when the piece closes up', () => {
    expect(stuffing([6, 12, 18, 18, 18])).toBe(0)
    expect(stuffing([6, 12, 18, 18, 12, 6])).toBe(1)
    expect(stuffing([6, 12, 18, 18, 15])).toBeGreaterThan(0)
  })
})

describe('built-in level shapes', () => {
  it('coaster and big circle stay flat', () => {
    for (const id of ['coaster-l1', 'circle-l2']) {
      const s = shapeOf(id)
      expect(ratio(s)).toBeLessThan(0.08)
      // 加针的圈完全平
      expect(s.profile.slice(0, -2).every((p) => p.y < 0.05)).toBe(true)
    }
  })
  it('bowl: flat base then walls rise to an open rim', () => {
    const s = shapeOf('bowl-l3')
    const baseR = 24 / (2 * Math.PI)
    const rim = s.profile[s.profile.length - 1]
    expect(s.profile[2].y).toBeLessThan(0.1) // 碗底平
    expect(rim.y).toBeGreaterThan(baseR * 0.8)
    expect(Math.abs(rim.r - baseR) / baseR).toBeLessThan(0.15)
    expect(rim.phi).toBeGreaterThan(Math.PI * 0.4) // 碗壁接近竖直
    expect(ratio(s)).toBeGreaterThan(0.35)
  })
  it('ball bulges then closes; doll head is roughly spherical', () => {
    for (const [id, lo, hi] of [
      ['ball-l4', 0.9, 1.3],
      ['head-l5', 0.8, 1.2],
    ] as const) {
      const s = shapeOf(id)
      expect(ratio(s)).toBeGreaterThan(lo)
      expect(ratio(s)).toBeLessThan(hi)
      const last = s.profile[s.profile.length - 1]
      expect(last.r).toBeLessThan(s.maxRadius * 0.4)
      expect(last.y).toBeCloseTo(s.height, 5)
      // 最宽处在中间
      const widest = s.profile.findIndex((p) => p.r === s.maxRadius)
      expect(widest).toBeGreaterThan(1)
      expect(widest).toBeLessThan(s.profile.length - 2)
    }
  })
})

describe('stitch poses', () => {
  it('one pose per produced stitch, unique ids, unit orthogonal frames', () => {
    for (const l of LEVELS) {
      const s = buildShape(l.rounds, { ringSize: 6 })
      const produced = l.rounds.flat().reduce((n, t) => n + (t === 'inc' ? 2 : t === 'ch' ? 0 : 1), 0)
      expect(s.stitches).toHaveLength(produced)
      expect(new Set(s.stitches.map((p) => p.id)).size).toBe(produced)
      for (const p of s.stitches) {
        const len = (v: number[]) => Math.hypot(...v)
        const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
        expect(len(p.tangent)).toBeCloseTo(1, 5)
        expect(len(p.up)).toBeCloseTo(1, 5)
        expect(len(p.normal)).toBeCloseTo(1, 5)
        expect(dot(p.tangent, p.up)).toBeCloseTo(0, 5)
        expect(dot(p.tangent, p.normal)).toBeCloseTo(0, 5)
      }
    }
  })
  it('ball: outer normals point away from the axis on the equator', () => {
    const s = shapeOf('ball-l4')
    const eq = s.stitches.filter((p) => p.round === 4)
    for (const p of eq) {
      const radial = [p.position[0], 0, p.position[2]]
      expect(p.normal[0] * radial[0] + p.normal[2] * radial[2]).toBeGreaterThan(0)
    }
  })
  it('seq counts every action (incl. chains) so colour changes line up', () => {
    const s = buildShape([['ch', 'sc', 'inc', 'sc', 'sc', 'sc'], []])
    expect(s.stitches.map((p) => [p.id, p.seq])).toEqual([
      ['0-1', 1],
      ['0-2', 2],
      ['0-2b', 2],
      ['0-3', 3],
      ['0-4', 4],
      ['0-5', 5],
    ])
  })
  it('handles empty and in-progress works', () => {
    expect(buildShape([[]]).stitches).toEqual([])
    const s = buildShape([rep('sc', 6), ['inc', 'inc', 'sc']])
    expect(s.stitches).toHaveLength(6 + 5)
    expect(s.profile).toHaveLength(2)
  })
})
