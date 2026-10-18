import { create } from 'zustand'
import { applyStitch, closeRing, emptyWork, type Work } from '../lib/engine'
import { countProduced } from '../lib/pattern'
import { stitchSymbol, STITCH_LABELS, type Notation, type StitchType } from '../types/stitch'
import { COASTER_LEVEL, BALL_PATTERN, type Level } from '../patterns/levels'
import { customLevelToLevel } from '../patterns/custom'
import * as S from '../lib/storage'
import { changeColor, currentColor, trimColorChanges, type ColorChange } from '../lib/colors'
import { loadSettings, resolveView, saveSettings, type Settings, type ViewMode } from '../lib/settings'
import { hasWebGL } from '../lib/webgl'
import { sound, type Sfx } from '../lib/sound'

export type GameMode = 'menu' | 'works' | 'level' | 'sandbox'

const PREFS_KEY = 'yun-gouzhi-prefs-v2'
/** 一期最早版本的偏好（只有毛线颜色） */
const PREFS_V1_KEY = 'yun-gouzhi-prefs'

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

function safeStorage(): S.KV {
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    /* blocked */
  }
  const mem = new Map<string, string>()
  return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) }
}

const kv = safeStorage()

function load(key: string): unknown {
  try {
    const raw = kv.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function save(key: string, v: unknown): boolean {
  try {
    kv.setItem(key, JSON.stringify(v))
    return true
  } catch {
    return false
  }
}

/** 偏好：逐字段校验，坏字段回落默认值。 */
export function sanitizePrefs(x: unknown, legacy?: unknown): Prefs {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>
  const l = (legacy && typeof legacy === 'object' ? legacy : {}) as Record<string, unknown>
  const color = [o.yarnColor, l.yarnColor].find((c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)) as string | undefined
  const bestStars: Record<string, number> = {}
  if (o.bestStars && typeof o.bestStars === 'object') {
    for (const [k, v] of Object.entries(o.bestStars as Record<string, unknown>)) {
      if (typeof v === 'number' && v >= 0 && v <= 3) bestStars[k] = Math.round(v)
    }
  }
  return {
    yarnColor: color ?? defaultPrefs.yarnColor,
    notation: o.notation === 'en' ? 'en' : 'zh',
    customPattern: typeof o.customPattern === 'string' ? o.customPattern.slice(0, 20000) : defaultPrefs.customPattern,
    bestStars,
  }
}

export function starsFor(mistakes: number): number {
  return mistakes === 0 ? 3 : mistakes <= 3 ? 2 : 1
}

/** 撤销栈的一项：作品 + 当时的换线状态 */
interface UndoEntry {
  work: Work
  base: string
  changes: ColorChange[]
}

const totalStitches = (w: Work) => w.rounds.reduce((n, r) => n + r.length, 0)

interface CrochetState extends Prefs {
  mode: GameMode
  /** 沙盒作品的起始颜色与换线记录（关卡里不用） */
  baseColor: string
  colorChanges: ColorChange[]
  settings: Settings
  /** 设备能否用 WebGL（3D 需要） */
  webgl: boolean
  /** 实际显示的视图 */
  view: ViewMode
  viewNotice: string | null
  /** 当前画布的截图函数（2D / 3D 各自注册），导出 PNG 用 */
  snapshotRef: { current: (() => Promise<string> | string) | null }
  /** 通关时触发 3D 转盘展示 */
  celebrateTick: number
  level: Level | null
  work: Work
  /** 沙盒里正在钩的作品 id */
  workId: string | null
  data: S.AppData
  /** 存档提示（迁移 / 备份 / 写入失败） */
  storageNotice: string | null
  undoStack: UndoEntry[]
  hint: string | null
  hintKind: 'error' | 'info'
  mistakes: number
  completed: boolean
  /** increments on every successful stitch, used to trigger animations */
  tick: number

  setView: (v: ViewMode) => void
  /** 3D 初始化失败 / 上下文丢失：本次切回 2D（不改用户的选择） */
  fail3D: (reason?: string) => void
  toggleMute: () => void
  goMenu: () => void
  openWorks: () => void
  startLevel: (level?: Level) => void
  /** 打开作品继续钩；无 id 时打开上次的作品或新建 */
  startSandbox: (id?: string) => void
  newWork: (name?: string) => void
  renameWork: (id: string, name: string) => void
  duplicateWork: (id: string) => void
  deleteWork: (id: string) => void
  importWorkJson: (text: string) => string | null
  saveWorkAsLevel: (id: string, title?: string) => { error: string | null; level: S.CustomLevel | null }
  savePatternAsLevel: (rounds: StitchType[][], title: string) => { error: string | null; level: S.CustomLevel | null }
  renameCustomLevel: (id: string, title: string) => void
  deleteCustomLevel: (id: string) => void
  startCustomLevel: (id: string) => void
  dismissNotice: () => void
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

const initialPrefs = sanitizePrefs(load(PREFS_KEY), load(PREFS_V1_KEY))
const initialSettings = loadSettings(kv)
const webglOk = typeof document !== 'undefined' && hasWebGL()
sound.muted = initialSettings.muted

const SFX_FOR: Record<StitchType, Sfx> = { sc: 'stitch', inc: 'inc', dec: 'dec', ch: 'ch' }
const loaded = S.loadData(kv, { yarnColor: initialPrefs.yarnColor })
let initialNotice: string | null = null
if (loaded.dirty && !S.saveData(kv, loaded.data)) initialNotice = '浏览器不允许保存（隐私模式或空间已满），作品只在本次打开期间有效。'
if (loaded.migratedWorks) initialNotice = '已把一期的沙盒存档迁移到「我的作品」。'
if (loaded.backupKey) initialNotice = `部分存档数据损坏，已跳过；原始数据备份在 localStorage「${loaded.backupKey}」。`

export const useCrochetStore = create<CrochetState>((set, get) => {
  /** 写入存档；失败时给出提示但不影响继续游戏 */
  const commit = (data: S.AppData) => {
    set({ data })
    if (!S.saveData(kv, data)) set({ storageNotice: '保存失败：浏览器存储空间已满或被禁用。建议先导出 JSON 备份作品。' })
  }

  /** 沙盒里的作品变化后写回 */
  const persistWork = (work: Work) => {
    const { workId, data, baseColor, colorChanges } = get()
    if (!workId) return
    commit(S.updateWork(data, workId, { rounds: work.rounds, yarnColor: baseColor, colors: colorChanges }))
  }

  const snap = (): UndoEntry => {
    const s = get()
    return { work: s.work, base: s.baseColor, changes: s.colorChanges }
  }

  const enterSandbox = (w: S.SavedWork, data: S.AppData) => {
    commit({ ...data, lastWorkId: w.id })
    set({
      mode: 'sandbox',
      level: null,
      workId: w.id,
      work: { rounds: w.rounds.map((r) => [...r]) },
      baseColor: w.yarnColor,
      colorChanges: w.colors ?? [],
      yarnColor: currentColor(w.yarnColor, w.colors ?? []),
      undoStack: [],
      hint: null,
      mistakes: 0,
      completed: false,
    })
  }

  return {
    ...initialPrefs,
    mode: 'menu',
    level: null,
    work: emptyWork(),
    workId: null,
    data: loaded.data,
    storageNotice: initialNotice,
    undoStack: [],
    hint: null,
    hintKind: 'info',
    mistakes: 0,
    completed: false,
    tick: 0,
    baseColor: initialPrefs.yarnColor,
    colorChanges: [],
    settings: initialSettings,
    webgl: webglOk,
    view: resolveView(initialSettings, webglOk),
    viewNotice: null,
    snapshotRef: { current: null },
    celebrateTick: 0,

    setView: (v) => {
      const s = get()
      if (v === '3d' && !s.webgl) return set({ viewNotice: '这台设备不支持 WebGL，只能用 2D 视图' })
      const settings = { ...s.settings, view: v }
      set({ settings, view: v, viewNotice: null })
      saveSettings(kv, settings)
    },
    fail3D: (reason) => {
      if (get().view !== '3d') return
      set({ view: '2d', viewNotice: `3D 视图打不开${reason ? `（${reason}）` : ''}，已切换到 2D` })
    },
    toggleMute: () => {
      const settings = { ...get().settings, muted: !get().settings.muted }
      sound.muted = settings.muted
      set({ settings })
      saveSettings(kv, settings)
      if (!settings.muted) sound.play('tap')
    },

    goMenu: () => set({ mode: 'menu', level: null, hint: null, completed: false, workId: null }),
    openWorks: () => set({ mode: 'works', level: null, hint: null, completed: false, workId: null }),

    startLevel: (level = COASTER_LEVEL) =>
      set((s) => ({
        mode: 'level',
        level,
        workId: null,
        baseColor: s.yarnColor,
        colorChanges: [],
        work: emptyWork(),
        undoStack: [],
        hint: null,
        mistakes: 0,
        completed: false,
      })),

    startCustomLevel: (id) => {
      const l = get().data.customLevels.find((x) => x.id === id)
      if (l) get().startLevel(customLevelToLevel(l))
    },

    startSandbox: (id) => {
      const { data } = get()
      const w = data.works.find((x) => x.id === (id ?? data.lastWorkId)) ?? (id ? undefined : data.works[0])
      if (w) return enterSandbox(w, data)
      get().newWork()
    },

    newWork: (name) => {
      const { data, yarnColor } = get()
      const res = S.createWork(data, name || `作品 ${data.works.length + 1}`, yarnColor)
      enterSandbox(res.work, res.data)
    },

    renameWork: (id, name) => commit(S.renameWork(get().data, id, name)),

    duplicateWork: (id) => commit(S.duplicateWork(get().data, id).data),

    deleteWork: (id) => commit(S.deleteWork(get().data, id)),

    importWorkJson: (text) => {
      const res = S.importWork(get().data, text)
      if (res.error) return res.error
      commit(res.data)
      return null
    },

    saveWorkAsLevel: (id, title) => {
      const { data } = get()
      const w = data.works.find((x) => x.id === id)
      if (!w) return { error: '找不到这个作品', level: null }
      const rounds = S.closedRounds(w.rounds)
      if (!rounds.length) return { error: '至少钩完 1 圈（闭合魔术环）才能存为关卡', level: null }
      const res = S.addCustomLevel(data, title || w.name, rounds, 'work')
      if (res.error) return { error: res.error, level: null }
      commit(res.data)
      return { error: null, level: res.level }
    },

    savePatternAsLevel: (rounds, title) => {
      const res = S.addCustomLevel(get().data, title, rounds, 'pattern')
      if (res.error) return { error: res.error, level: null }
      commit(res.data)
      return { error: null, level: res.level }
    },

    renameCustomLevel: (id, title) => commit(S.renameCustomLevel(get().data, id, title)),
    deleteCustomLevel: (id) => commit(S.deleteCustomLevel(get().data, id)),
    dismissNotice: () => set({ storageNotice: null }),

    setYarnColor: (yarnColor) => {
      set({ yarnColor })
      persistPrefs(get())
      const s = get()
      if (s.mode === 'sandbox') {
        // 换线：已钩的针保持原色，之后的针用新颜色
        const next = changeColor(s.baseColor, s.colorChanges, totalStitches(s.work), yarnColor)
        set({ baseColor: next.base, colorChanges: next.changes })
        persistWork(s.work)
      } else {
        set({ baseColor: yarnColor, colorChanges: [] })
      }
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
      if (s.mode === 'menu' || s.mode === 'works' || s.completed) return
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
          sound.play('error')
          return
        }
      }
      const ringSize = s.mode === 'level' && s.level ? countProduced(s.level.rounds[0]) : undefined
      const res = applyStitch(s.work, type, { ringSize })
      if (res.error) {
        set({ hint: res.error, hintKind: 'error' })
        sound.play('error')
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
        if (s.level.custom) {
          commit(S.recordCustomResult(get().data, s.level.id, stars, s.mistakes))
        } else {
          const prev = s.bestStars[s.level.id] ?? 0
          if (stars > prev) set({ bestStars: { ...s.bestStars, [s.level.id]: stars } })
        }
      }
      set({
        work,
        undoStack: [...s.undoStack.slice(-499), snap()],
        hint,
        hintKind: 'info',
        completed,
        tick: s.tick + 1,
        celebrateTick: completed ? s.celebrateTick + 1 : s.celebrateTick,
      })
      sound.play(completed ? 'win' : res.roundClosed ? 'round' : SFX_FOR[type])
      if (completed) persistPrefs(get())
      if (s.mode === 'sandbox') persistWork(work)
    },

    closeMagicRing: () => {
      const s = get()
      if (s.mode !== 'sandbox') return
      const res = closeRing(s.work)
      if (res.error) return set({ hint: res.error, hintKind: 'error' })
      set({ work: res.work, undoStack: [...s.undoStack, snap()], hint: '魔术环已闭合，开始第 2 圈', hintKind: 'info', tick: s.tick + 1 })
      sound.play('round')
      persistWork(res.work)
    },

    undo: () => {
      const s = get()
      const prev = s.undoStack[s.undoStack.length - 1]
      if (!prev) return
      // 撤销恢复当时的换线状态；如果刚换了线还没钩，保留新颜色
      const curTotal = totalStitches(s.work)
      const prevTotal = totalStitches(prev.work)
      let base = prev.base
      let changes = trimColorChanges(prev.changes, prevTotal)
      const pending = curTotal > 0 ? s.colorChanges.find((c) => c.from === curTotal) : undefined
      if (pending && s.mode === 'sandbox') ({ base, changes } = changeColor(base, changes, prevTotal, pending.color))
      set({
        work: prev.work,
        baseColor: base,
        colorChanges: changes,
        yarnColor: s.mode === 'sandbox' ? currentColor(base, changes) : s.yarnColor,
        undoStack: s.undoStack.slice(0, -1),
        hint: '已撤销一针',
        hintKind: 'info',
        completed: false,
        tick: s.tick + 1,
      })
      sound.play('tap')
      if (s.mode === 'sandbox') persistWork(prev.work)
    },

    clearSandbox: () => {
      const s = get()
      if (s.mode !== 'sandbox') return
      set({
        work: emptyWork(),
        undoStack: [...s.undoStack, snap()],
        baseColor: s.yarnColor,
        colorChanges: [],
        hint: '画布已清空（可撤销）',
        hintKind: 'info',
        tick: s.tick + 1,
      })
      persistWork(emptyWork())
    },
  }
})
