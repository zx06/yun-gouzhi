import { CanvasArea } from './components/CanvasArea'
import { MuteButton } from './components/ViewToggle'
import { StitchToolbar } from './components/StitchToolbar'
import { SandboxPanel } from './components/SandboxPanel'
import { LevelPanel } from './components/LevelPanel'
import { CompletionCelebration } from './components/CompletionCelebration'
import { MenuScreen } from './components/MenuScreen'
import { WorksScreen } from './components/WorksScreen'
import { NotationToggle } from './components/NotationToggle'
import { useCrochetStore } from './store/crochetStore'

function GameScreen() {
  const mode = useCrochetStore((s) => s.mode)
  const level = useCrochetStore((s) => s.level)
  const goMenu = useCrochetStore((s) => s.goMenu)
  const openWorks = useCrochetStore((s) => s.openWorks)
  const completed = useCrochetStore((s) => s.completed)
  const workName = useCrochetStore((s) => s.data.works.find((w) => w.id === s.workId)?.name)

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-amber-50/90 px-3 py-2 backdrop-blur">
        <button
          type="button"
          onClick={() => (mode === 'sandbox' ? openWorks() : goMenu())}
          className="min-h-[40px] shrink-0 rounded-lg px-2 text-sm font-medium text-amber-900 active:bg-amber-100"
        >
          {mode === 'sandbox' ? '← 我的作品' : '← 菜单'}
        </button>
        <h1 className="truncate text-base font-semibold text-amber-950" data-testid="game-title">
          {mode === 'level' ? level?.title : (workName ?? '自由沙盒')}
        </h1>
        <div className="flex shrink-0 items-center gap-1.5">
          <MuteButton />
          <NotationToggle />
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-3 px-3 pb-8 pt-2 md:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-3">
          <CanvasArea />
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
  if (mode === 'menu') return <MenuScreen />
  if (mode === 'works') return <WorksScreen />
  return <GameScreen />
}
