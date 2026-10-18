/**
 * 3D 钩织单针（短针 sc）的逼真毛线几何体。
 *
 * 结构：
 * 1. 细毛线管（半径 ~0.055，远比旧版的 0.19 胶囊更像真实毛线）；
 * 2. 正面 V 字：左腿与右腿两条管线向上张开成经典短针外观；
 * 3. 顶部横向辫子链（top chain）：包含前半针（front loop）与后半针（back loop）；
 * 4. 向下钩入的短立柱（post / hook）：沿 -up 方向延伸并回勾到上一圈的辫子高度，形成圈与圈之间的真实咬合；
 * 5. 反面细横条（back ridge）：提供真实织片背面的织纹细节。
 */
import {
  BufferGeometry,
  CatmullRomCurve3,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export const DEFAULT_YARN_RADIUS = 0.055
export const DEFAULT_RADIAL_SEGMENTS = 6

export interface StitchGeometryOptions {
  radius?: number
  radialSegments?: number
  includeBackRidge?: boolean
  includeCaps?: boolean
}

/** 正面 V 字左腿路径：从底部结点斜向上延展到顶链左下方 */
export function createLeftLegCurve(): CatmullRomCurve3 {
  return new CatmullRomCurve3([
    new Vector3(-0.035, -0.16, 0.04),
    new Vector3(-0.12, 0.04, 0.055),
    new Vector3(-0.22, 0.24, 0.04),
  ])
}

/** 正面 V 字右腿路径：从底部结点斜向上延展到顶链右下方 */
export function createRightLegCurve(): CatmullRomCurve3 {
  return new CatmullRomCurve3([
    new Vector3(0.035, -0.16, 0.04),
    new Vector3(0.12, 0.04, 0.055),
    new Vector3(0.22, 0.24, 0.04),
  ])
}

/** 顶部辫子链前半针（front loop）：横贯 V 字顶端略微拱起 */
export function createFrontChainCurve(): CatmullRomCurve3 {
  return new CatmullRomCurve3([
    new Vector3(-0.36, 0.25, 0.02),
    new Vector3(-0.18, 0.27, 0.045),
    new Vector3(0.0, 0.29, 0.05),
    new Vector3(0.18, 0.27, 0.045),
    new Vector3(0.36, 0.25, 0.02),
  ])
}

/** 顶部辫子链后半针（back loop）：平行位于前半针后上方，两端相接成环 */
export function createBackChainCurve(): CatmullRomCurve3 {
  return new CatmullRomCurve3([
    new Vector3(-0.36, 0.25, 0.02),
    new Vector3(-0.18, 0.30, -0.035),
    new Vector3(0.0, 0.32, -0.045),
    new Vector3(0.18, 0.30, -0.035),
    new Vector3(0.36, 0.25, 0.02),
  ])
}

/** 向下钩入立柱（post / hook）：从 V 字根部往下延伸穿透上一圈辫子高度（y ≈ -0.68），并回勾咬住 */
export function createPostCurve(): CatmullRomCurve3 {
  return new CatmullRomCurve3([
    new Vector3(0.0, -0.15, 0.03),
    new Vector3(0.01, -0.42, 0.01),
    new Vector3(-0.01, -0.68, -0.03),
    new Vector3(-0.06, -0.74, -0.06),
    new Vector3(-0.04, -0.62, -0.05),
  ])
}

/** 反面细横线（back ridge）：模拟短针背面的横杠结构 */
export function createBackRidgeCurve(): CatmullRomCurve3 {
  return new CatmullRomCurve3([
    new Vector3(-0.16, -0.02, -0.03),
    new Vector3(0.0, -0.01, -0.045),
    new Vector3(0.16, -0.02, -0.03),
  ])
}

/**
 * 组装单个短针的合并几何体（供 InstancedMesh 统一复用渲染）。
 */
export function createStitchGeometry(opts: StitchGeometryOptions = {}): BufferGeometry {
  const r = opts.radius ?? DEFAULT_YARN_RADIUS
  const segRadial = opts.radialSegments ?? DEFAULT_RADIAL_SEGMENTS
  const includeBackRidge = opts.includeBackRidge ?? true
  const includeCaps = opts.includeCaps ?? true

  const parts: BufferGeometry[] = []

  // 1. 正面 V 字左腿与右腿
  const leftLeg = new TubeGeometry(createLeftLegCurve(), 6, r, segRadial, false)
  const rightLeg = new TubeGeometry(createRightLegCurve(), 6, r, segRadial, false)
  parts.push(leftLeg, rightLeg)

  // 2. 顶链前、后半针
  const frontChain = new TubeGeometry(createFrontChainCurve(), 8, r, segRadial, false)
  const backChain = new TubeGeometry(createBackChainCurve(), 8, r, segRadial, false)
  parts.push(frontChain, backChain)

  // 3. 向下穿入上一圈的钩身与回钩
  const post = new TubeGeometry(createPostCurve(), 8, r, segRadial, false)
  parts.push(post)

  // 4. 反面细横杠
  if (includeBackRidge) {
    const backRidge = new TubeGeometry(createBackRidgeCurve(), 5, r * 0.85, segRadial, false)
    parts.push(backRidge)
  }

  // 5. 回勾末梢平滑封帽
  if (includeCaps) {
    const hookEnd = new SphereGeometry(r, segRadial, 4)
    hookEnd.translate(-0.04, -0.62, -0.05)
    parts.push(hookEnd)
  }

  const merged = mergeGeometries(parts, false)

  // 清理临时 geometry
  for (const part of parts) {
    part.dispose()
  }

  return merged
}
