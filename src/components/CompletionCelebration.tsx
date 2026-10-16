export function CompletionCelebration({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-labelledby="celebrate-title"
    >
      <div className="max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl ring-1 ring-amber-200">
        <p className="text-4xl" aria-hidden>
          🎉
        </p>
        <h2 id="celebrate-title" className="mt-2 text-xl font-bold text-amber-950">
          杯垫完成！
        </h2>
        <p className="mt-1 text-sm text-amber-900/80">Coaster complete — great job!</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 min-h-[44px] w-full rounded-xl bg-amber-500 font-semibold text-white active:bg-amber-600"
        >
          返回菜单 · Menu
        </button>
      </div>
    </div>
  )
}
