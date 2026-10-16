import { useEffect, useRef } from 'react'
import { Application, Container, Graphics } from 'pixi.js'
import { useCrochetStore } from '../store/crochetStore'
import { yarnPathPoints } from '../lib/geometry'

const CANVAS_SIZE = 640

export function CrochetCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const worldRef = useRef<Container | null>(null)
  const yarnRef = useRef<Graphics | null>(null)
  const stitchesRef = useRef<Graphics | null>(null)
  const hookRef = useRef<Graphics | null>(null)

  const stitches = useCrochetStore((s) => s.stitches)
  const yarnColor = useCrochetStore((s) => s.yarnColor)
  const popTick = useCrochetStore((s) => s.popTick)
  const setRenderer = useCrochetStore((s) => s.setRenderer)
  const tickPop = useCrochetStore((s) => s.tickPop)

  useEffect(() => {
    let destroyed = false
    const mount = containerRef.current
    if (!mount) return

    const app = new Application()
    appRef.current = app
    setRenderer(app)

    void app.init({
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    }).then(() => {
      if (destroyed) {
        app.destroy(true)
        return
      }
      mount.appendChild(app.canvas)
      app.canvas.style.width = '100%'
      app.canvas.style.height = 'auto'
      app.canvas.style.maxWidth = `${CANVAS_SIZE}px`
      app.canvas.style.display = 'block'
      app.canvas.style.touchAction = 'none'

      const world = new Container()
      world.x = CANVAS_SIZE / 2
      world.y = CANVAS_SIZE / 2
      worldRef.current = world
      app.stage.addChild(world)

      const grid = new Graphics()
      grid.circle(0, 0, 28)
      grid.stroke({ width: 1, color: 0xd97706, alpha: 0.35 })
      for (let r = 1; r <= 5; r++) {
        grid.circle(0, 0, 14 + r * 16)
        grid.stroke({ width: 1, color: 0xfbbf24, alpha: 0.2 })
      }
      world.addChild(grid)

      const yarn = new Graphics()
      yarnRef.current = yarn
      world.addChild(yarn)

      const stitchG = new Graphics()
      stitchesRef.current = stitchG
      world.addChild(stitchG)

      const hook = new Graphics()
      hookRef.current = hook
      world.addChild(hook)

      app.ticker.add(() => tickPop())
    })

    return () => {
      destroyed = true
      setRenderer(null)
      if (appRef.current) {
        appRef.current.destroy(true, { children: true })
        appRef.current = null
      }
      mount.innerHTML = ''
    }
  }, [setRenderer, tickPop])

  useEffect(() => {
    const app = appRef.current
    const yarn = yarnRef.current
    const stitchG = stitchesRef.current
    const hook = hookRef.current
    if (!app || !yarn || !stitchG || !hook) return

    const colorNum = parseInt(yarnColor.replace('#', ''), 16)

    yarn.clear()
    if (stitches.length >= 2) {
      const path = yarnPathPoints(stitches)
      yarn.moveTo(path[0].x, path[0].y)
      for (let i = 1; i < path.length; i++) {
        const p = path[i]
        if (i % 2 === 1 && i + 1 < path.length) {
          const next = path[i + 1]
          yarn.quadraticCurveTo(p.x, p.y, next.x, next.y)
          i++
        } else {
          yarn.lineTo(p.x, p.y)
        }
      }
      yarn.stroke({ width: 4, color: colorNum, cap: 'round', join: 'round', alpha: 0.85 })
    }

    stitchG.clear()
    for (const s of stitches) {
      const pop = s.pop ?? 1
      const scale = 0.6 + pop * 0.4
      stitchG.circle(s.x, s.y, 5 * scale)
      stitchG.fill({ color: colorNum, alpha: 0.95 })
      stitchG.stroke({ width: 1, color: 0x78350f, alpha: 0.5 })
      if (pop > 0.6 && (s.type === 'inc' || s.type === 'dec')) {
        stitchG.moveTo(s.x - 3, s.y)
        stitchG.lineTo(s.x + 3, s.y)
        stitchG.stroke({ width: 1, color: 0xffffff, alpha: 0.7 })
      }
    }

    hook.clear()
    const last = stitches[stitches.length - 1]
    const hx = last ? last.x + 18 : 0
    const hy = last ? last.y - 14 : -20
    hook.moveTo(hx, hy)
    hook.lineTo(hx + 22, hy - 8)
    hook.lineTo(hx + 20, hy + 4)
    hook.stroke({ width: 3, color: 0x57534e, cap: 'round' })
    hook.circle(hx + 22, hy - 2, 5)
    hook.stroke({ width: 2, color: 0xa8a29e })
  }, [stitches, yarnColor, popTick])

  return (
    <div
      ref={containerRef}
      className="mx-auto w-full max-w-[min(100vw-1.5rem,640px)] rounded-2xl bg-amber-50/80 shadow-inner ring-1 ring-amber-200/80"
      aria-label="钩织画布"
    />
  )
}
