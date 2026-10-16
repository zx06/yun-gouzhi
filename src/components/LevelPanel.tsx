import { useCrochetStore } from '../store/crochetStore'
import { countProduced, formatRound } from '../lib/pattern'

export function LevelPanel() {
  const level = useCrochetStore((s) => s.level)
  const work = useCrochetStore((s) => s.work)
  const notation = useCrochetStore((s) => s.notation)
  const completed = useCrochetStore((s) => s.completed)
  const mistakes = useCrochetStore((s) => s.mistakes)
  if (!level) return null
  const cur = completed ? -1 : work.rounds.length - 1
  const done = work.rounds.reduce((n, r) => n + r.length, 0)
  const total = level.rounds.reduce((n, r) => n + r.length, 0)

  return (
    <section className="rounded-xl bg-white/85 p-3 text-sm ring-1 ring-amber-200">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold text-amber-950">目标图解</h2>
        <span className="text-xs text-amber-800">
          进度 {done}/{total} · 失误 {mistakes}
        </span>
      </div>
      <div className="mb-2 h-2 overflow-hidden rounded-full bg-amber-100">
        <div className="h-full bg-amber-500 transition-all" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <ol className="space-y-1 font-mono text-[13px]">
        {level.rounds.map((r, i) => {
          const active = i === cur
          const finished = completed || i < cur
          const made = active ? work.rounds[i].length : 0
          return (
            <li
              key={i}
              className={`rounded-lg px-2 py-1 ${active ? 'bg-amber-100 ring-1 ring-amber-400' : ''} ${finished ? 'text-emerald-700' : 'text-amber-950'}`}
            >
              {finished ? '✓ ' : active ? '▶ ' : '　'}
              {notation === 'zh' ? `第${i + 1}圈：` : `Rnd ${i + 1}: `}
              {formatRound(r, notation)} <span className="opacity-70">({countProduced(r)})</span>
              {active && (
                <span className="ml-1 text-xs text-amber-700">
                  {made}/{r.length}
                </span>
              )}
            </li>
          )
        })}
      </ol>
      {cur >= 0 && level.tips[cur] && <p className="mt-2 text-xs text-amber-800">💡 {level.tips[cur]}</p>}
    </section>
  )
}
