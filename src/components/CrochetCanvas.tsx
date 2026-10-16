import { useEffect, useRef } from 'react'
import { Application, Container, Graphics } from 'pixi.js'
import { useCrochetStore } from '../store/crochetStore'
import { layoutWork, BASE_RADIUS, STEP, type PlacedStitch } from '../lib/geometry'
import { countProduced } from '../lib/pattern'

const SIZE = 640
const POP_MS = 260

function hexNum(c: string) {
  return parseInt(c.replace('#', ''), 16)
}

function shade(color: number, f: number) {
  const r = Math.min(255, Math.round(((color >> 16) & 255) * f))
  const g = Math.min(255, Math.round(((color >> 8) & 255) * f))
  const b = Math.min(255, Math.round((color & 255) * f))
  return (r << 16) | (g << 8) | b
}

/** Draw a single stitch as a little yarn loop oriented along the radius. */
function drawStitch(g: Graphics, s: PlacedStitch, color: number, scale: number) {
  const dirX = Math.cos(s.angle)
  const dirY = Math.sin(s.angle)
  const tx = -dirY
  const ty = dirX
  const len = 7 * scale
  const w = 4.2 * scale
  if (s.type === 'ch') {
    g.ellipse(s.x, s.y, 4 * scale, 2.6 * scale)
    g.stroke({ width: 2.2, color: shade(color, 0.8) })
    return
  }
  // V-shaped loop: two strands from the base to the top
  const bx = s.x - dirX * len * 0.5
  const by = s.y - dirY * len * 0.5
  const top1x = s.x + dirX * len * 0.5 + tx * w * 0.5
  const top1y = s.y + dirY * len * 0.5 + ty * w * 0.5
  const top2x = s.x + dirX * len * 0.5 - tx * w * 0.5
  const top2y = s.y + dirY * len * 0.5 - ty * w * 0.5
  g.ellipse(s.x, s.y, 5.2 * scale, 5.2 * scale)
  g.fill({ color, alpha: 0.95 })
  g.moveTo(bx, by)
  g.lineTo(top1x, top1y)
  g.moveTo(bx, by)
  g.lineTo(top2x, top2y)
  g.stroke({ width: 1.4, color: shade(color, 1.45), alpha: 0.9, cap: 'round' })
  if (s.type === 'dec') {
    g.moveTo(s.x - tx * 6 * scale, s.y - ty * 6 * scale)
    g.lineTo(s.x + tx * 6 * scale, s.y + ty * 6 * scale)
    g.stroke({ width: 1.2, color: 0x1e3a8a, alpha: 0.7 })
  }
  if (s.type === 'inc' || s.type === 'inc-b') {
    g.circle(s.x, s.y, 6.6 * scale)
    g.stroke({ width: 1, color: 0x166534, alpha: 0.45 })
  }
}

