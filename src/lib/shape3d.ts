/**
 * 从每圈针数推出立体形状（纯函数，供 Three.js 渲染与测试）。
 *
 * 模型：短针宽 w=1；每圈周长 = 针数 × w，所以目标半径 R = n / 2π。
 * 圈高 h 取 6/2π —— 每圈加 6 针时半径恰好增加 h，织片保持平整（真实钩织的经验规律）。
 * 相邻两圈之间织片长度固定为 h，方向由「目标半径 - 当前半径」决定：
 *   加 6 针 → 水平向外（平面）；不加不减 → 竖直向上（碗壁）；减针 → 向内收（收口）。
 * 收口的立体件（球、玩偶头）按「塞了棉花」处理：半径取针数半径、针目被撑高，鼓成球形。
 * 最后再轻微平滑，转折处成弧。
 */
import { STITCH_COST, type StitchType } from '../types/stitch'

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const STITCH_W = 1
export const ROUND_H = (6 * STITCH_W) / (2 * Math.PI)

export type Vec3 = [number, number, number]

export interface ProfilePoint {
  /** 到中轴的距离 */
  r: number
  /** 高度 */
  y: number
  /** 从上一圈到本圈的织片方向：0 水平向外，π/2 竖直向上，π 水平向内 */
  phi: number
  /** 本圈（预计）针数 */
  count: number
}

export interface StitchPose {
  /** 唯一 id，同 2D 布局：`${round}-${actionIndex}`，加针第二针加 `b` */
  id: string
  /** 全局动作序号（含锁针），用于换线颜色 */
  seq: number
  round: number
  type: StitchType
  position: Vec3
  /** 沿圈方向 */
  tangent: Vec3
  /** 沿织片向上（从上一圈指向本圈） */
  up: Vec3
  /** 织片正面（外侧）法线 */
  normal: Vec3
  /** 本针沿圈方向的实际宽度（w 的倍数） */
  width: number
}

export interface Shape {
  profile: ProfilePoint[]
  stitches: StitchPose[]
  /** 包围盒：最大半径和高度，用来摆相机 */
  maxRadius: number
  height: number
}

const produced = (r: StitchType[]) => r.reduce((n, a) => n + STITCH_COST[a].produce, 0)
const consumed = (r: StitchType[]) => r.reduce((n, a) => n + STITCH_COST[a].consume, 0)

/**
 * 每个非空圈的针数；进行中的圈按「剩下的针都钩短针」预计，
 * 这样边钩边看时形状不会跳来跳去。
 */
export function roundCounts(rounds: StitchType[][], opts: { ringSize?: number } = {}): number[] {
  const out: number[] = []
  const last = rounds.length - 1
  rounds.forEach((r, k) => {
    if (r.length === 0) return
    const made = produced(r)
    if (k < last) return void out.push(Math.max(1, made))
    if (k === 0) return void out.push(Math.max(opts.ringSize ?? 6, made, 1))
    const prev = produced(rounds[k - 1])
    out.push(Math.max(1, made + Math.max(0, prev - consumed(r))))
  })
  return out
}

/** 自由边（最后一圈）只弯一部分：没有下一圈拉着，不会立刻折起来 */
export const FREE_EDGE = 0.3
/** 塞棉花后针目被撑开的程度 */
export const STUFF_STRETCH = 1.25

const radiusOf = (n: number) => (n * STITCH_W) / (2 * Math.PI)

/** 不塞棉花：每圈织片长 h，方向由目标半径决定（平面 / 立起 / 收口）。 */
export function turtleProfile(counts: number[]): { r: number; y: number }[] {
  const pts: { r: number; y: number }[] = []
  if (!counts.length) return pts
  pts.push({ r: radiusOf(counts[0]), y: 0 })
  let phi = 0
  for (let k = 1; k < counts.length; k++) {
    const p = pts[k - 1]
    const c = Math.max(-1, Math.min(1, (radiusOf(counts[k]) - p.r) / ROUND_H))
    const want = Math.acos(c)
    phi = k === counts.length - 1 ? phi + FREE_EDGE * (want - phi) : want
    pts.push({ r: Math.max(0.05, p.r + ROUND_H * Math.cos(phi)), y: p.y + ROUND_H * Math.sin(phi) })
  }
  return pts
}

