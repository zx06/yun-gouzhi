import { useRef, useState } from 'react'
import { useCrochetStore } from '../store/crochetStore'
import { closedRounds, type SavedWork } from '../lib/storage'
import { countProduced } from '../lib/pattern'
import { exportSavedWork } from '../lib/export'
import { Crochet3D } from './Crochet3D'
import { currentColor } from '../lib/colors'

function fmtTime(ts: number) {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function Preview3D({ w, onClose }: { w: SavedWork; onClose: () => void }) {
  const webgl = useCrochetStore((s) => s.webgl)
  const [failed, setFailed] = useState<string | null>(null)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" role="dialog" aria-label={`${w.name} 立体预览`} onClick={onClose}>
      <div className="animate-rise w-full max-w-md rounded-2xl bg-white p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="truncate font-semibold text-amber-950">{w.name} · 3D</h2>
          <button type="button" onClick={onClose} className="min-h-[36px] rounded-lg px-3 text-sm font-medium text-amber-900 ring-1 ring-amber-300">
            关闭
          </button>
        </div>
        {webgl && !failed ? (
          <Crochet3D rounds={w.rounds} base={w.yarnColor} changes={w.colors ?? []} onFail={setFailed} className="aspect-square w-full rounded-xl ring-1 ring-amber-200" label={`${w.name} 立体预览`} />
        ) : (
          <p className="rounded-xl bg-amber-50 p-6 text-center text-sm text-amber-800">{failed ? `3D 视图打不开（${failed}）` : '这台设备不支持 WebGL，无法显示 3D 预览'}</p>
        )}
        <p className="mt-2 text-center text-[11px] text-amber-800/80">拖动旋转 · 双指/滚轮缩放</p>
      </div>
    </div>
  )
}

