import { useState } from 'react'
import { useCrochetStore } from '../store/crochetStore'
import { LEVELS, isLevelUnlocked } from '../patterns/levels'
import { countProduced } from '../lib/pattern'
import { STITCH_LABELS, type StitchType } from '../types/stitch'
import type { CustomLevel } from '../lib/storage'
import { PatternToLevel } from './PatternToLevel'
import { NotationToggle } from './NotationToggle'
import { Stars } from './Stars'
import { MuteButton } from './ViewToggle'

function CustomLevelRow({ l }: { l: CustomLevel }) {
  const startCustomLevel = useCrochetStore((s) => s.startCustomLevel)
  const renameCustomLevel = useCrochetStore((s) => s.renameCustomLevel)
  const deleteCustomLevel = useCrochetStore((s) => s.deleteCustomLevel)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(l.title)
  const [confirmDel, setConfirmDel] = useState(false)
  const last = countProduced(l.rounds[l.rounds.length - 1])
  const btn = 'min-h-[36px] rounded-lg px-2 text-xs font-medium ring-1'
  return (
    <li className="rounded-xl bg-white/90 p-2.5 ring-1 ring-amber-200" data-testid="custom-level">
      {editing ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            renameCustomLevel(l.id, title)
            setEditing(false)
          }}
        >
          <input autoFocus value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} aria-label="关卡名" className="min-w-0 flex-1 rounded-lg border border-amber-300 px-2 py-1 text-sm" />
          <button type="submit" className={`${btn} bg-amber-500 text-white ring-amber-500`}>
            保存
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => startCustomLevel(l.id)} className="flex w-full items-center justify-between gap-2 text-left">
          <span className="min-w-0">
            <span className="block truncate font-semibold text-amber-950" data-testid="custom-level-title">
              {l.title}
            </span>
            <span className="text-[11px] text-amber-800/80">
              {l.rounds.length} 圈 · 收尾 {last} 针{l.bestMistakes !== null ? ` · 最少失误 ${l.bestMistakes}` : ' · 未通关'}
            </span>
          </span>
          <Stars n={l.bestStars} className="shrink-0 text-amber-500" />
        </button>
      )}
      <div className="mt-1.5 flex justify-end gap-1.5">
        <button type="button" onClick={() => startCustomLevel(l.id)} className={`${btn} bg-amber-500 text-white ring-amber-500`}>
          开钩 ▶
        </button>
        <button
          type="button"
          onClick={() => {
            setTitle(l.title)
            setEditing((v) => !v)
          }}
          className={`${btn} bg-white text-amber-900 ring-amber-300`}
        >
          重命名
        </button>
        {confirmDel ? (
          <button type="button" onClick={() => deleteCustomLevel(l.id)} className={`${btn} bg-rose-600 text-white ring-rose-600`}>
            确认删除
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setConfirmDel(true)
              setTimeout(() => setConfirmDel(false), 4000)
            }}
            className={`${btn} bg-white text-rose-700 ring-rose-300`}
          >
            删除
          </button>
        )}
      </div>
    </li>
  )
}

