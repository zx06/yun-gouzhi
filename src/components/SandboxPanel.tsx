import { useState } from 'react'
import { exportCanvasPng, exportProjectJson } from '../lib/export'
import { formatPattern, formatRound } from '../lib/pattern'
import { finishedRounds } from '../lib/engine'
import { useCrochetStore } from '../store/crochetStore'
import { PatternToLevel } from './PatternToLevel'

function SaveAsLevel() {
  const workId = useCrochetStore((s) => s.workId)
  const saveWorkAsLevel = useCrochetStore((s) => s.saveWorkAsLevel)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  if (!workId) return null
  return (
    <div>
      <button
        type="button"
        data-testid="save-work-level"
        onClick={() => {
          const res = saveWorkAsLevel(workId)
          setMsg(res.error ? { text: res.error, ok: false } : { text: `已存为关卡「${res.level?.title}」，在菜单的「我的关卡」里可以闯关`, ok: true })
        }}
        className="min-h-[44px] w-full rounded-xl bg-emerald-600 text-sm font-medium text-white active:bg-emerald-700"
      >
        ⭐ 把已钩完的圈存为我的关卡
      </button>
      {msg && <p className={`mt-1 text-xs ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</p>}
    </div>
  )
}

const PRESET_COLORS = ['#e11d48', '#f59e0b', '#16a34a', '#2563eb', '#9333ea', '#f5f5f4', '#78350f']

export function SandboxPanel() {
  const yarnColor = useCrochetStore((s) => s.yarnColor)
  const setYarnColor = useCrochetStore((s) => s.setYarnColor)
  const work = useCrochetStore((s) => s.work)
  const clearSandbox = useCrochetStore((s) => s.clearSandbox)

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

      <SaveAsLevel />

      <details className="rounded-xl bg-white/90 p-3 ring-1 ring-amber-200">
        <summary className="cursor-pointer text-sm font-medium text-amber-950">📜 粘贴图解，变成闯关（支持 X/V/A 与 sc/inc/dec）</summary>
        <PatternToLevel />
      </details>
    </div>
  )
}
