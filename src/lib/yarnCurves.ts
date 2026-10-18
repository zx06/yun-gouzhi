/**
 * 每一针的毛线走向（纯函数，供 Three.js 生成细毛线管，也方便单测）。
 *
 * 一针短针（sc）由 5 段毛线组成（局部坐标：t 沿圈、u 向上、n 正面朝外）：
 *   0 前半针 front loop —— 顶部辫子链朝外的那一半
 *   1 后半针 back loop  —— 顶部辫子链朝里的那一半（和前半针合成一个横躺的线圈）
 *   2 左腿 / 3 右腿     —— 正面的 V 字，脚钩进上一圈那针的辫子下面，头藏进本针顶链下面
 *   4 背面横杠          —— 织片反面能看到的横条
 * 加针：两针的脚钩进同一个父针；减针：左腿钩父针 A、右腿钩父针 B，两条腿并成一针。
 * 第一圈钩在魔术环里：脚往环中心收。
 */
import { ROUND_H, type StitchPose, type Vec3 } from './shape3d'

export const TUBES_PER_STITCH = 5
export const TUBE = { FRONT_LOOP: 0, BACK_LOOP: 1, LEFT_LEG: 2, RIGHT_LEG: 3, BACK_BAR: 4 } as const
/** 顶链离针目中心的高度 */
export const TOP_H = 0.4 * ROUND_H

type Pose = Pick<StitchPose, 'position' | 'tangent' | 'up' | 'normal' | 'width'>

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
export const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
/** p + Σ v_i · s_i */
const at = (p: Vec3, ...terms: [Vec3, number][]): Vec3 => terms.reduce<Vec3>((q, [v, s]) => add(q, mul(v, s)), p)

/** 顶链中心 */
export function topOf(s: Pose): Vec3 {
  return at(s.position, [s.up, TOP_H])
}

/** 钩针穿过父针的位置：父针顶链中心，按 side 往左右偏一点 */
export function footIn(parent: Pose, side: number): Vec3 {
  const w = Math.min(1.2, parent.width)
  return at(topOf(parent), [parent.tangent, side * 0.12 * w])
}

/** 绕过父针顶链的那一小段：从顶链后面钻出来，翻过顶链到正面 */
function wrapOver(foot: Vec3, parent: Pose | null, s: Pose): Vec3[] {
  const u = parent?.up ?? s.up
  const n = parent?.normal ?? s.normal
  return [at(foot, [n, -0.2], [u, -0.02]), at(foot, [n, -0.02], [u, 0.2]), at(foot, [n, 0.19], [u, 0.17])]
}

export interface StitchCurves {
  /** 5 段毛线的控制点，顺序见 TUBE */
  tubes: Vec3[][]
  /** 左右脚的落点（钩进的位置） */
  feet: [Vec3, Vec3]
  /** 弹出动画的缩放中心 */
  anchor: Vec3
}

/**
 * @param s 本针
 * @param parents 父针（0~2 个，见 stitchParents）
 */
export function stitchCurves(s: Pose, parents: Pose[]): StitchCurves {
  const { tangent: t, up: u, normal: n } = s
  const W = Math.max(0.45, Math.min(1.5, s.width))
  const T = topOf(s)
  let footL: Vec3
  let footR: Vec3
  let pL: Pose | null = null
  let pR: Pose | null = null
  if (parents.length >= 2) {
    // 减针：两条腿各钩一个父针，往中间并
    pL = parents[0]
    pR = parents[parents.length - 1]
    footL = footIn(pL, 0.3)
    footR = footIn(pR, -0.3)
  } else if (parents.length === 1) {
    pL = pR = parents[0]
    footL = footIn(parents[0], -1)
    footR = footIn(parents[0], 1)
  } else {
    // 魔术环：脚往圈心收
    const ring = at(s.position, [u, -TOP_H * 1.1])
    footL = at(ring, [t, -0.08])
    footR = at(ring, [t, 0.08])
  }
  const halfW = W / 2
  const loopOut = 0.1
  const loopRise = 0.04
  const L = at(T, [t, -halfW])
  const R = at(T, [t, halfW])
  const frontLoop = [
    L,
    at(T, [t, -halfW * 0.55], [n, loopOut * 0.85], [u, loopRise * 0.6]),
    at(T, [n, loopOut], [u, loopRise]),
    at(T, [t, halfW * 0.55], [n, loopOut * 0.85], [u, loopRise * 0.6]),
    R,
  ]
  const backLoop = [
    L,
    at(T, [t, -halfW * 0.55], [n, -loopOut * 0.8], [u, loopRise * 1.2]),
    at(T, [n, -loopOut], [u, loopRise * 1.5]),
    at(T, [t, halfW * 0.55], [n, -loopOut * 0.8], [u, loopRise * 1.2]),
    R,
  ]
  const leg = (foot: Vec3, side: number, parent: Pose | null) => {
    // 脚绕过父针顶链（钩入上一圈），腿往上张成 V，头钻到本针顶链前半针下面
    const wrap = wrapOver(foot, parent, s)
    const head = at(T, [t, side * halfW * 0.66], [n, 0.07], [u, -0.03])
    const start = wrap[wrap.length - 1]
    const mid = add(lerp3(start, head, 0.5), add(mul(n, 0.08), mul(t, side * halfW * 0.25)))
    return [...wrap, mid, head]
  }
  const midH = at(s.position, [u, -0.05])
  const backBar = [
    at(midH, [t, -halfW * 0.85], [n, -0.06]),
    at(midH, [t, -halfW * 0.3], [n, -0.12]),
    at(midH, [t, halfW * 0.3], [n, -0.12]),
    at(midH, [t, halfW * 0.85], [n, -0.06]),
  ]
  return {
    tubes: [frontLoop, backLoop, leg(footL, -1, pL), leg(footR, 1, pR), backBar],
    feet: [footL, footR],
    anchor: lerp3(footL, footR, 0.5),
  }
}

