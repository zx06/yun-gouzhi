import { useCrochetStore } from '../store/crochetStore'

export function NotationToggle() {
  const notation = useCrochetStore((s) => s.notation)
  const setNotation = useCrochetStore((s) => s.setNotation)
  return (
    <div className="inline-flex rounded-lg bg-white/80 p-0.5 text-xs ring-1 ring-amber-200" role="group" aria-label="图解写法">
      {(['zh', 'en'] as const).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => setNotation(n)}
          className={`min-h-[32px] rounded-md px-2 ${notation === n ? 'bg-amber-500 font-semibold text-white' : 'text-amber-900'}`}
        >
          {n === 'zh' ? 'X/V/A' : 'sc/inc'}
        </button>
      ))}
    </div>
  )
}
