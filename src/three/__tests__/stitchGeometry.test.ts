import { describe, expect, it } from 'vitest'
import {
  DEFAULT_YARN_RADIUS,
  DEFAULT_RADIAL_SEGMENTS,
  createLeftLegCurve,
  createRightLegCurve,
  createFrontChainCurve,
  createBackChainCurve,
  createPostCurve,
  createBackRidgeCurve,
  createStitchGeometry,
} from '../stitchGeometry'

describe('stitchGeometry paths', () => {
  it('creates left and right V-leg curves forming a symmetrical opening', () => {
    const left = createLeftLegCurve()
    const right = createRightLegCurve()
    expect(left.points.length).toBeGreaterThanOrEqual(3)
    expect(right.points.length).toBeGreaterThanOrEqual(3)

    // Base of V: legs should be close together at the bottom
    const leftBottom = left.points[0]
    const rightBottom = right.points[0]
    expect(leftBottom.y).toBeCloseTo(rightBottom.y, 2)
    expect(leftBottom.x).toBeLessThan(0)
    expect(rightBottom.x).toBeGreaterThan(0)
    expect(rightBottom.x - leftBottom.x).toBeLessThan(0.12)

    // Top of V: legs spread outward
    const leftTop = left.points[left.points.length - 1]
    const rightTop = right.points[right.points.length - 1]
    expect(leftTop.y).toBeGreaterThan(0.2)
    expect(rightTop.y).toBeGreaterThan(0.2)
    expect(leftTop.x).toBeLessThan(-0.18)
    expect(rightTop.x).toBeGreaterThan(0.18)
    expect(rightTop.x - leftTop.x).toBeGreaterThan(0.35)
  })

  it('creates front and back chain curves across the top forming a top loop', () => {
    const front = createFrontChainCurve()
    const back = createBackChainCurve()

    // Both curves span horizontally across the stitch
    const frontStart = front.points[0]
    const frontEnd = front.points[front.points.length - 1]
    expect(frontStart.x).toBeCloseTo(-0.36, 2)
    expect(frontEnd.x).toBeCloseTo(0.36, 2)
    expect(frontEnd.x - frontStart.x).toBeGreaterThan(0.65)

    // Front bar sits in front (+z), back bar sits behind (-z)
    const frontMid = front.getPoint(0.5)
    const backMid = back.getPoint(0.5)
    expect(frontMid.z).toBeGreaterThan(backMid.z)
    expect(frontMid.y).toBeGreaterThan(0.25)
    expect(backMid.y).toBeGreaterThan(0.25)
  })

  it('creates a downward post curve reaching into the previous round height', () => {
    const post = createPostCurve()
    const start = post.points[0]
    const hookTip = post.points[post.points.length - 1]

    // Starts near base of V
    expect(start.y).toBeCloseTo(-0.15, 1)

    // Minimum y should extend below -0.70 to hook into previous round chain height
    let minY = Infinity
    for (let t = 0; t <= 1; t += 0.05) {
      const p = post.getPoint(t)
      if (p.y < minY) minY = p.y
    }
    expect(minY).toBeLessThan(-0.70)
    // Hook tip curves back
    expect(hookTip.z).toBeLessThan(0)
  })

  it('creates back ridge curve for backside stitch texture', () => {
    const ridge = createBackRidgeCurve()
    expect(ridge.points.length).toBeGreaterThanOrEqual(3)
    const mid = ridge.getPoint(0.5)
    expect(mid.z).toBeLessThan(0)
  })
})

describe('createStitchGeometry', () => {
  it('builds a merged geometry with valid attributes', () => {
    const geo = createStitchGeometry()
    expect(geo.attributes.position).toBeDefined()
    expect(geo.attributes.normal).toBeDefined()
    expect(geo.attributes.uv).toBeDefined()
    expect(geo.index).toBeDefined()
    expect(geo.attributes.position.count).toBeGreaterThan(150)

    geo.computeBoundingBox()
    const box = geo.boundingBox!

    // Yarn tubes should be thin (radius ~0.055)
    expect(DEFAULT_YARN_RADIUS).toBeGreaterThanOrEqual(0.04)
    expect(DEFAULT_YARN_RADIUS).toBeLessThanOrEqual(0.07)
    expect(DEFAULT_RADIAL_SEGMENTS).toBeGreaterThanOrEqual(6)

    // Width should span approximately [-0.42, 0.42] (total width < 0.9, leaving gaps with stitch width 1.0)
    expect(box.min.x).toBeLessThan(-0.35)
    expect(box.max.x).toBeGreaterThan(0.35)
    expect(box.max.x - box.min.x).toBeLessThan(0.95)

    // Height should cover from hook bottom (~ -0.75) up to top chain (~ +0.35)
    expect(box.min.y).toBeLessThan(-0.70)
    expect(box.max.y).toBeGreaterThan(0.30)

    // Depth should be thin (~0.22 total), NOT fat like 0.76 of CapsuleGeometry(0.19)
    const depth = box.max.z - box.min.z
    expect(depth).toBeLessThan(0.35)
    expect(depth).toBeGreaterThan(0.12)

    geo.dispose()
  })

  it('supports custom radius and segments', () => {
    const customRadius = 0.045
    const geo = createStitchGeometry({ radius: customRadius, radialSegments: 8 })
    expect(geo.attributes.position.count).toBeGreaterThan(0)
    geo.dispose()
  })

  it('allows disabling back ridge or caps', () => {
    const full = createStitchGeometry()
    const minimal = createStitchGeometry({ includeBackRidge: false, includeCaps: false })
    expect(minimal.attributes.position.count).toBeLessThan(full.attributes.position.count)
    full.dispose()
    minimal.dispose()
  })
})
