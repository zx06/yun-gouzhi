import type { StitchType } from '../types/stitch'
import { STITCH_LABELS } from '../types/stitch'

export function actionsToPatternEn(actions: StitchType[]): string {
  return compressPattern(actions, 'en')
}

export function actionsToPatternZh(actions: StitchType[]): string {
  return compressPattern(actions, 'zh')
}

function compressPattern(actions: StitchType[], lang: 'en' | 'zh'): string {
  const lines: string[] = []
  let i = 0
  let round = 1
  lines.push(lang === 'zh' ? `第 ${round} 圈：` : `Rnd ${round}:`)

  while (i < actions.length) {
    const run = runLength(actions, i)
    const seg = formatRun(actions[i], run, lang)
    lines[lines.length - 1] += (lines[lines.length - 1].endsWith(':') ? ' ' : ', ') + seg
    i += run
    if (i < actions.length && shouldBreakRound(actions, i)) {
      round++
      lines.push(lang === 'zh' ? `第 ${round} 圈：` : `Rnd ${round}:`)
    }
  }

  const header =
    lang === 'zh'
      ? '--- 云钩织 · 图解 ---\n'
      : '--- Cloud Crochet · Pattern ---\n'
  return header + lines.join('\n')
}

function runLength(actions: StitchType[], start: number): number {
  const t = actions[start]
  let n = 1
  while (start + n < actions.length && actions[start + n] === t) n++
  return n
}

function formatRun(type: StitchType, count: number, lang: 'en' | 'zh'): string {
  const sym = lang === 'en' ? STITCH_LABELS[type].symbolEn : STITCH_LABELS[type].symbolZh
  if (count === 1) return sym
  if (lang === 'en') return `${count}${sym}`
  return `${sym}×${count}`
}

/** Heuristic round breaks for sandbox (every 6*round actions in classic circle) */
function shouldBreakRound(_actions: StitchType[], index: number): boolean {
  if (index === 6 || index === 12 || index === 18 || index === 24 || index === 48) return true
  return false
}

export function exportJsonPayload(
  actions: StitchType[],
  stitches: { type: StitchType; x: number; y: number; round: number }[],
  yarnColor: string,
  mode: string,
) {
  return {
    app: 'yun-gouzhi',
    version: 1,
    mode,
    yarnColor,
    actions,
    stitches,
    patternEn: actionsToPatternEn(actions),
    patternZh: actionsToPatternZh(actions),
    exportedAt: new Date().toISOString(),
  }
}
