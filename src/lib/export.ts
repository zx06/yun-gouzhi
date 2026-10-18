import { useCrochetStore } from '../store/crochetStore'
import { buildWorkExport, type SavedWork } from './storage'

function download(filename: string, href: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function safeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40) || 'work'
}

/** 当前画布上的作品（沙盒里是正在钩的作品，关卡里是当前进度）。 */
export function buildProjectJson() {
  const { work, baseColor, colorChanges, data, workId, level } = useCrochetStore.getState()
  const saved = data.works.find((w) => w.id === workId)
  return buildWorkExport({ name: saved?.name ?? level?.title ?? '云钩织作品', yarnColor: baseColor, colors: colorChanges, rounds: work.rounds })
}

export function downloadJson(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  download(filename, url)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportProjectJson() {
  const obj = buildProjectJson()
  downloadJson(obj, `yun-gouzhi-${safeFileName(obj.name)}-${Date.now()}.json`)
}

export function exportSavedWork(w: SavedWork) {
  downloadJson(buildWorkExport(w), `yun-gouzhi-${safeFileName(w.name)}-${Date.now()}.json`)
}

export async function exportCanvasPng() {
  const take = useCrochetStore.getState().snapshotRef.current
  if (!take) return
  const url = await take()
  download(`yun-gouzhi-${Date.now()}.png`, url)
}
