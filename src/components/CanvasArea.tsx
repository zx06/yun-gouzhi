import { lazy, Suspense } from 'react'
import { Crochet3D } from './Crochet3D'
import { ViewToggle } from './ViewToggle'
import { useCrochetStore } from '../store/crochetStore'
import { countProduced } from '../lib/pattern'

const CrochetCanvas = lazy(() => import('./CrochetCanvas').then((m) => ({ default: m.CrochetCanvas })))

/** 游戏画布：3D 立体（默认，需 WebGL）或 2D 螺旋（备选），右上角切换。 */
export function CanvasArea() {
  const view = useCrochetStore((s) => s.view)
  const work = useCrochetStore((s) => s.work)
  const level = useCrochetStore((s) => s.level)
  const baseColor = useCrochetStore((s) => s.baseColor)
  const colorChanges = useCrochetStore((s) => s.colorChanges)
  const celebrateTick = useCrochetStore((s) => s.celebrateTick)
  const snapshotRef = useCrochetStore((s) => s.snapshotRef)
  const fail3D = useCrochetStore((s) => s.fail3D)
  const notice = useCrochetStore((s) => s.viewNotice)

  return (
    <div className="relative mx-auto w-full max-w-[min(100%,560px)]">
      {view === '3d' ? (
        <Crochet3D
          rounds={work.rounds}
          ringSize={level ? countProduced(level.rounds[0]) : undefined}
          base={baseColor}
          changes={colorChanges}
          celebrateTick={celebrateTick}
          onFail={fail3D}
          snapshotRef={snapshotRef}
          className="aspect-square w-full rounded-2xl shadow-inner ring-1 ring-amber-200"
        />
      ) : (
        <Suspense fallback={<div className="aspect-square w-full animate-pulse rounded-2xl bg-amber-100/60 ring-1 ring-amber-200" />}>
          <CrochetCanvas />
        </Suspense>
      )}
      <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-2">
        <span className="rounded-full bg-white/70 px-2 py-1 text-[11px] text-amber-800/90 backdrop-blur">
          {view === '3d' ? '拖动旋转 · 双指/滚轮缩放' : '俯视螺旋图'}
        </span>
        <div className="pointer-events-auto">
          <ViewToggle />
        </div>
      </div>
      {notice && (
        <p className="mt-2 rounded-lg bg-sky-50 px-3 py-1.5 text-center text-xs text-sky-900 ring-1 ring-sky-200" role="status" data-testid="view-notice">
          {notice}
        </p>
      )}
    </div>
  )
}
