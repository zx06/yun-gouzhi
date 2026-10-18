import { useEffect, useRef, useState } from 'react'
import type { StitchType } from '../types/stitch'
import type { ColorChange } from '../lib/colors'
import type { CrochetScene } from '../three/CrochetScene'

export interface Crochet3DProps {
  rounds: StitchType[][]
  ringSize?: number
  base: string
  changes: ColorChange[]
  /** 变化时播放一段转盘展示 */
  celebrateTick?: number
  onFail?: (reason: string) => void
  /** 注册截图函数（导出 PNG） */
  snapshotRef?: { current: (() => Promise<string> | string) | null }
  className?: string
  label?: string
}

/** Three.js 立体视图：Three 与场景代码按需加载（单独的 chunk）。 */
export function Crochet3D({ rounds, ringSize, base, changes, celebrateTick = 0, onFail, snapshotRef, className = '', label = '立体钩织预览' }: Crochet3DProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<CrochetScene | null>(null)
  const latest = useRef({ rounds, ringSize, base, changes })
  latest.current = { rounds, ringSize, base, changes }
  const failRef = useRef(onFail)
  failRef.current = onFail
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [count, setCount] = useState(0)

  useEffect(() => {
    let disposed = false
    const mount = mountRef.current
    if (!mount) return
    import('../three/CrochetScene')
      .then(({ CrochetScene }) => {
        if (disposed) return
        let scene: CrochetScene
        try {
          scene = new CrochetScene(mount, { onContextLost: () => failRef.current?.('WebGL 上下文丢失') })
        } catch (e) {
          setState('failed')
          failRef.current?.(e instanceof Error ? e.message : 'WebGL 初始化失败')
          return
        }
        sceneRef.current = scene
        scene.update(latest.current)
        setCount(scene.stitchCount)
        if (snapshotRef) snapshotRef.current = () => scene.snapshot()
        setState('ready')
      })
      .catch(() => {
        if (disposed) return
        setState('failed')
        failRef.current?.('3D 模块加载失败')
      })
    return () => {
      disposed = true
      if (snapshotRef) snapshotRef.current = null
      sceneRef.current?.dispose()
      sceneRef.current = null
    }
  }, [snapshotRef])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    scene.update({ rounds, ringSize, base, changes })
    setCount(scene.stitchCount)
  }, [rounds, ringSize, base, changes])

  useEffect(() => {
    if (celebrateTick > 0) sceneRef.current?.spin()
  }, [celebrateTick])

  return (
    <div
      ref={mountRef}
      className={`relative overflow-hidden ${className}`}
      role="img"
      aria-label={label}
      data-testid="view-3d"
      data-ready={state === 'ready' ? 'true' : 'false'}
      data-stitches={count}
    >
      {state === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-amber-700/80">
          <span className="animate-pulse">🧶 正在准备立体视图…</span>
        </div>
      )}
    </div>
  )
}
