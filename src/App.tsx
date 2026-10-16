import { CrochetCanvas } from './components/CrochetCanvas'
import { StitchToolbar } from './components/StitchToolbar'
import { SandboxPanel } from './components/SandboxPanel'
import { LevelPanel } from './components/LevelPanel'
import { CompletionCelebration } from './components/CompletionCelebration'
import { useCrochetStore } from './store/crochetStore'
import { COASTER_LEVEL } from './patterns/levels'
import { STITCH_LABELS, type StitchType } from './types/stitch'

function NotationToggle() {
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

function MenuScreen() {
  const startLevel = useCrochetStore((s) => s.startLevel)
  const startSandbox = useCrochetStore((s) => s.startSandbox)
  const best = useCrochetStore((s) => s.bestStars[COASTER_LEVEL.id] ?? 0)

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-8">
      <header className="mb-6 text-center">
        <div className="text-5xl" aria-hidden>
          🧶
        </div>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-amber-950">云钩织</h1>
        <p className="mt-1 text-sm text-amber-800/90">拿起虚拟钩针，跟着图解一针一针钩</p>
      </header>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          type="button"
          onClick={() => startLevel()}
          className="min-h-[60px] rounded-2xl bg-amber-500 px-6 text-lg font-semibold text-white shadow-lg active:bg-amber-600"
        >
          教程关 · 杯垫
          <span className="ml-2 text-base tracking-wider">
            {'★'.repeat(best)}
            <span className="opacity-40">{'★'.repeat(3 - best)}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => startSandbox()}
          className="min-h-[60px] rounded-2xl bg-white px-6 text-lg font-semibold text-amber-950 shadow-lg ring-1 ring-amber-200 active:bg-amber-50"
        >
          自由沙盒
        </button>
        <div className="mt-1 flex items-center justify-center gap-2 text-xs text-amber-900/80">
          图解写法 <NotationToggle />
        </div>
      </div>
      <section className="mt-8 w-full max-w-xs rounded-xl bg-white/70 p-3 text-xs text-amber-950 ring-1 ring-amber-200">
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
      <p className="mt-6 max-w-xs text-center text-[11px] text-amber-900/60">进度与作品只保存在本机浏览器（localStorage），无需登录。</p>
    </div>
  )
}

function GameScreen() {
  const mode = useCrochetStore((s) => s.mode)
  const level = useCrochetStore((s) => s.level)
  const goMenu = useCrochetStore((s) => s.goMenu)
  const completed = useCrochetStore((s) => s.completed)

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-amber-50/90 px-3 py-2 backdrop-blur">
        <button type="button" onClick={() => goMenu()} className="min-h-[40px] rounded-lg px-2 text-sm font-medium text-amber-900 active:bg-amber-100">
          ← 菜单
        </button>
        <h1 className="truncate text-base font-semibold text-amber-950">{mode === 'level' ? level?.title : '自由沙盒'}</h1>
        <NotationToggle />
      </header>
      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-3 px-3 pb-8 pt-2 md:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-3">
          <CrochetCanvas />
          {mode === 'level' && level && <p className="text-center text-xs text-amber-800/90">{level.description}</p>}
        </div>
        <div className="flex flex-col gap-3">
          <StitchToolbar />
          {mode === 'level' ? <LevelPanel /> : <SandboxPanel />}
        </div>
      </main>
      {completed && mode === 'level' && <CompletionCelebration />}
    </div>
  )
}

export default function App() {
  const mode = useCrochetStore((s) => s.mode)
  return mode === 'menu' ? <MenuScreen /> : <GameScreen />
}
