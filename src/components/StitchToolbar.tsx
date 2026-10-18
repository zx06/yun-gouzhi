import { STITCH_LABELS, stitchSymbol, type StitchType } from '../types/stitch'
import { useCrochetStore } from '../store/crochetStore'
import { progress } from '../lib/engine'

const BUTTONS: StitchType[] = ['sc', 'inc', 'dec', 'ch']

export function StitchToolbar() {
  const placeStitch = useCrochetStore((s) => s.placeStitch)
  const undo = useCrochetStore((s) => s.undo)
  const canUndo = useCrochetStore((s) => s.undoStack.length > 0)
  const hint = useCrochetStore((s) => s.hint)
  const tick = useCrochetStore((s) => s.tick + s.mistakes * 1000)
  const hintKind = useCrochetStore((s) => s.hintKind)
  const notation = useCrochetStore((s) => s.notation)
  const mode = useCrochetStore((s) => s.mode)
  const work = useCrochetStore((s) => s.work)
  const closeMagicRing = useCrochetStore((s) => s.closeMagicRing)
  const showGuide = useCrochetStore((s) => s.mode === 'level' && !!s.level?.guide)
  const expected = useCrochetStore((s) => s.expected())
  const p = progress(work)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2 text-sm text-amber-950 ring-1 ring-amber-200">
        <span>
          第 <b data-testid="round">{p.roundIndex + 1}</b> 圈
        </span>
        <span data-testid="count">
          {p.prevCount === null ? (
            <>魔术环 · 已钩 {p.produced} 针</>
          ) : (
            <>
              本圈已钩 {p.produced} 针 · 上圈剩 <b>{p.remaining}</b>/{p.prevCount} 针
            </>
          )}
        </span>
      </div>
      <p
        key={tick}
        className={`min-h-[2.5rem] rounded-xl px-3 py-2 text-center text-sm font-medium ring-1 ${
          hint && hintKind === 'error'
            ? 'animate-shake bg-rose-100 text-rose-800 ring-rose-300'
            : 'bg-emerald-50 text-emerald-800 ring-emerald-200'
        }`}
        role={hintKind === 'error' ? 'alert' : 'status'}
        data-testid="hint"
      >
        {hint ?? (mode === 'level' ? '对照图解，选择下一针的针法' : '选针法，一针一针自由钩')}
      </p>
      <div className="grid grid-cols-4 gap-2">
        {BUTTONS.map((type) => {
          const L = STITCH_LABELS[type]
          const glow = showGuide && expected === type
          return (
            <button
              key={type}
              type="button"
              onClick={() => placeStitch(type)}
              aria-label={`${L.zh} ${L.symbolZh} ${L.symbolEn}`}
              title={L.tipZh}
              className={`flex min-h-[60px] flex-col items-center justify-center rounded-xl px-1 py-1.5 font-semibold shadow-md ring-1 transition active:scale-95 ${
                glow ? 'bg-amber-400 text-white ring-amber-500' : 'bg-white text-amber-950 ring-amber-200 active:bg-amber-50'
              }`}
            >
              <span className="text-xl leading-none">{stitchSymbol(type, notation)}</span>
              <span className="mt-1 text-[11px] font-normal opacity-80">
                {L.zh} · {stitchSymbol(type, notation === 'zh' ? 'en' : 'zh')}
              </span>
            </button>
          )
        })}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!canUndo}
          onClick={() => undo()}
          className="min-h-[44px] flex-1 rounded-xl bg-stone-700 px-4 text-sm font-medium text-white shadow disabled:opacity-40 active:bg-stone-800"
        >
          ↶ 撤销
        </button>
        {mode === 'sandbox' && p.roundIndex === 0 && (
          <button
            type="button"
            onClick={() => closeMagicRing()}
            className="min-h-[44px] flex-1 rounded-xl bg-amber-600 px-4 text-sm font-medium text-white shadow active:bg-amber-700"
          >
            ◯ 闭合魔术环
          </button>
        )}
      </div>
    </div>
  )
}
