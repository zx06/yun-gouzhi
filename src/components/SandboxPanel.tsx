import { exportCanvasPng, exportProjectJson } from '../lib/export'
import { actionsToPatternEn, actionsToPatternZh } from '../lib/patternText'
import { useCrochetStore } from '../store/crochetStore'

const PRESET_COLORS = ['#e11d48', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0d9488']

export function SandboxPanel() {
  const yarnColor = useCrochetStore((s) => s.yarnColor)
  const setYarnColor = useCrochetStore((s) => s.setYarnColor)
  const actions = useCrochetStore((s) => s.actions)
  const clearSandbox = useCrochetStore((s) => s.clearSandbox)

  const patternEn = actions.length ? actionsToPatternEn(actions) : ''
  const patternZh = actions.length ? actionsToPatternZh(actions) : ''

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-2 text-xs font-medium text-amber-900/70">毛线颜色 · Yarn</p>
        <div className="flex flex-wrap items-center gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`颜色 ${c}`}
              onClick={() => setYarnColor(c)}
              className={`h-10 w-10 rounded-full ring-2 ring-offset-2 ${yarnColor === c ? 'ring-amber-800' : 'ring-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg bg-white px-2 ring-1 ring-amber-200">
            <span className="text-xs text-amber-900">自定义</span>
            <input
              type="color"
              value={yarnColor}
              onChange={(e) => setYarnColor(e.target.value)}
              className="h-8 w-10 cursor-pointer border-0 bg-transparent"
            />
          </label>
        </div>
      </div>

      {actions.length > 0 && (
        <div className="max-h-32 overflow-y-auto rounded-xl bg-white/90 p-2 text-[11px] leading-relaxed text-amber-950 ring-1 ring-amber-100 sm:text-xs">
          <pre className="whitespace-pre-wrap font-mono">{patternZh}</pre>
          <hr className="my-2 border-amber-100" />
          <pre className="whitespace-pre-wrap font-mono">{patternEn}</pre>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void exportCanvasPng()}
          className="min-h-[44px] rounded-xl bg-sky-600 text-sm font-medium text-white active:bg-sky-700"
        >
          导出 PNG
        </button>
        <button
          type="button"
          onClick={() => exportProjectJson()}
          className="min-h-[44px] rounded-xl bg-violet-600 text-sm font-medium text-white active:bg-violet-700"
        >
          导出 JSON
        </button>
      </div>
      <button
        type="button"
        onClick={() => clearSandbox()}
        className="min-h-[40px] text-sm text-amber-800 underline underline-offset-2"
      >
        清空画布 · Clear
      </button>
    </div>
  )
}
