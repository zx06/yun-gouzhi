import { useCrochetStore } from '../store/crochetStore'
import { finishedRounds } from './engine'
import { formatPattern } from './pattern'

function download(filename: string, href: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function buildProjectJson() {
  const { work, yarnColor, mode, level } = useCrochetStore.getState()
  const rounds = finishedRounds(work)
  const closedRounds = work.rounds.slice(0, -1)
  const inProgress = work.rounds[work.rounds.length - 1]
  return {
    app: 'yun-gouzhi',
    version: 2,
    mode,
    levelId: level?.id ?? null,
    yarnColor,
    rounds,
    closedRounds: closedRounds.length,
    inProgressRound: inProgress.length ? inProgress : null,
    patternZh: formatPattern(closedRounds, 'zh'),
    patternEn: formatPattern(closedRounds, 'en'),
    exportedAt: new Date().toISOString(),
  }
}

export function exportProjectJson() {
  const blob = new Blob([JSON.stringify(buildProjectJson(), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  download(`yun-gouzhi-${Date.now()}.json`, url)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportCanvasPng() {
  const app = useCrochetStore.getState().rendererRef.current
  if (!app) return
  const url = await app.renderer.extract.base64({ target: app.stage, format: 'png' })
  download(`yun-gouzhi-${Date.now()}.png`, url)
}