/** 塞了棉花：半径就是针数决定的半径，针目被撑高，整体鼓成球。 */
export function stuffedProfile(counts: number[]): { r: number; y: number }[] {
  const h = ROUND_H * STUFF_STRETCH
  const pts: { r: number; y: number }[] = []
  counts.forEach((n, k) => {
    const r = radiusOf(n)
    if (k === 0) return void pts.push({ r, y: 0 })
    const dr = r - pts[k - 1].r
    const dy = Math.sqrt(Math.max(h * h - dr * dr, (0.2 * ROUND_H) ** 2))
    pts.push({ r, y: pts[k - 1].y + dy })
  })
  return pts
}

/** 收口程度 0..1：最后一圈比最大圈小一半以上视为塞棉花收口的立体件（球、玩偶头）。 */
export function stuffing(counts: number[]): number {
  if (counts.length < 3) return 0
  const max = Math.max(...counts)
  const last = counts[counts.length - 1]
  return Math.max(0, Math.min(1, (max - last) / (0.5 * max)))
}

export function buildProfile(counts: number[]): ProfilePoint[] {
  if (!counts.length) return []
  const a = turtleProfile(counts)
  const b = stuffedProfile(counts)
  const s = stuffing(counts)
  let pts = a.map((p, k) => ({ r: lerp(p.r, b[k].r, s), y: lerp(p.y, b[k].y, s) }))
  // 轻微平滑，让转折处成弧（首尾不动，直线段不受影响）
  for (let pass = 0; pass < 2; pass++) {
    pts = pts.map((p, k) =>
      k === 0 || k === pts.length - 1
        ? p
        : { r: p.r * 0.5 + (pts[k - 1].r + pts[k + 1].r) * 0.25, y: p.y * 0.5 + (pts[k - 1].y + pts[k + 1].y) * 0.25 },
    )
  }
  return pts.map((p, k) => ({
    ...p,
    phi: k === 0 ? 0 : Math.atan2(p.y - pts[k - 1].y, p.r - pts[k - 1].r),
    count: counts[k],
  }))
}

export function buildShape(rounds: StitchType[][], opts: { ringSize?: number } = {}): Shape {
  const counts = roundCounts(rounds, opts)
  const profile = buildProfile(counts)
  const stitches: StitchPose[] = []
  let seq = 0
  let pi = 0 // profile index of the current non-empty round
  rounds.forEach((round, k) => {
    if (round.length === 0) return
    const P = profile[pi]
    const prev = pi > 0 ? profile[pi - 1] : { r: P.r * 0.3, y: P.y, phi: 0, count: 0 }
    const n = P.count
    let j = 0
    round.forEach((t, i) => {
      const s = seq++
      const make = STITCH_COST[t].produce
      for (let q = 0; q < make; q++) {
        const frac = (j + 0.5) / n
        // 螺旋：一圈之内从上一圈的位置渐渐升到本圈
        const r = lerp(prev.r, P.r, frac)
        const y = lerp(prev.y, P.y, frac)
        // 不再逐圈错开角度：每针正好立在它钩入的父针上方（加针的两针分在父针两侧）
        const theta = 2 * Math.PI * frac
        const er: Vec3 = [Math.cos(theta), 0, Math.sin(theta)]
        const tangent: Vec3 = [-Math.sin(theta), 0, Math.cos(theta)]
        const up: Vec3 = [Math.cos(P.phi) * er[0], Math.sin(P.phi), Math.cos(P.phi) * er[2]]
        // 正面（外侧）法线 = up × tangent：球 / 碗的外壁、平片的底面
        const normal: Vec3 = [
          up[1] * tangent[2] - up[2] * tangent[1],
          up[2] * tangent[0] - up[0] * tangent[2],
          up[0] * tangent[1] - up[1] * tangent[0],
        ]
        stitches.push({
          id: q === 0 ? `${k}-${i}` : `${k}-${i}b`,
          seq: s,
          round: k,
          type: t,
          position: [r * er[0], y, r * er[2]],
          tangent,
          up,
          normal,
          width: Math.max(0.35, Math.min(1.8, (2 * Math.PI * Math.max(r, 0.2)) / n)),
        })
        j++
      }
    })
    pi++
  })
  return {
    profile,
    stitches,
    maxRadius: profile.reduce((m, p) => Math.max(m, p.r), 0),
    height: profile.reduce((m, p) => Math.max(m, p.y), 0),
  }
}
