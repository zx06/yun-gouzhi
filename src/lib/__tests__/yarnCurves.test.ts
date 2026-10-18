import { describe, expect, it } from 'vitest'
import { buildShape, ROUND_H, type Vec3 } from '../shape3d'
import { stitchParents } from '../stitchTopology'
import {
  sampleCatmullRom,
  stitchCurves,
  topOf,
  tubeIndexCount,
  tubeIndices,
  tubeVertexCount,
  writeTube,
  dist,
  TUBE,
  TUBES_PER_STITCH,
} from '../yarnCurves'
import type { StitchType } from '../../types/stitch'

const rep = (s: StitchType, n: number): StitchType[] => Array(n).fill(s)
const finite = (v: Vec3) => v.every(Number.isFinite)

const ROUNDS: StitchType[][] = [rep('sc', 6), rep('inc', 6), rep('sc', 12), rep('dec', 6), []]
const shape = buildShape(ROUNDS)
const links = stitchParents(ROUNDS)
const curvesOf = (i: number) => stitchCurves(shape.stitches[i], links[i].parents.map((p) => shape.stitches[p]))

describe('sampleCatmullRom', () => {
  it('passes through the first and last control points with segs+1 samples', () => {
    const pts: Vec3[] = [[0, 0, 0], [1, 1, 0], [2, 0, 0], [3, 1, 1]]
    const s = sampleCatmullRom(pts, 12)
    expect(s).toHaveLength(13)
    expect(dist(s[0], pts[0])).toBeLessThan(1e-9)
    expect(dist(s[12], pts[3])).toBeLessThan(1e-9)
    // 经过中间控制点（均匀参数下 4 段分 12 → 每段 4 个样本）
    expect(dist(s[4], pts[1])).toBeLessThan(1e-9)
    expect(s.every(finite)).toBe(true)
  })
})

describe('writeTube', () => {
  it('puts every vertex on a circle of the given radius around the path, unit normals', () => {
    const L = { segs: 8, radial: 6 }
    const path = sampleCatmullRom([[0, 0, 0], [0.5, 0.6, 0.1], [1, 0.8, 0.4]], L.segs)
    const n = tubeVertexCount(L)
    const pos = new Float32Array(n * 3)
    const nor = new Float32Array(n * 3)
    const uv = new Float32Array(n * 2)
    expect(writeTube(path, 0.2, L, pos, nor, uv, 0)).toBe(n)
    for (let i = 0; i <= L.segs; i++) {
      for (let j = 0; j <= L.radial; j++) {
        const o = (i * (L.radial + 1) + j) * 3
        const d = Math.hypot(pos[o] - path[i][0], pos[o + 1] - path[i][1], pos[o + 2] - path[i][2])
        // 两头收细到 70%
        expect(d).toBeGreaterThan(0.2 * 0.69)
        expect(d).toBeLessThan(0.2 * 1.001)
        expect(Math.hypot(nor[o], nor[o + 1], nor[o + 2])).toBeCloseTo(1, 4)
      }
    }
    // uv 沿线单调递增
    expect(uv[(L.segs * (L.radial + 1)) * 2]).toBeGreaterThan(uv[0])
  })

  it('index buffer stays inside the tube and has the expected size', () => {
    const L = { segs: 5, radial: 4 }
    const idx = new Uint32Array(tubeIndexCount(L))
    expect(tubeIndices(L, 100, idx, 0)).toBe(idx.length)
    expect(Math.min(...idx)).toBe(100)
    expect(Math.max(...idx)).toBe(100 + tubeVertexCount(L) - 1)
  })
})

describe('stitchCurves', () => {
  it('builds front/back chain loops, a V of two legs and a back bar, all finite', () => {
    for (let i = 0; i < shape.stitches.length; i++) {
      const c = curvesOf(i)
      expect(c.tubes).toHaveLength(TUBES_PER_STITCH)
      for (const t of c.tubes) {
        expect(t.length).toBeGreaterThanOrEqual(3)
        expect(t.every(finite)).toBe(true)
      }
    }
  })

  it('chain loops span the stitch width at the top; front loop sits outside, back loop inside', () => {
    const i = 20 // 第 3 圈的短针
    const s = shape.stitches[i]
    const c = curvesOf(i)
    const T = topOf(s)
    const side = (p: Vec3) => (p[0] - T[0]) * s.normal[0] + (p[1] - T[1]) * s.normal[1] + (p[2] - T[2]) * s.normal[2]
    const front = c.tubes[TUBE.FRONT_LOOP]
    const back = c.tubes[TUBE.BACK_LOOP]
    expect(side(front[2])).toBeGreaterThan(0.05)
    expect(side(back[2])).toBeLessThan(-0.05)
    // 前后半针两头相接，组成一个环
    expect(dist(front[0], back[0])).toBeLessThan(1e-9)
    expect(dist(front[front.length - 1], back[back.length - 1])).toBeLessThan(1e-9)
    expect(dist(front[0], front[front.length - 1])).toBeGreaterThan(0.4)
  })

  it('V legs: feet hook into the parent chain, heads end under this stitch’s top chain, spread wider at the top', () => {
    const i = 20
    const s = shape.stitches[i]
    const parent = shape.stitches[links[i].parents[0]]
    const c = curvesOf(i)
    const L = c.tubes[TUBE.LEFT_LEG]
    const R = c.tubes[TUBE.RIGHT_LEG]
    const pTop = topOf(parent)
    expect(dist(c.feet[0], pTop)).toBeLessThan(0.3)
    expect(dist(c.feet[1], pTop)).toBeLessThan(0.3)
    // 脚从父针顶链后面绕过来（第一点在父针背面）
    const behind = (p: Vec3) => (p[0] - pTop[0]) * parent.normal[0] + (p[1] - pTop[1]) * parent.normal[1] + (p[2] - pTop[2]) * parent.normal[2]
    expect(behind(L[0])).toBeLessThan(0)
    const T = topOf(s)
    expect(dist(L[L.length - 1], T)).toBeLessThan(ROUND_H * 0.6)
    expect(dist(L[L.length - 1], R[R.length - 1])).toBeGreaterThan(dist(c.feet[0], c.feet[1]))
  })

  it('inc children share one parent; dec legs land on two different parents', () => {
    // 第 2 圈：加针 → 6~17，两两共用父针
    const a = curvesOf(6)
    const b = curvesOf(7)
    const p = topOf(shape.stitches[links[6].parents[0]])
    expect(links[6].parents).toEqual(links[7].parents)
    expect(dist(a.anchor, p)).toBeLessThan(0.3)
    expect(dist(b.anchor, p)).toBeLessThan(0.3)
    // 第 4 圈：减针
    const di = shape.stitches.findIndex((s) => s.type === 'dec')
    const [p1, p2] = links[di].parents.map((q) => topOf(shape.stitches[q]))
    const d = curvesOf(di)
    expect(dist(d.feet[0], p1)).toBeLessThan(dist(d.feet[0], p2))
    expect(dist(d.feet[1], p2)).toBeLessThan(dist(d.feet[1], p1))
  })

  it('magic-ring stitches tuck their feet towards the centre', () => {
    const s = shape.stitches[0]
    const c = curvesOf(0)
    const r = (v: Vec3) => Math.hypot(v[0], v[2])
    expect(r(c.anchor)).toBeLessThan(r(s.position))
  })
})