export function MenuScreen() {
  const startLevel = useCrochetStore((s) => s.startLevel)
  const openWorks = useCrochetStore((s) => s.openWorks)
  const bestStars = useCrochetStore((s) => s.bestStars)
  const works = useCrochetStore((s) => s.data.works.length)
  const customLevels = useCrochetStore((s) => s.data.customLevels)
  const notice = useCrochetStore((s) => s.storageNotice)
  const dismissNotice = useCrochetStore((s) => s.dismissNotice)
  const cleared = LEVELS.filter((l) => (bestStars[l.id] ?? 0) > 0).length

  return (
    <div className="relative flex min-h-full flex-col items-center px-4 py-8">
      <div className="absolute right-3 top-3">
        <MuteButton />
      </div>
      <header className="mb-5 text-center">
        <div className="animate-float text-5xl drop-shadow-md" aria-hidden>
          🧶
        </div>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-amber-950">云钩织</h1>
        <p className="mt-1 text-sm text-amber-800/90">拿起虚拟钩针，跟着图解一针一针钩</p>
        <p className="mt-1 text-xs text-amber-700/80">✨ 边钩边看立体成形：杯垫是平的，小碗会立起来，小球会鼓起来</p>
      </header>
      {notice && (
        <div className="mb-4 flex w-full max-w-sm items-start gap-2 rounded-xl bg-sky-50 p-3 text-xs text-sky-900 ring-1 ring-sky-200" role="status">
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => dismissNotice()} className="font-semibold" aria-label="关闭提示">
            ✕
          </button>
        </div>
      )}
      <div className="flex w-full max-w-sm flex-col gap-3">
        <section aria-labelledby="levels-title">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 id="levels-title" className="font-semibold text-amber-950">
              教程关卡
            </h2>
            <span className="text-xs text-amber-800" data-testid="level-progress">
              已通关 {cleared}/{LEVELS.length}
            </span>
          </div>
          <ol className="flex flex-col gap-2">
            {LEVELS.map((l, i) => {
              const unlocked = isLevelUnlocked(i, bestStars)
              const stitches = l.rounds.reduce((n, r) => n + r.length, 0)
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    disabled={!unlocked}
                    onClick={() => startLevel(l)}
                    data-testid={`level-${l.id}`}
                    className={`lift flex min-h-[60px] w-full items-center gap-3 rounded-2xl px-4 py-2 text-left shadow ${
                      unlocked ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white active:from-amber-500' : 'bg-stone-200 text-stone-500'
                    }`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/25 text-sm font-bold">{unlocked ? i + 1 : '🔒'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold">{l.title}</span>
                      <span className="block text-[11px] opacity-90">
                        {unlocked ? `${l.rounds.length} 圈 · ${stitches} 针 · 收尾 ${countProduced(l.rounds[l.rounds.length - 1])} 针` : '通关上一关解锁'}
                      </span>
                    </span>
                    {unlocked && <Stars n={bestStars[l.id] ?? 0} className="shrink-0 text-base" />}
                  </button>
                </li>
              )
            })}
          </ol>
        </section>

        <button
          type="button"
          onClick={() => openWorks()}
          data-testid="open-works"
          className="lift min-h-[60px] rounded-2xl bg-white px-6 text-lg font-semibold text-amber-950 shadow-lg ring-1 ring-amber-200 active:bg-amber-50"
        >
          我的作品 · 自由沙盒 <span className="text-sm font-normal text-amber-700">（{works} 份）</span>
        </button>

        <section aria-labelledby="my-levels-title" className="rounded-xl bg-white/60 p-3 ring-1 ring-amber-200">
          <h2 id="my-levels-title" className="mb-2 font-semibold text-amber-950">
            我的关卡
          </h2>
          {customLevels.length === 0 ? (
            <p className="text-xs text-amber-800/80">在「我的作品」里点「存为关卡」，或在下面粘贴图解保存，就会出现在这里，可反复闯关、记录最好成绩。</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {customLevels.map((l) => (
                <CustomLevelRow key={l.id} l={l} />
              ))}
            </ul>
          )}
          <details className="mt-2">
            <summary className="cursor-pointer text-sm font-medium text-amber-900">📜 粘贴图解（X/V/A 或 sc/inc/dec）</summary>
            <PatternToLevel />
          </details>
        </section>

        <div className="flex items-center justify-center gap-2 text-xs text-amber-900/80">
          图解写法 <NotationToggle />
        </div>
      </div>
      <section className="mt-6 w-full max-w-sm rounded-xl bg-white/70 p-3 text-xs text-amber-950 ring-1 ring-amber-200">
        <p className="mb-1 font-semibold">针法速查</p>
        <ul className="space-y-0.5">
          {(['sc', 'inc', 'dec', 'ch'] as StitchType[]).map((t) => (
            <li key={t}>
              <b className="inline-block w-14 font-mono">
                {STITCH_LABELS[t].symbolZh} / {STITCH_LABELS[t].symbolEn}
              </b>
              {STITCH_LABELS[t].zh}：{STITCH_LABELS[t].tipZh}
            </li>
          ))}
        </ul>
      </section>
      <p className="mt-6 max-w-xs text-center text-[11px] text-amber-900/60">进度、作品与关卡只保存在本机浏览器（localStorage），无需登录。</p>
    </div>
  )
}
