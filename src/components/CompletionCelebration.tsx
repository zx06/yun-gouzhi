import { useCrochetStore, starsFor } from '../store/crochetStore'
import { exportCanvasPng } from '../lib/export'

export function CompletionCelebration() {
  const mistakes = useCrochetStore((s) => s.mistakes)
  const level = useCrochetStore((s) => s.level)
  const goMenu = useCrochetStore((s) => s.goMenu)
  const startLevel = useCrochetStore((s) => s.startLevel)
  const startSandbox = useCrochetStore((s) => s.startSandbox)
  const stars = starsFor(mistakes)
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-3 sm:inset-0 sm:items-center sm:bg-black/30" role="dialog" aria-labelledby="celebrate-title">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-2xl ring-1 ring-amber-200">
        <p className="text-3xl tracking-widest text-amber-500" aria-label={`${stars} 星`}>
          {'★'.repeat(stars)}
          <span className="text-stone-300">{'★'.repeat(3 - stars)}</span>
        </p>
        <h2 id="celebrate-title" className="mt-1 text-xl font-bold text-amber-950">
          {level?.id === 'coaster-l1' ? '杯垫完成！🎉' : '作品完成！🎉'}
        </h2>
        <p className="mt-1 text-sm text-amber-900/80">{mistakes === 0 ? '零失误，完美！' : `失误 ${mistakes} 次，再来一次争取三星？`}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => startLevel(level ?? undefined)} className="min-h-[44px] rounded-xl bg-amber-500 font-semibold text-white active:bg-amber-600">
            再玩一次
          </button>
          <button type="button" onClick={() => void exportCanvasPng()} className="min-h-[44px] rounded-xl bg-sky-600 font-semibold text-white active:bg-sky-700">
            导出 PNG
          </button>
          <button type="button" onClick={() => startSandbox()} className="min-h-[44px] rounded-xl bg-white font-medium text-amber-950 ring-1 ring-amber-300">
            去沙盒
          </button>
          <button type="button" onClick={() => goMenu()} className="min-h-[44px] rounded-xl bg-white font-medium text-amber-950 ring-1 ring-amber-300">
            返回菜单
          </button>
        </div>
      </div>
    </div>
  )
}
