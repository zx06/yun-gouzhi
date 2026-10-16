import { create } from 'zustand'
import { applyStitch, closeRing, emptyWork, isValidWork, type Work } from '../lib/engine'
import { countProduced } from '../lib/pattern'
import { stitchSymbol, STITCH_LABELS, type Notation, type StitchType } from '../types/stitch'
import { COASTER_LEVEL, BALL_PATTERN, type Level } from '../patterns/levels'
import type { Application } from 'pixi.js'

export type GameMode = 'menu' | 'level' | 'sandbox'

const PREFS_KEY = 'yun-gouzhi-prefs-v2'
const SANDBOX_KEY = 'yun-gouzhi-sandbox-v2'

interface Prefs {
  yarnColor: string
  notation: Notation
  customPattern: string
  bestStars: Record<string, number>
}

const defaultPrefs: Prefs = {
  yarnColor: '#e11d48',
  notation: 'zh',
  customPattern: BALL_PATTERN,
  bestStars: {},
}

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* quota / private mode */
  }
}

function loadPrefs(): Prefs {
  return { ...defaultPrefs, ...(load<Partial<Prefs>>(PREFS_KEY) ?? {}) }
}

function loadSandbox(): Work {
  const w = load<unknown>(SANDBOX_KEY)
  return isValidWork(w) ? w : emptyWork()
}

export function starsFor(mistakes: number): number {
  return mistakes === 0 ? 3 : mistakes <= 3 ? 2 : 1
}

interface CrochetState extends Prefs {
  mode: GameMode
  level: Level | null
  work: Work
  undoStack: Work[]
  hint: string | null
  hintKind: 'error' | 'info'
  mistakes: number
  completed: boolean
  /** increments on every successful stitch, used to trigger animations */
  tick: number
  rendererRef: { current: Application | null }

  goMenu: () => void
  startLevel: (level?: Level) => void
  startSandbox: () => void
  setYarnColor: (c: string) => void
  setNotation: (n: Notation) => void
  setCustomPattern: (t: string) => void
  placeStitch: (t: StitchType) => void
  closeMagicRing: () => void
  undo: () => void
  clearSandbox: () => void
  expected: () => StitchType | null
}

function persistPrefs(s: Prefs) {
  save(PREFS_KEY, {
    yarnColor: s.yarnColor,
    notation: s.notation,
    customPattern: s.customPattern,
    bestStars: s.bestStars,
  })
}

const initial = loadPrefs()

export const useCrochetStore = create<CrochetState>((set, get) => ({
  ...initial,
  mode: 'menu',
  level: null,
  work: emptyWork(),
  undoStack: [],
  hint: null,
  hintKind: 'info',
  mistakes: 0,
  completed: false,
  tick: 0,
  rendererRef: { current: null },

  goMenu: () => set({ mode: 'menu', level: null, hint: null, completed: false }),

  startLevel: (level = COASTER_LEVEL) =>
    set({
      mode: 'level',
      level,
      work: emptyWork(),
      undoStack: [],
      hint: null,
      mistakes: 0,
      completed: false,
    }),

  startSandbox: () =>
    set({
      mode: 'sandbox',
      level: null,
      work: loadSandbox(),
      undoStack: [],
      hint: null,
      mistakes: 0,
      completed: false,
    }),

  setYarnColor: (yarnColor) => {
    set({ yarnColor })
    persistPrefs(get())
  },
  setNotation: (notation) => {
    set({ notation })
    persistPrefs(get())
  },
  setCustomPattern: (customPattern) => {
    set({ customPattern })
    persistPrefs(get())
  },

  expected: () => {
    const { level, work, completed } = get()
    if (!level || completed) return null
    const k = work.rounds.length - 1
    return level.rounds[k]?.[work.rounds[k].length] ?? null
  },

  placeStitch: (type) => {
    const s = get()
    if (s.mode === 'menu' || s.completed) return
    const n = s.notation
    if (s.mode === 'level' && s.level) {
      const exp = s.expected()
      if (exp && type !== exp) {
        const k = s.work.rounds.length - 1
        const j = s.work.rounds[k].length + 1
        set({
          hint: `第 ${k + 1} 圈第 ${j} 针应该钩 ${stitchSymbol(exp, n)} ${STITCH_LABELS[exp].zh}，你选了 ${stitchSymbol(type, n)} ${STITCH_LABELS[type].zh}`,
          hintKind: 'error',
          mistakes: s.mistakes + 1,
        })
        return
      }
    }
    const ringSize =
      s.mode === 'level' && s.level ? countProduced(s.level.rounds[0]) : undefined
    const res = applyStitch(s.work, type, { ringSize })
    if (res.error) {
      set({ hint: res.error, hintKind: 'error' })
      return
    }
    let work = res.work
    let completed = false
    let hint: string | null = null
    if (res.roundClosed) {
      const done = work.rounds.length - 1
      hint = `第 ${done} 圈完成！`
    }
    if (s.mode === 'level' && s.level && work.rounds.length - 1 >= s.level.rounds.length) {
      work = { rounds: work.rounds.slice(0, s.level.rounds.length) }
      completed = true
      const stars = starsFor(s.mistakes)
      const prev = s.bestStars[s.level.id] ?? 0
      if (stars > prev) {
        set({ bestStars: { ...s.bestStars, [s.level.id]: stars } })
      }
    }
    set({
      work,
      undoStack: [...s.undoStack.slice(-499), s.work],
      hint,
      hintKind: 'info',
      completed,
      tick: s.tick + 1,
    })
    if (completed) persistPrefs(get())
    if (s.mode === 'sandbox') save(SANDBOX_KEY, work)
  },

  closeMagicRing: () => {
    const s = get()
    if (s.mode !== 'sandbox') return
    const res = closeRing(s.work)
    if (res.error) return set({ hint: res.error, hintKind: 'error' })
    set({ work: res.work, undoStack: [...s.undoStack, s.work], hint: '魔术环已闭合，开始第 2 圈', hintKind: 'info', tick: s.tick + 1 })
    save(SANDBOX_KEY, res.work)
  },

  undo: () => {
    const s = get()
    const prev = s.undoStack[s.undoStack.length - 1]
    if (!prev) return
    set({ work: prev, undoStack: s.undoStack.slice(0, -1), hint: '已撤销一针', hintKind: 'info', completed: false, tick: s.tick + 1 })
    if (s.mode === 'sandbox') save(SANDBOX_KEY, prev)
  },

  clearSandbox: () => {
    const s = get()
    if (s.mode !== 'sandbox') return
    set({ work: emptyWork(), undoStack: [...s.undoStack, s.work], hint: '画布已清空（可撤销）', hintKind: 'info', tick: s.tick + 1 })
    save(SANDBOX_KEY, emptyWork())
  },
}))
