import type { StitchType } from '../types/stitch'
import { STITCH_COST } from '../types/stitch'
import type { Work } from './engine'
import { countProduced } from './pattern'

export const BASE_RADIUS = 20
export const STEP = 18

export interface PlacedStitch {
  id: string
  type: StitchType | 'inc-b'
  x: number
  y: number
  round: number
  angle: number
}

const START = -Math.PI / 2

function pos(round: number, frac: number, extra = 0) {
  const angle = START + frac * Math.PI * 2
  const radius = BASE_RADIUS + round * STEP + frac * STEP + extra
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, angle }
}

export interface Layout {
  stitches: PlacedStitch[]
  /** where the next stitch will go (hook position) */
  next: { x: number; y: number; angle: number }
  maxRadius: number
}

/**
 * Lay out stitches on a spiral. In round k≥1 each stitch sits above the
 * stitch(es) of the previous round it is worked into, so inc fans out and
 * dec pulls two together — like the real fabric.
 */
export function layoutWork(work: Work, ringSize?: number): Layout {
  const out: PlacedStitch[] = []
  let next = pos(0, 0)
  work.rounds.forEach((round, k) => {
    const isCurrent = k === work.rounds.length - 1
    if (k === 0) {
      const n = countProduced(round)
      const slots = Math.max(ringSize ?? 6, n + (isCurrent ? 1 : 0), 3)
      let s = 0
      let chi = 0
      round.forEach((t, i) => {
        if (t === 'ch') {
          const p = pos(0, s / slots, 9 + chi++ * 3)
          out.push({ id: `0-${i}`, type: 'ch', round: 0, ...p })
          return
        }
        if (t === 'inc') {
          out.push({ id: `0-${i}`, type: 'inc', round: 0, ...pos(0, (s + 0.5) / slots) })
          out.push({ id: `0-${i}b`, type: 'inc-b', round: 0, ...pos(0, (s + 1.5) / slots) })
          s += 2
        } else {
          out.push({ id: `0-${i}`, type: t, round: 0, ...pos(0, (s + 0.5) / slots) })
          s += 1
        }
      })
      if (isCurrent) next = pos(0, (s + 0.5) / slots)
      return
    }
    const P = Math.max(1, countProduced(work.rounds[k - 1]))
    let s = 0
    let chi = 0
    round.forEach((t, i) => {
      const id = `${k}-${i}`
      if (t === 'ch') {
        out.push({ id, type: 'ch', round: k, ...pos(k, s / P, 9 + chi++ * 3) })
        return
      }
      chi = 0
      if (t === 'inc') {
        out.push({ id, type: 'inc', round: k, ...pos(k, (s + 0.25) / P) })
        out.push({ id: `${id}b`, type: 'inc-b', round: k, ...pos(k, (s + 0.75) / P) })
      } else if (t === 'dec') {
        out.push({ id, type: 'dec', round: k, ...pos(k, (s + 1) / P) })
      } else {
        out.push({ id, type: t, round: k, ...pos(k, (s + 0.5) / P) })
      }
      s += STITCH_COST[t].consume
    })
    if (isCurrent) next = pos(k, Math.min(s + 0.5, P) / P)
  })
  const maxRadius = BASE_RADIUS + (work.rounds.length + 1) * STEP
  return { stitches: out, next, maxRadius }
}
