import type { StitchType } from '../types/stitch'
import { STITCH_LABELS } from '../types/stitch'
import { useCrochetStore } from '../store/crochetStore'

const BUTTONS: StitchType[] = ['sc', 'inc', 'dec', 'ch']

export function StitchToolbar() {
  const placeStitch = useCrochetStore((s) => s.placeStitch)
  const undo = useCrochetStore((s) => s.undo)
  const undoStack = useCrochetStore((s) => s.undoStack)
  const wrongHint = useCrochetStore((s) => s.wrongHint)

  return (
    <div className="flex flex-col gap-2">
      {wrongHint && (
        <p
          className="animate-pulse rounded-xl bg-rose-100 px-3 py-2 text-center text-sm font-medium text-rose-800 ring-1 ring-rose-300"
          role="alert"
        >
          {wrongHint}
        </p>
      )}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {BUTTONS.map((type) => {
          const L = STITCH_LABELS[type]
          return (
            <button
              key={type}
              type="button"
              onClick={() => placeStitch(type)}
              className="flex min-h-[52px] flex-col items-center justify-center rounded-xl bg-white px-1 py-2 text-xs font-semibold text-amber-950 shadow-md ring-1 ring-amber-200 transition active:scale-95 active:bg-amber-50 sm:min-h-[56px] sm:text-sm"
            >
              <span className="text-base sm:text-lg">{L.symbolZh}</span>
              <span className="text-[10px] font-normal text-amber-800/80 sm:text-xs">
                {L.symbolEn}
              </span>
            </button>
          )
        })}
      </div>
      <button
        type="button"
        disabled={undoStack.length === 0}
        onClick={() => undo()}
        className="min-h-[44px] rounded-xl bg-stone-700 px-4 py-2 text-sm font-medium text-white shadow disabled:cursor-not-allowed disabled:opacity-40 active:bg-stone-800"
      >
        撤销 · Undo
      </button>
    </div>
  )
}
