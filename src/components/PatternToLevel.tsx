import { useMemo, useState } from 'react'
import { countProduced, parsePattern } from '../lib/pattern'
import { levelRoundsError } from '../lib/storage'
import { makeLevelFromRounds } from '../patterns/custom'
import { useCrochetStore } from '../store/crochetStore'

/** 粘贴图解 → 直接开钩 / 存为我的关卡 */
export function PatternToLevel() {
  const customPattern = useCrochetStore((s) => s.customPattern)
  const setCustomPattern = useCrochetStore((s) => s.setCustomPattern)
  const startLevel = useCrochetStore((s) => s.startLevel)
  const savePatternAsLevel = useCrochetStore((s) => s.savePatternAsLevel)
  const count = useCrochetStore((s) => s.data.customLevels.length)
  const [title, setTitle] = useState('')
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const parsed = useMemo(() => parsePattern(customPattern), [customPattern])
  const rounds = parsed.rounds.map((r) => r.stitches)
  const levelErr = parsed.rounds.length ? levelRoundsError(rounds) : null
  const blocked = parsed.rounds.length === 0 || parsed.errors.length > 0 || !!levelErr

  return (
    <div>
      <textarea
        value={customPattern}
        onChange={(e) => {
          setCustomPattern(e.target.value)
          setMsg(null)
        }}
        rows={7}
        spellCheck={false}
        className="mt-2 w-full rounded-lg border border-amber-200 bg-amber-50/50 p-2 font-mono text-[12px]"
        aria-label="图解文本"
      />
      <p className="text-xs text-amber-800">
        解析出 {parsed.rounds.length} 圈
        {parsed.rounds.length > 0 && <>，针数：{rounds.map((r) => countProduced(r)).join(' → ')}</>}
      </p>
      {(parsed.errors.length > 0 || levelErr) && (
        <ul className="mt-1 list-disc pl-4 text-xs text-rose-700">
          {[...parsed.errors, ...(levelErr && !parsed.errors.length ? [levelErr] : [])].slice(0, 5).map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={blocked}
          onClick={() => {
            try {
              startLevel(makeLevelFromRounds(rounds))
            } catch (e) {
              setMsg({ text: e instanceof Error ? e.message : String(e), ok: false })
            }
          }}
          className="min-h-[44px] rounded-xl bg-amber-500 text-sm font-semibold text-white disabled:opacity-40 active:bg-amber-600"
        >
          按此图解开钩 ▶
        </button>
        <button
          type="button"
          disabled={blocked}
          data-testid="save-pattern-level"
          onClick={() => {
            const res = savePatternAsLevel(rounds, title.trim() || `我的图解 ${count + 1}`)
            setMsg(res.error ? { text: res.error, ok: false } : { text: `已存为「${res.level?.title}」，在菜单的「我的关卡」里`, ok: true })
          }}
          className="min-h-[44px] rounded-xl bg-white text-sm font-semibold text-amber-900 ring-1 ring-amber-300 disabled:opacity-40 active:bg-amber-50"
        >
          存为我的关卡
        </button>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={40}
        placeholder={`关卡名（默认「我的图解 ${count + 1}」）`}
        aria-label="关卡名"
        className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-2 py-2 text-sm"
      />
      {msg && <p className={`mt-1 text-xs ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</p>}
    </div>
  )
}
