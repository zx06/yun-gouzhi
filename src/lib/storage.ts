/**
 * 本机存档（localStorage）：我的作品 + 我的关卡。
 * 纯函数 + 可注入的 KV，便于测试；任何损坏 / 旧版本数据都不会让页面崩溃，
 * 也不会悄悄丢掉用户数据（解析失败的原始内容会另存一份备份）。
 */
import { STITCH_COST, type StitchType } from '../types/stitch'
import { countConsumed, countProduced, formatPattern } from './pattern'
import { sanitizeColorChanges, type ColorChange } from './colors'

export const DATA_KEY = 'yun-gouzhi-data-v3'
/** 一期沙盒自动存档（单份作品） */
export const LEGACY_SANDBOX_KEY = 'yun-gouzhi-sandbox-v2'
export const BACKUP_PREFIX = 'yun-gouzhi-backup-'
export const DATA_VERSION = 3

export const MAX_RING = 12
export const MAX_WORK_ROUNDS = 40
export const MAX_LEVEL_ROUNDS = 30
export const MAX_NAME = 40
export const MAX_IMPORT_BYTES = 1_000_000

export interface KV {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface SavedWork {
  id: string
  name: string
  /** 同 engine Work.rounds：最后一项是进行中的圈（可为空） */
  rounds: StitchType[][]
  /** 起始毛线颜色 */
  yarnColor: string
  /** 换线记录（四期新增，可选；旧存档没有这个字段） */
  colors?: ColorChange[]
  createdAt: number
  updatedAt: number
}

export interface CustomLevel {
  id: string
  title: string
  rounds: StitchType[][]
  source: 'work' | 'pattern'
  createdAt: number
  bestStars: number
  /** 最少失误；未通关为 null */
  bestMistakes: number | null
}

export interface AppData {
  version: typeof DATA_VERSION
  works: SavedWork[]
  customLevels: CustomLevel[]
  lastWorkId: string | null
  /** 已迁移过的旧 key，避免重复导入 */
  migrated: string[]
}

export const emptyData = (): AppData => ({
  version: DATA_VERSION,
  works: [],
  customLevels: [],
  lastWorkId: null,
  migrated: [],
})

let idCounter = 0
export function newId(prefix: string): string {
  idCounter = (idCounter + 1) % 1e6
  return `${prefix}-${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

// ------------------------------------------------------------ validation

const isStitch = (s: unknown): s is StitchType => typeof s === 'string' && Object.prototype.hasOwnProperty.call(STITCH_COST, s)

function isRoundsShape(x: unknown): x is StitchType[][] {
  return Array.isArray(x) && x.every((r) => Array.isArray(r) && r.every(isStitch))
}

/**
 * 校验一份作品（含进行中的最后一圈）是否符合圈织规则，返回错误说明或 null。
 * 规则与 engine.applyStitch 一致：魔术环 ≤12 针且无减针、闭合时 ≥1 针；
 * 已完成的圈恰好用完上一圈；进行中的圈不超过上一圈。
 */
export function workRoundsError(rounds: unknown): string | null {
  if (!isRoundsShape(rounds)) return '针法数据格式不对'
  if (rounds.length === 0) return '没有任何圈'
  if (rounds.length > MAX_WORK_ROUNDS) return `超过 ${MAX_WORK_ROUNDS} 圈`
  const ring = rounds[0]
  if (ring.includes('dec')) return '魔术环里不能有减针'
  if (countProduced(ring) > MAX_RING) return `魔术环最多 ${MAX_RING} 针`
  if (rounds.length > 1 && countProduced(ring) < 1) return '魔术环里没有针'
  for (let k = 1; k < rounds.length; k++) {
    const prev = countProduced(rounds[k - 1])
    const used = countConsumed(rounds[k])
    const last = k === rounds.length - 1
    if (last ? used > prev : used !== prev) return `第 ${k + 1} 圈用掉 ${used} 针，但上一圈有 ${prev} 针`
  }
  return null
}

/** 关卡（全部是完成的圈）是否能在引擎里一针一针钩完。 */
export function levelRoundsError(rounds: unknown): string | null {
  if (!isRoundsShape(rounds)) return '针法数据格式不对'
  if (rounds.length === 0) return '图解为空'
  if (rounds.length > MAX_LEVEL_ROUNDS) return `关卡最多 ${MAX_LEVEL_ROUNDS} 圈`
  const ring = rounds[0]
  if (ring.includes('dec')) return '第 1 圈（魔术环）不能有减针'
  const n = countProduced(ring)
  if (n < 3 || n > MAX_RING) return `第 1 圈（魔术环）需要 3–${MAX_RING} 针，现在是 ${n} 针`
  for (let k = 0; k < rounds.length; k++) {
    const r = rounds[k]
    if (r.length === 0) return `第 ${k + 1} 圈是空的`
    // 引擎在用完上一圈的针时自动换圈，圈尾的锁针会被算进下一圈
    if (r[r.length - 1] === 'ch') return `第 ${k + 1} 圈不能以锁针结尾（锁针请写在圈首）`
    if (k > 0) {
      const prev = countProduced(rounds[k - 1])
      const used = countConsumed(r)
      if (used !== prev) return `第 ${k + 1} 圈用掉 ${used} 针，但上一圈有 ${prev} 针`
      if (countProduced(r) < 1) return `第 ${k + 1} 圈没有针`
    }
  }
  return null
}

function cleanName(x: unknown, fallback: string): string {
  const s = typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) : ''
  return s || fallback
}

const isColor = (x: unknown): x is string => typeof x === 'string' && /^#[0-9a-f]{6}$/i.test(x)
const num = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? x : d)

function sanitizeWork(x: unknown, now: number): SavedWork | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  if (workRoundsError(o.rounds)) return null
  const rounds = (o.rounds as StitchType[][]).map((r) => [...r])
  const colors = sanitizeColorChanges(o.colors)
  return {
    id: typeof o.id === 'string' && o.id ? o.id : newId('w'),
    name: cleanName(o.name, '未命名作品'),
    rounds,
    yarnColor: isColor(o.yarnColor) ? o.yarnColor : '#e11d48',
    ...(colors.length ? { colors } : {}),
    createdAt: num(o.createdAt, now),
    updatedAt: num(o.updatedAt, now),
  }
}

function sanitizeLevel(x: unknown, now: number): CustomLevel | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  if (levelRoundsError(o.rounds)) return null
  const stars = num(o.bestStars, 0)
  const bm = o.bestMistakes
  return {
    id: typeof o.id === 'string' && o.id.startsWith('my-') ? o.id : newId('my'),
    title: cleanName(o.title, '我的关卡'),
    rounds: (o.rounds as StitchType[][]).map((r) => [...r]),
    source: o.source === 'work' ? 'work' : 'pattern',
    createdAt: num(o.createdAt, now),
    bestStars: Math.max(0, Math.min(3, Math.round(stars))),
    bestMistakes: typeof bm === 'number' && Number.isFinite(bm) && bm >= 0 ? Math.round(bm) : null,
  }
}

function dedupeIds<T extends { id: string }>(items: T[], prefix: string): T[] {
  const seen = new Set<string>()
  return items.map((it) => {
    if (seen.has(it.id)) it = { ...it, id: newId(prefix) }
    seen.add(it.id)
    return it
  })
}

export interface LoadResult {
  data: AppData
  /** 有数据被丢弃 / 解析失败时，原始内容备份到的 key */
  backupKey: string | null
  /** 本次从旧存档迁移了多少份作品 */
  migratedWorks: number
  /** 需要写回（迁移 / 清洗过） */
  dirty: boolean
}

/**
 * 解析存档文本（任何版本 / 损坏内容都安全）。
 * 返回清洗后的数据和被丢弃的条目数。
 */
export function parseData(raw: string | null, now = Date.now()): { data: AppData; dropped: number; corrupt: boolean } {
  if (raw == null) return { data: emptyData(), dropped: 0, corrupt: false }
  let obj: unknown
  try {
    obj = JSON.parse(raw)
  } catch {
    return { data: emptyData(), dropped: 0, corrupt: true }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { data: emptyData(), dropped: 0, corrupt: true }
  const o = obj as Record<string, unknown>
  const version = num(o.version, 0)
  if (version > DATA_VERSION) {
    // 来自更新版本的存档：不认识就不碰，按损坏处理（会备份原文）
    return { data: emptyData(), dropped: 0, corrupt: true }
  }
  const rawWorks = Array.isArray(o.works) ? o.works : []
  const rawLevels = Array.isArray(o.customLevels) ? o.customLevels : []
  const works = dedupeIds(
    rawWorks.map((w) => sanitizeWork(w, now)).filter((w): w is SavedWork => !!w),
    'w',
  )
  const customLevels = dedupeIds(
    rawLevels.map((l) => sanitizeLevel(l, now)).filter((l): l is CustomLevel => !!l),
    'my',
  )
  const dropped = rawWorks.length - works.length + (rawLevels.length - customLevels.length)
  const lastWorkId = typeof o.lastWorkId === 'string' && works.some((w) => w.id === o.lastWorkId) ? o.lastWorkId : null
  const migrated = Array.isArray(o.migrated) ? o.migrated.filter((k): k is string => typeof k === 'string') : []
  return { data: { version: DATA_VERSION, works, customLevels, lastWorkId, migrated }, dropped, corrupt: false }
}

/** 读取存档，必要时从一期单份沙盒存档迁移。不会删除任何旧 key。 */
export function loadData(kv: KV, opts: { now?: number; yarnColor?: string } = {}): LoadResult {
  const now = opts.now ?? Date.now()
  let raw: string | null = null
  try {
    raw = kv.getItem(DATA_KEY)
  } catch {
    raw = null
  }
  const { data, dropped, corrupt } = parseData(raw, now)
  let backupKey: string | null = null
  let dirty = false
  if ((corrupt || dropped > 0) && raw != null) {
    backupKey = `${BACKUP_PREFIX}${now}`
    try {
      kv.setItem(backupKey, raw)
    } catch {
      backupKey = null
    }
    dirty = true
  }
  let migratedWorks = 0
  if (!data.migrated.includes(LEGACY_SANDBOX_KEY)) {
    let legacy: string | null = null
    try {
      legacy = kv.getItem(LEGACY_SANDBOX_KEY)
    } catch {
      legacy = null
    }
    if (legacy != null) {
      try {
        const w = JSON.parse(legacy) as { rounds?: unknown }
        const rounds = w?.rounds
        if (!workRoundsError(rounds) && (rounds as StitchType[][]).some((r) => r.length > 0)) {
          const work: SavedWork = {
            id: newId('w'),
            name: '沙盒作品（一期存档）',
            rounds: (rounds as StitchType[][]).map((r) => [...r]),
            yarnColor: isColor(opts.yarnColor) ? opts.yarnColor : '#e11d48',
            createdAt: now,
            updatedAt: now,
          }
          data.works.unshift(work)
          data.lastWorkId = work.id
          migratedWorks = 1
        }
      } catch {
        /* 旧存档损坏：保留原 key 不动，只是不迁移 */
      }
    }
    data.migrated.push(LEGACY_SANDBOX_KEY)
    dirty = true
  }
  return { data, backupKey, migratedWorks, dirty }
}

export function saveData(kv: KV, data: AppData): boolean {
  try {
    kv.setItem(DATA_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

// ------------------------------------------------------------ operations (immutable)

export function uniqueName(base: string, taken: string[]): string {
  const name = cleanName(base, '未命名作品')
  if (!taken.includes(name)) return name
  for (let i = 2; ; i++) {
    const n = `${name.slice(0, MAX_NAME - 5)} (${i})`
    if (!taken.includes(n)) return n
  }
}

export function createWork(data: AppData, name: string, yarnColor: string, now = Date.now()): { data: AppData; work: SavedWork } {
  const work: SavedWork = {
    id: newId('w'),
    name: uniqueName(name, data.works.map((w) => w.name)),
    rounds: [[]],
    yarnColor: isColor(yarnColor) ? yarnColor : '#e11d48',
    createdAt: now,
    updatedAt: now,
  }
  return { data: { ...data, works: [work, ...data.works], lastWorkId: work.id }, work }
}

export function updateWork(data: AppData, id: string, patch: Partial<Pick<SavedWork, 'rounds' | 'yarnColor' | 'name' | 'colors'>>, now = Date.now()): AppData {
  return {
    ...data,
    works: data.works.map((w) =>
      w.id === id
        ? {
            ...w,
            ...patch,
            name: patch.name !== undefined ? cleanName(patch.name, w.name) : w.name,
            updatedAt: now,
          }
        : w,
    ),
  }
}

export function renameWork(data: AppData, id: string, name: string, now = Date.now()): AppData {
  return updateWork(data, id, { name }, now)
}

export function duplicateWork(data: AppData, id: string, now = Date.now()): { data: AppData; work: SavedWork | null } {
  const src = data.works.find((w) => w.id === id)
  if (!src) return { data, work: null }
  const work: SavedWork = {
    ...src,
    id: newId('w'),
    name: uniqueName(`${src.name} 副本`, data.works.map((w) => w.name)),
    rounds: src.rounds.map((r) => [...r]),
    ...(src.colors?.length ? { colors: src.colors.map((c) => ({ ...c })) } : {}),
    createdAt: now,
    updatedAt: now,
  }
  const i = data.works.indexOf(src)
  const works = [...data.works.slice(0, i + 1), work, ...data.works.slice(i + 1)]
  return { data: { ...data, works }, work }
}

export function deleteWork(data: AppData, id: string): AppData {
  return {
    ...data,
    works: data.works.filter((w) => w.id !== id),
    lastWorkId: data.lastWorkId === id ? null : data.lastWorkId,
  }
}

/** 作品里已完成的圈（不含进行中的圈）。 */
export function closedRounds(rounds: StitchType[][]): StitchType[][] {
  return rounds.slice(0, -1).filter((r) => r.length > 0)
}

export function addCustomLevel(
  data: AppData,
  title: string,
  rounds: StitchType[][],
  source: CustomLevel['source'],
  now = Date.now(),
): { data: AppData; level: CustomLevel | null; error: string | null } {
  const error = levelRoundsError(rounds)
  if (error) return { data, level: null, error }
  const level: CustomLevel = {
    id: newId('my'),
    title: uniqueName(title || '我的关卡', data.customLevels.map((l) => l.title)),
    rounds: rounds.map((r) => [...r]),
    source,
    createdAt: now,
    bestStars: 0,
    bestMistakes: null,
  }
  return { data: { ...data, customLevels: [...data.customLevels, level] }, level, error: null }
}

export function renameCustomLevel(data: AppData, id: string, title: string): AppData {
  return { ...data, customLevels: data.customLevels.map((l) => (l.id === id ? { ...l, title: cleanName(title, l.title) } : l)) }
}

export function deleteCustomLevel(data: AppData, id: string): AppData {
  return { ...data, customLevels: data.customLevels.filter((l) => l.id !== id) }
}

/** 记录通关成绩，只保留最好的（星数优先，其次失误更少）。 */
export function recordCustomResult(data: AppData, id: string, stars: number, mistakes: number): AppData {
  return {
    ...data,
    customLevels: data.customLevels.map((l) =>
      l.id === id
        ? {
            ...l,
            bestStars: Math.max(l.bestStars, stars),
            bestMistakes: l.bestMistakes === null ? mistakes : Math.min(l.bestMistakes, mistakes),
          }
        : l,
    ),
  }
}

// ------------------------------------------------------------ export / import

export interface WorkExport {
  app: 'yun-gouzhi'
  kind: 'work'
  version: typeof DATA_VERSION
  name: string
  yarnColor: string
  colors?: ColorChange[]
  rounds: StitchType[][]
  closedRounds: number
  patternZh: string
  patternEn: string
  exportedAt: string
}

export function buildWorkExport(work: Pick<SavedWork, 'name' | 'yarnColor' | 'rounds' | 'colors'>, now = new Date()): WorkExport {
  const closed = closedRounds(work.rounds)
  return {
    app: 'yun-gouzhi',
    kind: 'work',
    version: DATA_VERSION,
    name: work.name,
    yarnColor: work.yarnColor,
    ...(work.colors?.length ? { colors: work.colors.map((c) => ({ ...c })) } : {}),
    rounds: work.rounds.map((r) => [...r]),
    closedRounds: closed.length,
    patternZh: formatPattern(closed, 'zh'),
    patternEn: formatPattern(closed, 'en'),
    exportedAt: now.toISOString(),
  }
}

export type ImportResult =
  | { ok: true; work: Pick<SavedWork, 'name' | 'yarnColor' | 'rounds' | 'colors'> }
  | { ok: false; error: string }

/**
 * 解析导出的作品 JSON：支持二期格式（kind:'work', version 3）
 * 和一期格式（version 2：rounds 含进行中的圈 + inProgressRound）。
 */
export function parseWorkImport(text: string): ImportResult {
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, error: '文件太大（超过 1MB）' }
  let obj: unknown
  try {
    obj = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    return { ok: false, error: '不是有效的 JSON 文件' }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, error: '不是云钩织导出的作品文件' }
  const o = obj as Record<string, unknown>
  if (o.app !== 'yun-gouzhi') return { ok: false, error: '不是云钩织导出的作品文件' }
  const version = num(o.version, 0)
  let rounds: unknown
  if (version >= 3) {
    if (version > DATA_VERSION) return { ok: false, error: '文件来自更新版本的云钩织，请刷新页面后再试' }
    if (o.kind !== 'work') return { ok: false, error: '这个文件不是作品（可能是关卡或其他数据）' }
    rounds = o.rounds
  } else if (version === 2) {
    // 一期：rounds = 非空的圈（含进行中的圈）；inProgressRound 非空时最后一圈是进行中的
    if (!isRoundsShape(o.rounds)) return { ok: false, error: '针法数据格式不对' }
    const r = (o.rounds as StitchType[][]).filter((x) => x.length > 0)
    rounds = o.inProgressRound ? r : [...r, []]
  } else {
    return { ok: false, error: '不认识的文件版本' }
  }
  if (isRoundsShape(rounds) && rounds.length === 0) rounds = [[]]
  const err = workRoundsError(rounds)
  if (err) return { ok: false, error: `作品数据有误：${err}` }
  const colors = sanitizeColorChanges(o.colors)
  return {
    ok: true,
    work: {
      name: cleanName(o.name, '导入的作品'),
      yarnColor: isColor(o.yarnColor) ? o.yarnColor : '#e11d48',
      rounds: (rounds as StitchType[][]).map((x) => [...x]),
      ...(colors.length ? { colors } : {}),
    },
  }
}

export function importWork(data: AppData, text: string, now = Date.now()): { data: AppData; work: SavedWork | null; error: string | null } {
  const res = parseWorkImport(text)
  if (!res.ok) return { data, work: null, error: res.error }
  const work: SavedWork = {
    id: newId('w'),
    name: uniqueName(res.work.name, data.works.map((w) => w.name)),
    rounds: res.work.rounds,
    yarnColor: res.work.yarnColor,
    ...(res.work.colors ? { colors: res.work.colors } : {}),
    createdAt: now,
    updatedAt: now,
  }
  return { data: { ...data, works: [work, ...data.works] }, work, error: null }
}
