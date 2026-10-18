import { useCrochetStore, starsFor } from '../store/crochetStore'
import { exportCanvasPng } from '../lib/export'
import { nextLevel } from '../patterns/levels'

const CONFETTI_COLORS = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#a855f7', '#f472b6']
const CONFETTI = Array.from({ length: 36 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  delay: `${((i * 53) % 60) / 100}s`,
  t: `${2 + ((i * 29) % 15) / 10}s`,
  dx: `${((i * 41) % 120) - 60}px`,
}))

function Confetti() {
  return (
    <div aria-hidden>
      {CONFETTI.map((c, i) => (
        <span key={i} className="confetti" style={{ left: c.left, background: c.color, animationDelay: c.delay, ['--t' as string]: c.t, ['--dx' as string]: c.dx }} />
      ))}
    </div>
  )
}

export function CompletionCelebration() {
  const mistakes = useCrochetStore((s) => s.mistakes)
  const level = useCrochetStore((s) => s.level)
  const goMenu = useCrochetStore((s) => s.goMenu)
  const startLevel = useCrochetStore((s) => s.startLevel)
  const openWorks = useCrochetStore((s) => s.openWorks)
  const next = level && !level.custom ? nextLevel(level.id) : null
  const stars = starsFor(mistakes)
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-3 sm:inset-0 sm:items-center sm:bg-black/30" role="dialog" aria-labelledby="celebrate-title">
      <Confetti />
      <div className="animate-rise w-full max-w-sm rounded-2xl bg-white/95 p-5 text-center shadow-2xl ring-1 ring-amber-200 backdrop-blur">
        <p className="text-3xl tracking-widest text-amber-500" aria-label={`${stars} 星`}>
          {'★'.repeat(stars)}
          <span className="text-stone-300">{'★'.repeat(3 - stars)}</span>
        </p>
        <h2 id="celebrate-title" className="mt-1 text-xl font-bold text-amber-950">
          {level?.doneTitle ?? '作品完成！🎉'}
        </h2>
        <p className="mt-1 text-sm text-amber-900/80">{mistakes === 0 ? '零失误，完美！' : `失误 ${mistakes} 次，再来一次争取三星？`}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {next && (
            <button type="button" onClick={() => startLevel(next)} data-testid="next-level" className="col-span-2 min-h-[48px] rounded-xl bg-emerald-600 font-semibold text-white active:bg-emerald-700">
              下一关：{next.title} ▶
            </button>
          )}
          <button type="button" onClick={() => startLevel(level ?? undefined)} className="min-h-[44px] rounded-xl bg-amber-500 font-semibold text-white active:bg-amber-600">
            再玩一次
          </button>
          <button type="button" onClick={() => void exportCanvasPng()} className="min-h-[44px] rounded-xl bg-sky-600 font-semibold text-white active:bg-sky-700">
            导出 PNG
          </button>
          <button type="button" onClick={() => openWorks()} className="min-h-[44px] rounded-xl bg-white font-medium text-amber-950 ring-1 ring-amber-300">
            我的作品
          </button>
          <button type="button" onClick={() => goMenu()} className="min-h-[44px] rounded-xl bg-white font-medium text-amber-950 ring-1 ring-amber-300">
            返回菜单
          </button>
        </div>
      </div>
    </div>
  )
}
