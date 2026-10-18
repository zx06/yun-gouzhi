import { describe, expect, it } from 'vitest'
import { stitchParents, stitchChildren } from '../stitchTopology'
import { buildShape } from '../shape3d'
import { LEVELS } from '../../patterns/levels'
import type { StitchType } from '../../types/stitch'

const rep = (s: StitchType, n: number): StitchType[] => Array(n).fill(s)

describe('stitchParents', () => {
  it('first round hooks into the magic ring (no parents)', () => {
    const l = stitchParents([rep('sc', 6)])
    expect(l).toHaveLength(6)
    expect(l.every((x) => x.parents.length === 0)).toBe(true)
  })

  it('sc maps one-to-one onto the previous round', () => {
    const l = stitchParents([rep('sc', 6), rep('sc', 6)])
    expect(l.slice(6).map((x) => x.parents)).toEqual([[0], [1], [2], [3], [4], [5]])
  })

  it('inc: two stitches share one parent loop', () => {
    const l = stitchParents([rep('sc', 6), rep('inc', 6)])
    const r2 = l.slice(6)
    expect(r2).toHaveLength(12)
    expect(r2.map((x) => x.parents[0])).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
    const kids = stitchChildren(l)
    for (let p = 0; p < 6; p++) expect(kids[p]).toHaveLength(2)
  })

  it('dec: one stitch joins two parents', () => {
    const l = stitchParents([rep('sc', 6), rep('inc', 6), rep('dec', 6)])
    const r3 = l.slice(18)
    expect(r3).toHaveLength(6)
    expect(r3.map((x) => x.parents)).toEqual([[6, 7], [8, 9], [10, 11], [12, 13], [14, 15], [16, 17]])
  })

  it('mixed sc/inc/dec consume parents in order; chains make no stitch', () => {
    const l = stitchParents([rep('sc', 6), ['sc', 'inc', 'ch', 'dec', 'sc', 'sc']])
    expect(l.slice(6).map((x) => [x.type, x.parents])).toEqual([
      ['sc', [0]],
      ['inc', [1]],
      ['inc', [1]],
      ['dec', [2, 3]],
      ['sc', [4]],
      ['sc', [5]],
    ])
  })

  it('skips empty rounds and tolerates an in-progress round', () => {
    const l = stitchParents([rep('sc', 6), ['sc', 'sc'], []])
    expect(l.slice(6).map((x) => x.parents)).toEqual([[0], [1]])
    // 上一圈针数不够（坏存档）：多出来的针没有父针，不报错
    const bad = stitchParents([rep('sc', 2), rep('dec', 3)])
    expect(bad.slice(2).map((x) => x.parents)).toEqual([[0, 1], [], []])
  })

  it('aligns with buildShape stitches for every level and every parent is in the previous round', () => {
    for (const lv of LEVELS) {
      const rounds = [...lv.rounds, []]
      const shape = buildShape(rounds, { ringSize: lv.rounds[0]?.length })
      const links = stitchParents(rounds)
      expect(links).toHaveLength(shape.stitches.length)
      links.forEach((x, i) => {
        expect(shape.stitches[i].type).toBe(x.type)
        for (const p of x.parents) expect(shape.stitches[p].round).toBeLessThan(shape.stitches[i].round)
      })
      // 每个非首圈的针都至少被钩一次（闭合的圈全部用完）
      const kids = stitchChildren(links)
      const lastRound = shape.stitches[shape.stitches.length - 1]?.round
      shape.stitches.forEach((s, i) => {
        if (s.round !== lastRound) expect(kids[i].length).toBeGreaterThan(0)
      })
    }
  })
})
