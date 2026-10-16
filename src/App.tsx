import { COASTER_TUTORIAL } from './patterns/coasterTutorial'
import { CrochetCanvas } from './components/CrochetCanvas'
import { StitchToolbar } from './components/StitchToolbar'
import { SandboxPanel } from './components/SandboxPanel'
import { CompletionCelebration } from './components/CompletionCelebration'
import { useCrochetStore } from './store/crochetStore'

function MenuScreen() {
  const startTutorial = useCrochetStore((s) => s.startTutorial)
  const startSandbox = useCrochetStore((s) => s.startSandbox)

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-amber-950 sm:text-4xl">云钩织</h1>
        <p className="mt-1 text-sm text-amber-800/90">Cloud Crochet · 螺旋圈织模拟</p>
      </header>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          type="button"
          onClick={() => startTutorial()}
          className="min-h-[52px] rounded-2xl bg-amber-500 px-6 text-lg font-semibold text-white shadow-lg active:bg-amber-600"
        >
          教程 L1 · 杯垫
        </button>
        <button
          type="button"
          onClick={() => startSandbox()}
          className="min-h-[52px] rounded-2xl bg-white px-6 text-lg font-semibold text-amber-950 shadow-lg ring-1 ring-amber-200 active:bg-amber-50"
        >
          自由沙盒 · Sandbox
        </button>
      </div>
      <p className="mt-8 max-w-md text-center text-xs text-amber-900/60">
        点击针法按钮逐针钩织，支持撤销与移动端触控。数据仅存于本机 localStorage。
      </p>
    </div>
  )
}

function GameScreen() {
  const mode = useCrochetStore((s) => s.mode)
  const goMenu = useCrochetStore((s) => s.goMenu)
  const completed = useCrochetStore((s) => s.completed)
  const tutorialStep = useCrochetStore((s) => s.tutorialStep)
  const total = COASTER_TUTORIAL.sequence.length

  return (
    <div className="flex min-h-full flex-col pb-safe">
      <header className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4">
        <button
          type="button"
          onClick={() => goMenu()}
          className="min-h-[44px] rounded-lg px-2 text-sm font-medium text-amber-900 active:bg-amber-100"
        >
          ← 菜单
        </button>
        <div className="text-center text-sm font-medium text-amber-950">
          {mode === 'tutorial' ? (
            <>
              {COASTER_TUTORIAL.titleZh}
              <span className="ml-2 text-amber-700">
                {tutorialStep}/{total}
              </span>
            </>
          ) : (
            '自由沙盒 · Sandbox'
          )}
        </div>
        <div className="w-14" aria-hidden />
      </header>

      {mode === 'tutorial' && (
        <p className="px-4 text-center text-xs text-amber-800/80">
          {COASTER_TUTORIAL.descriptionZh}
        </p>
      )}

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 px-3 pb-6 pt-1 sm:px-4">
        <CrochetCanvas />
        <StitchToolbar />
        {mode === 'sandbox' && <SandboxPanel />}
      </main>

      {completed && mode === 'tutorial' && <CompletionCelebration onClose={() => goMenu()} />}
    </div>
  )
}

export default function App() {
  const mode = useCrochetStore((s) => s.mode)

  if (mode === 'menu') return <MenuScreen />
  return <GameScreen />
}
