/**
 * 针目拓扑：每一针钩在上一圈的哪一针（或哪两针）里。
 *
 * 和 buildShape() 的 stitches 顺序一一对应（锁针不产生针目）：
 * - sc：吃掉上一圈 1 针 → 1 针，父针 [p]
 * - inc：吃掉上一圈 1 针 → 2 针，两针共用同一个父针 [p]
 * - dec：吃掉上一圈 2 针 → 1 针，父针 [p, p+1]
 * - 第一圈（钩在魔术环里）：父针为空
 * 返回值里的父针是 stitches 数组里的全局下标。
 */
import { STITCH_COST, type StitchType } from '../types/stitch'

export interface StitchLink {
  /** 本针在 stitches 数组里的下标 */
  index: number
  round: number
  type: StitchType
  /** 钩入的上一圈针目下标（0 个 = 魔术环，1 个 = sc/inc，2 个 = dec） */
  parents: number[]
}

export function stitchParents(rounds: StitchType[][]): StitchLink[] {
  const out: StitchLink[] = []
  /** 上一个非空圈的针目下标 */
  let prev: number[] = []
  let first = true
  rounds.forEach((round, k) => {
    if (round.length === 0) return
    const mine: number[] = []
    let c = 0 // 已经吃掉上一圈多少针
    for (const t of round) {
      const { consume, produce } = STITCH_COST[t]
      const parents: number[] = []
      if (!first) {
        for (let q = 0; q < consume; q++) {
          const p = prev[c + q]
          if (p !== undefined) parents.push(p)
        }
      }
      c += consume
      for (let q = 0; q < produce; q++) {
        const index = out.length
        out.push({ index, round: k, type: t, parents: [...parents] })
        mine.push(index)
      }
    }
    prev = mine
    first = false
  })
  return out
}

/** 反向：每针被下一圈哪些针钩住（加针的父针有 2 个孩子） */
export function stitchChildren(links: StitchLink[]): number[][] {
  const kids: number[][] = links.map(() => [])
  for (const l of links) for (const p of l.parents) kids[p].push(l.index)
  return kids
}
