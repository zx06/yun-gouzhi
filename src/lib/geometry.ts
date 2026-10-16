import type { PlacedStitch, StitchType } from '../types/stitch'

const BASE_RADIUS = 14
const RADIUS_PER_ROUND = 16
const SPIRAL_OFFSET = 0.35

export interface PlacementState {
  round: number
  slotIndex: number
  stitchesThisRound: number
  globalActionIndex: number
}

export function initialPlacement(): PlacementState {
  return {
    round: 1,
    slotIndex: 0,
    stitchesThisRound: 0,
    globalActionIndex: 0,
  }
}

/** After each user *action* (not each drawn dot), update round counters */
export function advancePlacement(
  state: PlacementState,
  type: StitchType,
  roundBoundaries?: number[],
): PlacementState {
  const next = { ...state, globalActionIndex: state.globalActionIndex + 1 }

  if (type === 'ch') {
    return next
  }

  if (type === 'dec') {
    next.stitchesThisRound += 1
    next.slotIndex += 2
  } else if (type === 'inc') {
    next.stitchesThisRound += 2
    next.slotIndex += 1
  } else {
    next.stitchesThisRound += 1
    next.slotIndex += 1
  }

  if (roundBoundaries) {
    const targetRound = getRoundFromActionIndex(next.globalActionIndex, roundBoundaries)
    if (targetRound > next.round) {
      next.round = targetRound
      next.slotIndex = 0
      next.stitchesThisRound = 0
    }
  } else {
    const expectedInRound = expectedStitchesInRound(next.round)
    if (next.slotIndex >= expectedInRound) {
      next.round += 1
      next.slotIndex = 0
      next.stitchesThisRound = 0
    }
  }

  return next
}

function getRoundFromActionIndex(index: number, boundaries: number[]): number {
  for (let r = boundaries.length - 1; r >= 0; r--) {
    if (index >= boundaries[r]) return r + 1
  }
  return 1
}

function expectedStitchesInRound(round: number): number {
  if (round === 1) return 6
  return 6 * round
}

function stitchCountAfterRound(round: number): number {
  return 6 * round
}

export function computeStitchPositions(
  type: StitchType,
  placement: PlacementState,
  idPrefix: string,
): PlacedStitch[] {
  const round = placement.round
  const slot = placement.slotIndex
  const totalInRound = stitchCountAfterRound(round)
  const angleStep = (Math.PI * 2) / totalInRound
  const baseAngle = slot * angleStep - Math.PI / 2 + round * SPIRAL_OFFSET

  const radius =
    BASE_RADIUS + (round - 1) * RADIUS_PER_ROUND + (slot / totalInRound) * 6

  const mk = (offsetAngle: number, suffix: string, t: StitchType): PlacedStitch => {
    const angle = baseAngle + offsetAngle
    return {
      id: `${idPrefix}-${suffix}`,
      type: t,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      round,
      angle,
      pop: 0,
    }
  }

  switch (type) {
    case 'ch': {
      const r = BASE_RADIUS - 8
      return [
        {
          id: `${idPrefix}-ch`,
          type: 'ch',
          x: Math.cos(baseAngle) * r,
          y: Math.sin(baseAngle) * r - 12,
          round,
          angle: baseAngle,
          pop: 0,
        },
      ]
    }
    case 'inc':
      return [mk(-0.12, 'a', 'sc'), mk(0.12, 'b', 'sc')]
    case 'dec':
      return [mk(0, 'dec', 'dec')]
    case 'sc':
    default:
      return [mk(0, 'sc', 'sc')]
  }
}

/** Quadratic bezier between stitch centers for yarn path */
export function yarnPathPoints(stitches: PlacedStitch[]): { x: number; y: number }[] {
  if (stitches.length === 0) return []
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < stitches.length; i++) {
    const s = stitches[i]
    pts.push({ x: s.x, y: s.y })
    if (i < stitches.length - 1) {
      const n = stitches[i + 1]
      const mx = (s.x + n.x) / 2
      const my = (s.y + n.y) / 2
      const cx = mx - (n.y - s.y) * 0.15
      const cy = my + (n.x - s.x) * 0.15
      pts.push({ x: cx, y: cy })
    }
  }
  return pts
}
