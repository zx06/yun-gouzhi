import { create } from 'zustand'
import { COASTER_TUTORIAL } from '../patterns/coasterTutorial'
import {
  advancePlacement,
  computeStitchPositions,
  initialPlacement,
  type PlacementState,
} from '../lib/geometry'
import type { PlacedStitch, StitchType } from '../types/stitch'

export type GameMode = 'menu' | 'tutorial' | 'sandbox'

const STORAGE_KEY = 'yun-gouzhi-prefs'

interface Prefs {
  yarnColor: string
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Prefs
  } catch {
    /* ignore */
  }
  return { yarnColor: '#e11d48' }
}

function savePrefs(prefs: Prefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}

interface CrochetState {
  mode: GameMode
  yarnColor: string
  stitches: PlacedStitch[]
  actions: StitchType[]
  placement: PlacementState
  undoStack: { stitches: PlacedStitch[]; actions: StitchType[]; placement: PlacementState }[]
  tutorialStep: number
  wrongHint: string | null
  completed: boolean
  popTick: number
  rendererRef: { current: import('pixi.js').Application | null }

  setRenderer: (app: import('pixi.js').Application | null) => void
  goMenu: () => void
  startTutorial: () => void
  startSandbox: () => void
  setYarnColor: (color: string) => void
  placeStitch: (type: StitchType) => void
  undo: () => void
  clearSandbox: () => void
  tickPop: () => void
}

function resetSession(mode: GameMode): Pick<
  CrochetState,
  | 'mode'
  | 'stitches'
  | 'actions'
  | 'placement'
  | 'undoStack'
  | 'tutorialStep'
  | 'wrongHint'
  | 'completed'
> {
  return {
    mode,
    stitches: [],
    actions: [],
    placement: initialPlacement(),
    undoStack: [],
    tutorialStep: 0,
    wrongHint: null,
    completed: false,
  }
}

export const useCrochetStore = create<CrochetState>((set, get) => ({
  mode: 'menu',
  yarnColor: loadPrefs().yarnColor,
  stitches: [],
  actions: [],
  placement: initialPlacement(),
  undoStack: [],
  tutorialStep: 0,
  wrongHint: null,
  completed: false,
  popTick: 0,
  rendererRef: { current: null },

  setRenderer: (app) => {
    get().rendererRef.current = app
  },

  goMenu: () => set({ ...resetSession('menu'), mode: 'menu' }),

  startTutorial: () =>
    set({
      ...resetSession('tutorial'),
      mode: 'tutorial',
    }),

  startSandbox: () =>
    set({
      ...resetSession('sandbox'),
      mode: 'sandbox',
    }),

  setYarnColor: (color) => {
    savePrefs({ yarnColor: color })
    set({ yarnColor: color })
  },

  placeStitch: (type) => {
    const state = get()
    if (state.mode !== 'tutorial' && state.mode !== 'sandbox') return
    if (state.completed) return

    if (state.mode === 'tutorial') {
      const expected = COASTER_TUTORIAL.sequence[state.tutorialStep]
      if (type !== expected) {
        const hint =
          expected === 'sc'
            ? '这里应钩短针 (X / sc)'
            : expected === 'inc'
              ? '这里应加针 (V / inc)'
              : expected === 'dec'
                ? '这里应减针 (A / dec)'
                : '这里应钩锁针 (O / ch)'
        set({ wrongHint: hint })
        return
      }
      set({ wrongHint: null })
    }

    const snapshot = {
      stitches: state.stitches.map((s) => ({ ...s })),
      actions: [...state.actions],
      placement: { ...state.placement },
    }

    const newPieces = computeStitchPositions(type, state.placement, `${Date.now()}`)
    const newStitches = [...state.stitches, ...newPieces.map((s) => ({ ...s, pop: 0 }))]
    const boundaries =
      state.mode === 'tutorial' ? COASTER_TUTORIAL.roundBoundaries : undefined
    const newPlacement = advancePlacement(state.placement, type, boundaries)
    const newActions = [...state.actions, type]
    const nextStep = state.tutorialStep + 1
    const done =
      state.mode === 'tutorial' && nextStep >= COASTER_TUTORIAL.sequence.length

    set({
      stitches: newStitches,
      actions: newActions,
      placement: newPlacement,
      undoStack: [...state.undoStack, snapshot],
      tutorialStep: nextStep,
      completed: done,
      popTick: state.popTick + 1,
    })
  },

  undo: () => {
    const state = get()
    const prev = state.undoStack[state.undoStack.length - 1]
    if (!prev) return
    set({
      stitches: prev.stitches,
      actions: prev.actions,
      placement: prev.placement,
      undoStack: state.undoStack.slice(0, -1),
      tutorialStep: Math.max(0, state.tutorialStep - 1),
      wrongHint: null,
      completed: false,
      popTick: state.popTick + 1,
    })
  },

  clearSandbox: () => {
    if (get().mode !== 'sandbox') return
    set({
      ...resetSession('sandbox'),
      mode: 'sandbox',
    })
  },

  tickPop: () => {
    set((s) => {
      let changed = false
      const stitches = s.stitches.map((st) => {
        if (st.pop === undefined || st.pop >= 1) return st
        changed = true
        return { ...st, pop: Math.min(1, (st.pop ?? 0) + 0.12) }
      })
      return changed ? { stitches } : s
    })
  },
}))
