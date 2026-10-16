import { describe, expect, it } from 'vitest'
import { applyStitch, closeRing, emptyWork, progress, type Work } from '../engine'
import { layoutWork } from '../geometry'
import { COASTER_LEVEL } from '../../patterns/levels'
import type { StitchType } from '../../types/stitch'

function play(seq: StitchType[], ringSize?: number): Work {
  let w = emptyWork()
  for (const t of seq) {
    const r = applyStitch(w, t, { ringSize })
    expect(r.error).toBeUndefined()
    w = r.work
  }
  return w
}

describe('engine', () => {
  it('plays the whole coaster tutorial and closes 5 rounds', () => {
    const w = play(COASTER_LEVEL.rounds.flat(), 6)
    expect(w.rounds.length).toBe(6)
    expect(w.rounds.slice(0, 5)).toEqual(COASTER_LEVEL.rounds)
    expect(w.rounds[5]).toEqual([])
  })
  it('auto-closes a round once every stitch of the previous round is used', () => {
    let w = play(Array(6).fill('sc'), 6)
    expect(progress(w).roundIndex).toBe(1)
    w = play([...Array(6).fill('sc'), 'inc', 'inc', 'inc', 'inc', 'inc'], 6)
    expect(progress(w)).toMatchObject({ roundIndex: 1, remaining: 1, produced: 10 })
  })
  it('rejects dec when only one stitch remains and dec in magic ring', () => {
    expect(applyStitch(emptyWork(), 'dec').error).toMatch(/魔术环/)
    const w = play([...Array(6).fill('sc'), 'dec', 'dec', 'sc'], 6)
    expect(progress(w).remaining).toBe(1)
    expect(applyStitch(w, 'dec').error).toMatch(/只剩 1 针/)
  })
  it('sandbox: magic ring is closed manually (min 3)', () => {
    let w = play(['sc', 'sc'])
    expect(closeRing(w).error).toBeTruthy()
    w = play(['sc', 'sc', 'sc', 'inc'])
    const r = closeRing(w)
    expect(r.error).toBeUndefined()
    expect(progress(r.work)).toMatchObject({ roundIndex: 1, prevCount: 5 })
  })
  it('ch does not consume stitches', () => {
    const w = play([...Array(6).fill('sc'), 'ch'], 6)
    expect(progress(w)).toMatchObject({ roundIndex: 1, consumed: 0, remaining: 6 })
  })
  it('layout places one dot per produced stitch, radius grows per round', () => {
    const w = play(COASTER_LEVEL.rounds.flat(), 6)
    const L = layoutWork(w, 6)
    expect(L.stitches.length).toBe(6 + 12 + 18 + 24 + 24)
    const r = (s: { x: number; y: number }) => Math.hypot(s.x, s.y)
    const r0 = L.stitches.filter((s) => s.round === 0).map(r)
    const r4 = L.stitches.filter((s) => s.round === 4).map(r)
    expect(Math.max(...r0)).toBeLessThan(Math.min(...r4))
  })
})
