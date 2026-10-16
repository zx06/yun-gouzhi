/** 螺旋圈织规则引擎：纯函数，便于测试与撤销。 */
import { STITCH_COST, STITCH_LABELS, type StitchType } from '../types/stitch'
import { countConsumed, countProduced } from './pattern'

export interface Work {
  /** rounds[rounds.length - 1] is the round in progress (may be empty) */
  rounds: StitchType[][]
}

export const emptyWork = (): Work => ({ rounds: [[]] })

export interface Progress {
  /** 0-based index of the round in progress */
  roundIndex: number
  /** stitches in the previous round (null while in the magic ring) */
  prevCount: number | null
  consumed: number
  remaining: number | null
  produced: number
  /** total stitches made in completed rounds + current */
  totalActions: number
}

export function progress(work: Work): Progress {
  const k = work.rounds.length - 1
  const cur = work.rounds[k]
  const prevCount = k === 0 ? null : countProduced(work.rounds[k - 1])
  const consumed = countConsumed(cur)
  return {
    roundIndex: k,
    prevCount,
    consumed,
    remaining: prevCount === null ? null : prevCount - consumed,
    produced: countProduced(cur),
    totalActions: work.rounds.reduce((n, r) => n + r.length, 0),
  }
}

export interface ApplyResult {
  work: Work
  error?: string
  /** a round was completed by this stitch */
  roundClosed?: boolean
}

const MAX_RING = 12
const MAX_ROUNDS = 40

export function applyStitch(work: Work, type: StitchType, opts: { ringSize?: number } = {}): ApplyResult {
  const p = progress(work)
  const name = `${STITCH_LABELS[type].zh}（${STITCH_LABELS[type].symbolZh}/${STITCH_LABELS[type].symbolEn}）`
  if (p.roundIndex === 0) {
    if (type === 'dec') return { work, error: '魔术环里还没有针可以并，先钩短针或加针' }
    if (p.produced + STITCH_COST[type].produce > MAX_RING) {
      return { work, error: `魔术环最多 ${MAX_RING} 针，点「闭合魔术环」进入下一圈` }
    }
  } else {
    const remaining = p.remaining ?? 0
    if (STITCH_COST[type].consume > remaining) {
      return { work, error: `本圈只剩 ${remaining} 针，不能钩${name}` }
    }
  }
  const rounds = work.rounds.map((r) => [...r])
  rounds[rounds.length - 1].push(type)
  let next: Work = { rounds }
  const after = progress(next)
  const closeRing = after.roundIndex === 0 && opts.ringSize !== undefined && after.produced >= opts.ringSize
  const closeRound = after.roundIndex > 0 && after.remaining === 0
  if (closeRing || closeRound) {
    if (rounds.length >= MAX_ROUNDS) return { work: next, roundClosed: true }
    next = { rounds: [...rounds, []] }
    return { work: next, roundClosed: true }
  }
  return { work: next }
}

/** Manually close the magic ring (sandbox). */
export function closeRing(work: Work): ApplyResult {
  const p = progress(work)
  if (p.roundIndex !== 0) return { work, error: '魔术环已经闭合' }
  if (p.produced < 3) return { work, error: '魔术环里至少钩 3 针再闭合' }
  return { work: { rounds: [...work.rounds.map((r) => [...r]), []] }, roundClosed: true }
}

/** Completed rounds only (drops the empty/in-progress tail when empty). */
export function finishedRounds(work: Work): StitchType[][] {
  return work.rounds.filter((r) => r.length > 0)
}

export function isValidWork(x: unknown): x is Work {
  if (!x || typeof x !== 'object') return false
  const r = (x as Work).rounds
  return (
    Array.isArray(r) &&
    r.length > 0 &&
    r.every((row) => Array.isArray(row) && row.every((s) => s in STITCH_COST))
  )
}
