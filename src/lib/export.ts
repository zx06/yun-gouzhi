import { useCrochetStore } from '../store/crochetStore'
import { exportJsonPayload } from './patternText'

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportProjectJson() {
  const { actions, stitches, yarnColor, mode } = useCrochetStore.getState()
  const payload = exportJsonPayload(
    actions,
    stitches.map(({ type, x, y, round }) => ({ type, x, y, round })),
    yarnColor,
    mode,
  )
  downloadJson(`yun-gouzhi-${Date.now()}.json`, payload)
}

export function exportCanvasPng() {
  const app = useCrochetStore.getState().rendererRef.current
  if (!app) return
  const canvas = app.canvas
  const link = document.createElement('a')
  link.download = `yun-gouzhi-${Date.now()}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}
