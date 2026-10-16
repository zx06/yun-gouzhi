import { describe, expect, it } from 'vitest'
import { checkRounds, countProduced, findRepeat, formatPattern, formatRound, parsePattern, parseRoundBody } from '../pattern'
import { COASTER_LEVEL, BALL_PATTERN } from '../../patterns/levels'
import type { StitchType } from '../../types/stitch'

const S = (s: string) => s.split(' ') as StitchType[]

describe('parseRoundBody', () => {
  it('parses Chinese symbols', () => {
    expect(parseRoundBody('6X')).toEqual(Array(6).fill('sc'))
    expect(parseRoundBody('6V')).toEqual(Array(6).fill('inc'))
    expect(parseRoundBody('(X,V)*6')).toHaveLength(12)
    expect(parseRoundBody('（2X，V）×6')).toEqual(Array(6).fill(S('sc sc inc')).flat())
    expect(parseRoundBody('X、A')).toEqual(S('sc dec'))
    expect(parseRoundBody('6(X,A)')).toEqual(Array(6).fill(S('sc dec')).flat())
  })
  it('parses English notation', () => {
    expect(parseRoundBody('6 sc in MR')).toEqual(Array(6).fill('sc'))
    expect(parseRoundBody('inc x6')).toEqual(Array(6).fill('inc'))
    expect(parseRoundBody('(sc, inc) x6')).toEqual(Array(6).fill(S('sc inc')).flat())
    expect(parseRoundBody('[2 sc, inc] * 6')).toEqual(Array(6).fill(S('sc sc inc')).flat())
    expect(parseRoundBody('sc2tog x3')).toEqual(S('dec dec dec'))
    expect(parseRoundBody('ch 1, 6 sc')).toEqual(['ch', ...Array(6).fill('sc')])
  })
  it('parses Chinese words', () => {
    expect(parseRoundBody('3短针,加针')).toEqual(S('sc sc sc inc'))
  })
  it('reports errors', () => {
    expect(() => parseRoundBody('(X,V*6')).toThrow(/右括号/)
    expect(() => parseRoundBody('6 foo')).toThrow()
    expect(() => parseRoundBody('X)')).toThrow()
  })
})

describe('parsePattern & stitch counting', () => {
  it('parses the coaster tutorial with counts 6/12/18/24/24', () => {
    expect(COASTER_LEVEL.rounds.map(countProduced)).toEqual([6, 12, 18, 24, 24])
    expect(COASTER_LEVEL.rounds.flat()).toHaveLength(6 + 6 + 12 + 18 + 24)
  })
  it('expands round ranges and checks counts (amigurumi ball)', () => {
    const { rounds, errors } = parsePattern(BALL_PATTERN)
    expect(errors).toEqual([])
    expect(rounds.map((r) => countProduced(r.stitches))).toEqual([6, 12, 18, 18, 18, 18, 12, 6])
  })
  it('accepts mixed prefixes', () => {
    const { rounds, errors } = parsePattern('第1圈：6X\n2圈: 6V\nRnd 3: (sc, inc) x6 = 18\nround 4: 18 sc [18 sts]')
    expect(errors).toEqual([])
    expect(rounds.map((r) => countProduced(r.stitches))).toEqual([6, 12, 18, 18])
  })
  it('detects wrong declared count', () => {
    const { errors } = parsePattern('R1: 6X (6)\nR2: (X,V)*6 (12)')
    expect(errors.join()).toMatch(/第 2 圈/)
  })
  it('detects rounds that do not consume the previous round', () => {
    const { errors } = parsePattern('R1: 6X\nR2: 5V')
    expect(errors.join()).toMatch(/用掉 5 针，但上一圈有 6 针/)
  })
  it('checkRounds ok for valid rounds', () => {
    expect(checkRounds(COASTER_LEVEL.rounds).every((c) => c.ok)).toBe(true)
  })
})

describe('formatter', () => {
  it('finds repeats', () => {
    expect(findRepeat(S('sc inc sc inc'))).toEqual({ block: S('sc inc'), times: 2 })
    expect(findRepeat(S('sc sc inc'))).toBeNull()
  })
  it('formats rounds in both notations', () => {
    const r3 = parseRoundBody('(X,V)*6')
    expect(formatRound(r3, 'zh')).toBe('(X,V)*6')
    expect(formatRound(r3, 'en')).toBe('(sc, inc) x6')
    expect(formatRound(Array(6).fill('inc'), 'zh')).toBe('6V')
    expect(formatRound(Array(24).fill('sc'), 'en')).toBe('24 sc')
    expect(formatRound(S('sc sc inc sc'), 'zh')).toBe('2X,V,X')
  })
  it('round-trips: format → parse gives the same rounds', () => {
    for (const n of ['zh', 'en'] as const) {
      const text = formatPattern(COASTER_LEVEL.rounds, n)
      const { rounds, errors } = parsePattern(text)
      expect(errors).toEqual([])
      expect(rounds.map((r) => r.stitches)).toEqual(COASTER_LEVEL.rounds)
    }
  })
})
