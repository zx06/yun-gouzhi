import { useMemo, useState } from 'react'
import { exportCanvasPng, exportProjectJson } from '../lib/export'
import { countProduced, formatPattern, formatRound, parsePattern } from '../lib/pattern'
import { finishedRounds } from '../lib/engine'
import { makeLevelFromRounds } from '../patterns/custom'
import { useCrochetStore } from '../store/crochetStore'

const PRESET_COLORS = ['#e11d48', '#f59e0b', '#16a34a', '#2563eb', '#9333ea', '#f5f5f4', '#78350f']

export function SandboxPanel() {
  const yarnColor = useCrochetStore((s) => s.yarnColor)
  const setYarnColor = useCrochetStore((s) => s.setYarnColor)
  const work = useCrochetStore((s) => s.work)
  const clearSandbox = useCrochetStore((s) => s.clearSandbox)
  const customPattern = useCrochetStore((s) => s.customPattern)
  const setCustomPattern = useCrochetStore((s) => s.setCustomPattern)
  const startLevel = useCrochetStore((s) => s.startLevel)
  const [msg, setMsg] = useState<string | null>(null)

  const rounds = finishedRounds(work)
  const closed = work.rounds.slice(0, -1)
  const cur = work.rounds[work.rounds.length - 1]
  const fmt = (n: 'zh' | 'en') =>
    [
      closed.length ? formatPattern(closed, n) : '',
      cur.length
        ? n === 'zh'
          ? `第${work.rounds.length}圈（进行中）：${formatRound(cur, n)}`
          : `Rnd ${work.rounds.length} (in progress): ${formatRound(cur, n)}`
        : '',
    ]
      .filter(Boolean)
      .join('\n')
  const zh = rounds.length ? fmt('zh') : ''
  const en = rounds.length ? fmt('en') : ''
  const parsed = useMemo(() => parsePattern(customPattern), [customPattern])

  return (
    <div className="flex flex-col gap-3">
      <section>
        <p className="mb-2 text-xs font-medium text-amber-900/80">换线颜色</p>
        <div className="flex flex-wrap items-center gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`颜色 ${c}`}
              onClick={() => setYarnColor(c)}
              className={`h-9 w-9 rounded-full ring-2 ring-offset-2 ${yarnColor === c ? 'ring-amber-800' : 'ring-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="color"
            aria-label="自定义颜色"
            value={yarnColor}
            onChange={(e) => setYarnColor(e.target.value)}
            className="h-9 w-11 cursor-pointer rounded border-0 bg-transparent"
          />
        </div>
      </section>

      <section className="rounded-xl bg-white/90 p-3 ring-1 ring-amber-200">
        <p className="mb-1 text-xs font-medium text-amber-900/80">自动生成的图解</p>
        {rounds.length ? (
          <div className="max-h-48 overflow-y-auto font-mono text-[12px] leading-relaxed text-amber-950" data-testid="gen-pattern">
            <pre className="whitespace-pre-wrap">{zh}</pre>
            <hr className="my-2 border-amber-100" />
            <pre className="whitespace-pre-wrap">{en}</pre>
          </div>
        ) : (
          <p className="text-xs text-amber-800/70">先钩几针，这里会实时出现中文 / 英文两种图解。</p>
        )}
      </section>

      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={() => void exportCanvasPng()} className="min-h-[44px] rounded-xl bg-sky-600 text-sm font-medium text-white active:bg-sky-700">
          导出 PNG
        </button>
        <button type="button" onClick={() => exportProjectJson()} className="min-h-[44px] rounded-xl bg-violet-600 text-sm font-medium text-white active:bg-violet-700">
          导出 JSON
        </button>
        <button type="button" onClick={() => clearSandbox()} className="min-h-[44px] rounded-xl bg-white text-sm font-medium text-amber-900 ring-1 ring-amber-300 active:bg-amber-50">
          清空
        </button>
      </div>

      <details className="rounded-xl bg-white/90 p-3 ring-1 ring-amber-200">
        <summary className="cursor-pointer text-sm font-medium text-amber-950">📜 粘贴图解，变成闯关（支持 X/V/A 与 sc/inc/dec）</summary>
        <textarea
          value={customPattern}
          onChange={(e) => setCustomPattern(e.target.value)}
          rows={7}
          spellCheck={false}
          className="mt-2 w-full rounded-lg border border-amber-200 bg-amber-50/50 p-2 font-mono text-[12px]"
          aria-label="图解文本"
        />
        <p className="text-xs text-amber-800">
          解析出 {parsed.rounds.length} 圈
          {parsed.rounds.length > 0 && <>，针数：{parsed.rounds.map((r) => countProduced(r.stitches)).join(' → ')}</>}
        </p>
        {parsed.errors.length > 0 && (
          <ul className="mt-1 list-disc pl-4 text-xs text-rose-700">
            {parsed.errors.slice(0, 5).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        {msg && <p className="text-xs text-rose-700">{msg}</p>}
        <button
          type="button"
          disabled={parsed.rounds.length === 0 || parsed.errors.length > 0}
          onClick={() => {
            try {
              startLevel(makeLevelFromRounds(parsed.rounds.map((r) => r.stitches)))
            } catch (e) {
              setMsg(String(e))
            }
          }}
          className="mt-2 min-h-[44px] w-full rounded-xl bg-amber-500 text-sm font-semibold text-white disabled:opacity-40 active:bg-amber-600"
        >
          按此图解开钩 ▶
        </button>
      </details>
    </div>
  )
}
