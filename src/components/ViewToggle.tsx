import { useCrochetStore } from '../store/crochetStore'

export function ViewToggle() {
  const view = useCrochetStore((s) => s.view)
  const setView = useCrochetStore((s) => s.setView)
  const webgl = useCrochetStore((s) => s.webgl)
  return (
    <div className="inline-flex rounded-full bg-white/85 p-0.5 text-xs shadow-sm ring-1 ring-amber-200 backdrop-blur" role="group" aria-label="视图">
      {(['3d', '2d'] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          disabled={v === '3d' && !webgl}
          onClick={() => setView(v)}
          data-testid={`view-toggle-${v}`}
          className={`min-h-[32px] min-w-[44px] rounded-full px-3 font-semibold transition ${
            view === v ? 'bg-amber-500 text-white shadow' : 'text-amber-900 disabled:opacity-40'
          }`}
        >
          {v === '3d' ? '3D 立体' : '2D 平面'}
        </button>
      ))}
    </div>
  )
}

export function MuteButton() {
  const muted = useCrochetStore((s) => s.settings.muted)
  const toggleMute = useCrochetStore((s) => s.toggleMute)
  return (
    <button
      type="button"
      onClick={() => toggleMute()}
      aria-pressed={muted}
      aria-label={muted ? '打开音效' : '静音'}
      title={muted ? '打开音效' : '静音'}
      data-testid="mute-toggle"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80 text-base shadow-sm ring-1 ring-amber-200 transition active:scale-90"
    >
      {muted ? '🔇' : '🔊'}
    </button>
  )
}