export function CrochetCanvas() {
  const mountRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const layers = useRef<{ world: Container; guide: Graphics; yarn: Graphics; st: Graphics; hook: Graphics } | null>(null)
  const births = useRef(new Map<string, number>())
  const known = useRef(new Set<string>())
  const redrawRef = useRef<() => void>(() => {})

  const work = useCrochetStore((s) => s.work)
  const yarnColor = useCrochetStore((s) => s.yarnColor)
  const level = useCrochetStore((s) => s.level)
  const completed = useCrochetStore((s) => s.completed)
  const rendererRef = useCrochetStore((s) => s.rendererRef)

  useEffect(() => {
    let destroyed = false
    const mount = mountRef.current
    if (!mount) return
    const app = new Application()
    void app
      .init({
        width: SIZE,
        height: SIZE,
        background: 0xfffbeb,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
        preference: 'webgl',
      })
      .then(() => {
        if (destroyed) {
          app.destroy(true)
          return
        }
        appRef.current = app
        rendererRef.current = app
        app.canvas.style.width = '100%'
        app.canvas.style.height = 'auto'
        app.canvas.style.display = 'block'
        app.canvas.style.borderRadius = '1rem'
        mount.appendChild(app.canvas)
        const world = new Container()
        world.position.set(SIZE / 2, SIZE / 2)
        const guide = new Graphics()
        const yarn = new Graphics()
        const st = new Graphics()
        const hook = new Graphics()
        world.addChild(guide, yarn, st, hook)
        const bg = new Graphics().rect(0, 0, SIZE, SIZE).fill(0xfffbeb)
        app.stage.addChild(bg, world)
        layers.current = { world, guide, yarn, st, hook }
        app.ticker.add(() => {
          if (births.current.size > 0) redrawRef.current()
        })
        redrawRef.current()
      })
    return () => {
      destroyed = true
      rendererRef.current = null
      layers.current = null
      if (appRef.current) {
        appRef.current.destroy(true, { children: true })
        appRef.current = null
      }
    }
  }, [rendererRef])

  useEffect(() => {
    const ringSize = level ? countProduced(level.rounds[0]) : undefined
    const layout = layoutWork(work, ringSize)
    const now = performance.now()
    const ids = new Set(layout.stitches.map((s) => s.id))
    for (const s of layout.stitches) {
      if (!known.current.has(s.id)) births.current.set(s.id, now)
    }
    known.current = ids
    const color = hexNum(yarnColor)
    const targetRounds = level ? level.rounds.length : work.rounds.length

    redrawRef.current = () => {
      const L = layers.current
      if (!L) return
      const t = performance.now()
      const outer = Math.max(layout.maxRadius, BASE_RADIUS + (targetRounds + 1) * STEP)
      L.world.scale.set(Math.min(2.2, (SIZE / 2 - 24) / outer))

      L.guide.clear()
      L.guide.circle(0, 0, BASE_RADIUS * 0.55)
      L.guide.stroke({ width: 1.5, color: 0xd97706, alpha: 0.45 })
      for (let r = 0; r < targetRounds; r++) {
        L.guide.circle(0, 0, BASE_RADIUS + r * STEP + STEP / 2)
        L.guide.stroke({ width: 1, color: 0xf59e0b, alpha: 0.18 })
      }

      L.yarn.clear()
      const pts = layout.stitches
      if (pts.length > 1) {
        L.yarn.moveTo(pts[0].x, pts[0].y)
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1]
          const b = pts[i]
          const mx = (a.x + b.x) / 2 - (b.y - a.y) * 0.18
          const my = (a.y + b.y) / 2 + (b.x - a.x) * 0.18
          L.yarn.quadraticCurveTo(mx, my, b.x, b.y)
        }
        L.yarn.stroke({ width: 2.2, color: shade(color, 0.75), alpha: 0.55, cap: 'round', join: 'round' })
      }

      L.st.clear()
      for (const s of pts) {
        const b = births.current.get(s.id)
        let scale = 1
        if (b !== undefined) {
          const p = (t - b) / POP_MS
          if (p >= 1) births.current.delete(s.id)
          else scale = 0.3 + 0.9 * Math.sin(Math.min(1, p) * Math.PI * 0.75) // overshoot pop
        }
        drawStitch(L.st, s, color, scale)
      }

      L.hook.clear()
      if (!completed) {
        const n = layout.next
        const pulse = 1 + 0.15 * Math.sin(t / 180)
        L.hook.circle(n.x, n.y, 7 * pulse)
        L.hook.stroke({ width: 2, color: 0x0ea5e9, alpha: 0.8 })
        // hook shaft pointing outward
        const ox = Math.cos(n.angle)
        const oy = Math.sin(n.angle)
        const hx = n.x + ox * 10
        const hy = n.y + oy * 10
        L.hook.moveTo(hx, hy)
        L.hook.lineTo(hx + ox * 34 + oy * 6, hy + oy * 34 - ox * 6)
        L.hook.stroke({ width: 4, color: 0x78716c, cap: 'round' })
        L.hook.arc(hx, hy, 4, n.angle + Math.PI * 0.5, n.angle + Math.PI * 1.6)
        L.hook.stroke({ width: 3, color: 0x57534e, cap: 'round' })
      }
    }
    redrawRef.current()
  }, [work, yarnColor, level, completed])

  return (
    <div
      ref={mountRef}
      className="mx-auto aspect-square w-full max-w-[min(100%,560px)] overflow-hidden rounded-2xl shadow-inner ring-1 ring-amber-200"
      role="img"
      aria-label="钩织画布"
    />
  )
}
