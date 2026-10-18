import { describe, expect, it } from 'vitest'
import { applyStitch, emptyWork } from '../engine'
import { checkRounds, countProduced, parsePattern } from '../pattern'
import { levelRoundsError } from '../storage'
import { LEVELS, isLevelUnlocked, nextLevel } from '../../patterns/levels'
import { customLevelToLevel, makeLevelFromRounds } from '../../patterns/custom'
import { sanitizePrefs, starsFor } from '../../store/crochetStore'

const EXPECTED_COUNTS: Record<string, number[]> = {
  'coaster-l1': [6, 12, 18, 24, 24],
  'circle-l2': [6, 12, 18, 24, 30, 36, 36],
  'bowl-l3': [6, 12, 18, 24, 24, 24, 24, 24],
  'ball-l4': [6, 12, 18, 18, 18, 18, 12, 6],
  'head-l5': [6, 12, 18, 24, 30, 30, 30, 30, 24, 18, 12, 6],
}

describe('built-in levels', () => {
  it('has 5 levels in difficulty order with unique ids', () => {
    expect(LEVELS.map((l) => l.id)).toEqual(Object.keys(EXPECTED_COUNTS))
    const sizes = LEVELS.map((l) => l.rounds.length)
    expect(sizes[sizes.length - 1]).toBe(Math.max(...sizes))
  })

  for (const level of LEVELS) {
    it(`${level.title}: stitch counts are crochet-correct`, () => {
      const parsed = parsePattern(level.pattern)
      expect(parsed.errors).toEqual([])
      expect(level.rounds.map(countProduced)).toEqual(EXPECTED_COUNTS[level.id])
      expect(checkRounds(level.rounds).every((c) => c.ok)).toBe(true)
      expect(levelRoundsError(level.rounds)).toBeNull()
      expect(level.tips).toHaveLength(level.rounds.length)
      // only the four basic stitches
      expect(level.rounds.flat().every((s) => ['ch', 'sc', 'inc', 'dec'].includes(s))).toBe(true)
    })

    it(`${level.title}: can be played to the end in the engine`, () => {
      let w = emptyWork()
      const ringSize = countProduced(level.rounds[0])
      for (const t of level.rounds.flat()) {
        const r = applyStitch(w, t, { ringSize })
        expect(r.error).toBeUndefined()
        w = r.work
      }
      expect(w.rounds.length - 1).toBe(level.rounds.length)
      expect(w.rounds.slice(0, -1)).toEqual(level.rounds)
    })
  }

  it('ball and doll head use decreases, bowl has straight rounds', () => {
    const byId = Object.fromEntries(LEVELS.map((l) => [l.id, l]))
    expect(byId['ball-l4'].rounds.flat()).toContain('dec')
    expect(byId['head-l5'].rounds.flat()).toContain('dec')
    expect(byId['bowl-l3'].rounds.slice(4).every((r) => r.every((s) => s === 'sc'))).toBe(true)
  })
})

describe('level unlock', () => {
  it('first level is always open, next opens after ≥1 star', () => {
    expect(isLevelUnlocked(0, {})).toBe(true)
    expect(isLevelUnlocked(1, {})).toBe(false)
    expect(isLevelUnlocked(1, { 'coaster-l1': 1 })).toBe(true)
    expect(isLevelUnlocked(2, { 'coaster-l1': 3 })).toBe(false)
    expect(isLevelUnlocked(2, { 'coaster-l1': 3, 'circle-l2': 2 })).toBe(true)
    expect(isLevelUnlocked(4, { 'ball-l4': 0 })).toBe(false)
    expect(isLevelUnlocked(99, {})).toBe(false)
  })
  it('nextLevel walks the list', () => {
    expect(nextLevel('coaster-l1')?.id).toBe('circle-l2')
    expect(nextLevel('head-l5')).toBeNull()
    expect(nextLevel('my-x')).toBeNull()
  })
  it('stars by mistakes', () => {
    expect([0, 1, 3, 4, 10].map(starsFor)).toEqual([3, 2, 2, 1, 1])
  })
})

describe('custom level helpers', () => {
  it('makeLevelFromRounds validates playability', () => {
    expect(() => makeLevelFromRounds([])).toThrow()
    expect(() => makeLevelFromRounds([['sc', 'dec']])).toThrow(/减针/)
    expect(makeLevelFromRounds(LEVELS[0].rounds).rounds).toEqual(LEVELS[0].rounds)
  })
  it('customLevelToLevel marks custom', () => {
    const l = customLevelToLevel({ id: 'my-1', title: 'T', rounds: LEVELS[0].rounds, source: 'work', createdAt: 0, bestStars: 0, bestMistakes: null })
    expect(l.custom).toBe(true)
    expect(l.pattern).toContain('第1圈')
  })
})

describe('prefs migration', () => {
  it('sanitizes prefs and falls back to the phase-1 yarn colour', () => {
    expect(sanitizePrefs(null, { yarnColor: '#16a34a' }).yarnColor).toBe('#16a34a')
    const p = sanitizePrefs({ notation: 'xx', bestStars: { 'coaster-l1': 2, bad: 'x', big: 9 }, yarnColor: 'red' })
    expect(p).toMatchObject({ notation: 'zh', bestStars: { 'coaster-l1': 2 }, yarnColor: '#e11d48' })
  })
})