function WorkCard({ w }: { w: SavedWork }) {
  const startSandbox = useCrochetStore((s) => s.startSandbox)
  const renameWork = useCrochetStore((s) => s.renameWork)
  const duplicateWork = useCrochetStore((s) => s.duplicateWork)
  const deleteWork = useCrochetStore((s) => s.deleteWork)
  const saveWorkAsLevel = useCrochetStore((s) => s.saveWorkAsLevel)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(w.name)
  const [confirmDel, setConfirmDel] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [preview, setPreview] = useState(false)
  const closed = closedRounds(w.rounds)
  const total = w.rounds.reduce((n, r) => n + r.length, 0)
  const last = closed.length ? countProduced(closed[closed.length - 1]) : 0
  const btn = 'min-h-[40px] rounded-lg px-2 text-xs font-medium ring-1'

  return (
    <li className="rounded-xl bg-white/90 p-3 ring-1 ring-amber-200" data-testid="work-card">
      <div className="flex items-center gap-2">
        <span
          className="h-5 w-5 shrink-0 rounded-full ring-1 ring-black/10"
          style={{ background: w.colors?.length ? `conic-gradient(${[w.yarnColor, ...w.colors.map((c) => c.color)].join(',')})` : w.yarnColor }}
          aria-hidden
          title={w.colors?.length ? `换线 ${w.colors.length} 次，当前 ${currentColor(w.yarnColor, w.colors)}` : undefined}
        />
        {editing ? (
          <form
            className="flex flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              renameWork(w.id, name)
              setEditing(false)
            }}
          >
            <input
              autoFocus
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              aria-label="作品名"
              className="min-w-0 flex-1 rounded-lg border border-amber-300 px-2 py-1 text-sm"
            />
            <button type="submit" className={`${btn} bg-amber-500 text-white ring-amber-500`}>
              保存
            </button>
          </form>
        ) : (
          <h3 className="flex-1 truncate font-semibold text-amber-950" data-testid="work-name">
            {w.name}
          </h3>
        )}
      </div>
      <p className="mt-1 text-xs text-amber-800/80">
        已完成 {closed.length} 圈{last ? `（最后一圈 ${last} 针）` : ''} · 共 {total} 针 · {fmtTime(w.updatedAt)}
      </p>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        <button type="button" onClick={() => startSandbox(w.id)} className={`${btn} bg-amber-500 text-white ring-amber-500`}>
          继续钩
        </button>
        <button type="button" onClick={() => setPreview(true)} data-testid="preview-3d" className={`${btn} bg-gradient-to-br from-sky-500 to-indigo-500 text-white ring-indigo-400`}>
          3D 预览
        </button>
        <button
          type="button"
          onClick={() => {
            setName(w.name)
            setEditing((v) => !v)
          }}
          className={`${btn} bg-white text-amber-900 ring-amber-300`}
        >
          重命名
        </button>
        <button type="button" onClick={() => duplicateWork(w.id)} className={`${btn} bg-white text-amber-900 ring-amber-300`}>
          复制
        </button>
        <button type="button" onClick={() => exportSavedWork(w)} className={`${btn} bg-white text-violet-800 ring-violet-300`}>
          导出 JSON
        </button>
        <button
          type="button"
          onClick={() => {
            const res = saveWorkAsLevel(w.id)
            setMsg(res.error ? { text: res.error, ok: false } : { text: `已存为关卡「${res.level?.title}」`, ok: true })
          }}
          className={`${btn} bg-white text-emerald-800 ring-emerald-300`}
        >
          存为关卡
        </button>
        {confirmDel ? (
          <button type="button" onClick={() => deleteWork(w.id)} className={`${btn} bg-rose-600 text-white ring-rose-600`}>
            确认删除
          </button>
        ) : (
          <button type="button" onClick={() => {
              setConfirmDel(true)
              setTimeout(() => setConfirmDel(false), 4000)
            }} className={`${btn} bg-white text-rose-700 ring-rose-300`}>
            删除
          </button>
        )}
      </div>
      {msg && <p className={`mt-1 text-xs ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</p>}
      {preview && <Preview3D w={w} onClose={() => setPreview(false)} />}
    </li>
  )
}

export function WorksScreen() {
  const works = useCrochetStore((s) => s.data.works)
  const goMenu = useCrochetStore((s) => s.goMenu)
  const newWork = useCrochetStore((s) => s.newWork)
  const importWorkJson = useCrochetStore((s) => s.importWorkJson)
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-amber-50/90 px-3 py-2 backdrop-blur">
        <button type="button" onClick={() => goMenu()} className="min-h-[40px] rounded-lg px-2 text-sm font-medium text-amber-900 active:bg-amber-100">
          ← 菜单
        </button>
        <h1 className="text-base font-semibold text-amber-950">我的作品</h1>
        <span className="w-14 text-right text-xs text-amber-800">{works.length} 份</span>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-3 pb-8 pt-2">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => newWork()} className="min-h-[52px] rounded-2xl bg-amber-500 font-semibold text-white shadow active:bg-amber-600">
            ＋ 新作品
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="min-h-[52px] rounded-2xl bg-white font-semibold text-amber-950 shadow ring-1 ring-amber-200 active:bg-amber-50"
          >
            导入 JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            data-testid="import-file"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              if (f.size > 1_000_000) return setMsg({ text: '文件太大（超过 1MB）', ok: false })
              const err = importWorkJson(await f.text())
              setMsg(err ? { text: `导入失败：${err}`, ok: false } : { text: `已导入「${f.name}」`, ok: true })
            }}
          />
        </div>
        {msg && (
          <p className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`} role="status" data-testid="works-msg">
            {msg.text}
          </p>
        )}
        {works.length === 0 ? (
          <p className="rounded-xl bg-white/70 p-4 text-center text-sm text-amber-800 ring-1 ring-amber-200">还没有作品。点「新作品」开始自由钩，作品会自动保存在本机。</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {works.map((w) => (
              <WorkCard key={w.id} w={w} />
            ))}
          </ul>
        )}
        <p className="text-center text-[11px] text-amber-900/60">作品只保存在本机浏览器（localStorage）。清除浏览器数据前，请先「导出 JSON」备份。</p>
      </main>
    </div>
  )
}