/** 均匀 Catmull-Rom 采样：返回 segs+1 个点，首尾正好是第一个 / 最后一个控制点 */
export function sampleCatmullRom(pts: Vec3[], segs: number): Vec3[] {
  if (pts.length === 1) return Array.from({ length: segs + 1 }, () => [...pts[0]] as Vec3)
  const P = (i: number) => {
    if (i < 0) return sub(mul(pts[0], 2), pts[1])
    if (i >= pts.length) return sub(mul(pts[pts.length - 1], 2), pts[pts.length - 2])
    return pts[i]
  }
  const out: Vec3[] = []
  const spans = pts.length - 1
  for (let k = 0; k <= segs; k++) {
    const g = (k / segs) * spans
    const i = Math.min(spans - 1, Math.floor(g))
    const x = g - i
    const p0 = P(i - 1)
    const p1 = P(i)
    const p2 = P(i + 1)
    const p3 = P(i + 2)
    const x2 = x * x
    const x3 = x2 * x
    const v: Vec3 = [0, 0, 0]
    for (let d = 0; d < 3; d++) {
      v[d] = 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * x + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * x2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * x3)
    }
    out.push(v)
  }
  return out
}

export interface TubeLayout {
  segs: number
  radial: number
}
export const tubeVertexCount = (l: TubeLayout) => (l.segs + 1) * (l.radial + 1)
export const tubeIndexCount = (l: TubeLayout) => l.segs * l.radial * 6

/** 一段管子的三角形下标（相对于该管第一个顶点） */
export function tubeIndices(l: TubeLayout, base: number, out: Uint32Array | number[], o: number): number {
  const ring = l.radial + 1
  for (let i = 0; i < l.segs; i++) {
    for (let j = 0; j < l.radial; j++) {
      const a = base + i * ring + j
      const b = base + (i + 1) * ring + j
      out[o++] = a
      out[o++] = b
      out[o++] = a + 1
      out[o++] = b
      out[o++] = b + 1
      out[o++] = a + 1
    }
  }
  return o
}

/**
 * 沿路径生成一段毛线管（平行移动标架，不会扭麻花），写进顶点数组。
 * 两头略收细，像钻到别的线下面去了。返回写入的顶点数。
 * @param uScale 沿线方向的贴图密度（让股线螺旋粗细一致）
 */
export function writeTube(
  path: Vec3[],
  radius: number,
  l: TubeLayout,
  pos: Float32Array,
  nor: Float32Array,
  uv: Float32Array,
  vOffset: number,
  uScale = 1,
): number {
  const N = path.length
  let prevN: Vec3 | null = null
  let len = 0
  let o = vOffset
  for (let i = 0; i < N; i++) {
    const a = path[Math.max(0, i - 1)]
    const b = path[Math.min(N - 1, i + 1)]
    let T = sub(b, a)
    const tl = Math.hypot(...T) || 1
    T = mul(T, 1 / tl)
    let Nv: Vec3
    if (!prevN) {
      // 任取一个垂直方向
      const ref: Vec3 = Math.abs(T[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
      Nv = sub(ref, mul(T, ref[0] * T[0] + ref[1] * T[1] + ref[2] * T[2]))
    } else {
      Nv = sub(prevN, mul(T, prevN[0] * T[0] + prevN[1] * T[1] + prevN[2] * T[2]))
    }
    const nl = Math.hypot(...Nv) || 1
    Nv = mul(Nv, 1 / nl)
    prevN = Nv
    const B: Vec3 = [T[1] * Nv[2] - T[2] * Nv[1], T[2] * Nv[0] - T[0] * Nv[2], T[0] * Nv[1] - T[1] * Nv[0]]
    if (i > 0) len += dist(path[i], path[i - 1])
    const e = i / (N - 1)
    const taper = 0.7 + 0.3 * Math.min(1, Math.min(e, 1 - e) * 4)
    const r = radius * taper
    for (let j = 0; j <= l.radial; j++) {
      const ang = (j / l.radial) * Math.PI * 2
      const c = -Math.cos(ang) // 同 three.js TubeGeometry 的朝向，配合 tubeIndices 的绕序让外表面朝外
      const sn = Math.sin(ang)
      const dx = Nv[0] * c + B[0] * sn
      const dy = Nv[1] * c + B[1] * sn
      const dz = Nv[2] * c + B[2] * sn
      pos[o * 3] = path[i][0] + dx * r
      pos[o * 3 + 1] = path[i][1] + dy * r
      pos[o * 3 + 2] = path[i][2] + dz * r
      nor[o * 3] = dx
      nor[o * 3 + 1] = dy
      nor[o * 3 + 2] = dz
      uv[o * 2] = (len / (radius * 2 * Math.PI)) * uScale
      uv[o * 2 + 1] = j / l.radial
      o++
    }
  }
  return o - vOffset
}
