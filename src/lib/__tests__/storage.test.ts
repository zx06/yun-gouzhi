import { describe, expect, it } from 'vitest'
import * as S from '../storage'
import type { StitchType } from '../../types/stitch'
import { COASTER_LEVEL } from '../../patterns/levels'

class MemKV implements S.KV {
  m = new Map<string, string>()
  constructor(init: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(init)) this.m.set(k, v)
  }
  getItem(k: string) {
    return this.m.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.m.set(k, v)
  }
}

const R = (s: string) => s.split(' ').filter(Boolean) as StitchType[]
/** 一期沙盒存档样例：魔术环 6X 已闭合，第 2 圈钩了 3 个加针 */
const LEGACY_WORK = { rounds: [R('sc sc sc sc sc sc'), R('inc inc inc')] }

describe('workRoundsError / levelRoundsError', () => {
  it('accepts valid works incl. an in-progress round', () => {
    expect(S.workRoundsError([[]])).toBeNull()
    expect(S.workRoundsError(LEGACY_WORK.rounds)).toBeNull()
    expect(S.workRoundsError([...COASTER_LEVEL.rounds, []])).toBeNull()
  })
  it('rejects inconsistent works', () => {
    expect(S.workRoundsError('x')).toMatch(/格式/)
    expect(S.workRoundsError([])).toMatch(/没有/)
    expect(S.workRoundsError([R('sc dec')])).toMatch(/减针/)
    expect(S.workRoundsError([R('sc sc sc'), R('sc sc'), []])).toMatch(/第 2 圈/)
    expect(S.workRoundsError([R('sc sc sc'), R('inc inc inc inc')])).toMatch(/第 2 圈/)
    expect(S.workRoundsError([['sc', 'hdc']])).toMatch(/格式/)
  })
  it('validates levels are playable', () => {
    expect(S.levelRoundsError(COASTER_LEVEL.rounds)).toBeNull()
    expect(S.levelRoundsError([R('sc sc')])).toMatch(/3–12/)
    expect(S.levelRoundsError([R('sc sc sc sc sc sc ch')])).toMatch(/锁针/)
    expect(S.levelRoundsError([R('ch sc sc sc sc sc sc'), R('ch inc inc inc inc inc inc')])).toBeNull()
    expect(S.levelRoundsError([R('sc sc sc'), R('sc sc')])).toMatch(/第 2 圈/)
    expect(S.levelRoundsError(Array(31).fill(R('sc sc sc')))).toMatch(/30/)
  })
})

describe('loadData: versioning, migration, corruption', () => {
  it('starts empty and marks phase-1 key as migrated', () => {
    const kv = new MemKV()
    const r = S.loadData(kv, { now: 1 })
    expect(r.data.works).toEqual([])
    expect(r.data.migrated).toContain(S.LEGACY_SANDBOX_KEY)
    expect(r.dirty).toBe(true)
  })

  it('migrates the phase-1 sandbox autosave into my works without deleting it', () => {
    const legacy = JSON.stringify(LEGACY_WORK)
    const kv = new MemKV({ [S.LEGACY_SANDBOX_KEY]: legacy })
    const r = S.loadData(kv, { now: 5, yarnColor: '#2563eb' })
    expect(r.migratedWorks).toBe(1)
    expect(r.data.works).toHaveLength(1)
    expect(r.data.works[0].rounds).toEqual(LEGACY_WORK.rounds)
    expect(r.data.works[0].yarnColor).toBe('#2563eb')
    expect(r.data.lastWorkId).toBe(r.data.works[0].id)
    expect(kv.getItem(S.LEGACY_SANDBOX_KEY)).toBe(legacy)
    // persisted once -> never migrated twice
    S.saveData(kv, r.data)
    const again = S.loadData(kv)
    expect(again.migratedWorks).toBe(0)
    expect(again.data.works).toHaveLength(1)
    expect(again.dirty).toBe(false)
  })

  it('skips empty or corrupted phase-1 saves', () => {
    expect(S.loadData(new MemKV({ [S.LEGACY_SANDBOX_KEY]: '{"rounds":[[]]}' })).data.works).toHaveLength(0)
    expect(S.loadData(new MemKV({ [S.LEGACY_SANDBOX_KEY]: '{oops' })).data.works).toHaveLength(0)
  })

  it('backs up unparseable data instead of losing it', () => {
    const kv = new MemKV({ [S.DATA_KEY]: '{not json' })
    const r = S.loadData(kv, { now: 42 })
    expect(r.backupKey).toBe(`${S.BACKUP_PREFIX}42`)
    expect(kv.getItem(r.backupKey!)).toBe('{not json')
    expect(r.data.works).toEqual([])
  })

  it('drops only the broken entries and keeps the rest', () => {
    const good = { id: 'w-1', name: 'ok', rounds: [R('sc sc sc sc sc sc'), []], yarnColor: '#123456', createdAt: 1, updatedAt: 2 }
    const raw = JSON.stringify({
      version: 3,
      works: [good, { id: 'w-2', rounds: [['zzz']] }, null, { ...good, name: '   ' }],
      customLevels: [{ id: 'my-1', title: 'L', rounds: COASTER_LEVEL.rounds, bestStars: 9, bestMistakes: -1 }, { rounds: 'bad' }],
      lastWorkId: 'nope',
      migrated: [S.LEGACY_SANDBOX_KEY],
    })
    const kv = new MemKV({ [S.DATA_KEY]: raw })
    const r = S.loadData(kv, { now: 7 })
    expect(r.data.works.map((w) => w.name)).toEqual(['ok', '未命名作品'])
    // duplicate id got a fresh one
    expect(new Set(r.data.works.map((w) => w.id)).size).toBe(2)
    expect(r.data.customLevels).toHaveLength(1)
    expect(r.data.customLevels[0].bestStars).toBe(3)
    expect(r.data.customLevels[0].bestMistakes).toBeNull()
    expect(r.data.lastWorkId).toBeNull()
    expect(r.backupKey).toBeTruthy()
    expect(kv.getItem(r.backupKey!)).toBe(raw)
  })

  it('does not touch data from a newer version', () => {
    const raw = JSON.stringify({ version: 99, works: [] })
    const kv = new MemKV({ [S.DATA_KEY]: raw })
    const r = S.loadData(kv, { now: 3 })
    expect(r.backupKey).toBeTruthy()
    expect(kv.getItem(r.backupKey!)).toBe(raw)
  })

  it('survives a throwing storage', () => {
    const kv: S.KV = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('quota')
      },
    }
    expect(() => S.loadData(kv)).not.toThrow()
    expect(S.saveData(kv, S.emptyData())).toBe(false)
  })
})

describe('works operations', () => {
  it('create / rename / duplicate / delete round-trip through storage', () => {
    let d = S.emptyData()
    const a = S.createWork(d, '小熊', '#e11d48', 1)
    d = a.data
    d = S.updateWork(d, a.work.id, { rounds: LEGACY_WORK.rounds }, 2)
    const b = S.createWork(d, '小熊', '#16a34a', 3)
    d = b.data
    expect(b.work.name).toBe('小熊 (2)')
    d = S.renameWork(d, a.work.id, '  熊头  ', 4)
    expect(d.works.find((w) => w.id === a.work.id)?.name).toBe('熊头')
    d = S.renameWork(d, a.work.id, '   ')
    expect(d.works.find((w) => w.id === a.work.id)?.name).toBe('熊头')
    const dup = S.duplicateWork(d, a.work.id, 5)
    d = dup.data
    expect(dup.work?.name).toBe('熊头 副本')
    expect(dup.work?.rounds).toEqual(LEGACY_WORK.rounds)
    expect(dup.work?.id).not.toBe(a.work.id)
    d = S.deleteWork(d, b.work.id)
    expect(d.works.map((w) => w.name)).toEqual(['熊头', '熊头 副本'])
    expect(d.lastWorkId).toBeNull()

    const kv = new MemKV()
    S.saveData(kv, d)
    expect(S.loadData(kv).data.works).toEqual(d.works)
  })
})

describe('export / import', () => {
  it('exports and re-imports a work', () => {
    const w = { name: '杯垫', yarnColor: '#f59e0b', rounds: [...COASTER_LEVEL.rounds, R('sc sc')] }
    const json = JSON.stringify(S.buildWorkExport(w))
    const res = S.parseWorkImport(json)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.work).toEqual(w)
    const exp = S.buildWorkExport(w)
    expect(exp.closedRounds).toBe(5)
    expect(exp.patternZh).toContain('第4圈')
  })

  it('imports a phase-1 (version 2) export', () => {
    const v2 = {
      app: 'yun-gouzhi',
      version: 2,
      mode: 'sandbox',
      yarnColor: '#9333ea',
      rounds: [R('sc sc sc sc sc sc'), R('inc inc')],
      inProgressRound: R('inc inc'),
    }
    const res = S.parseWorkImport(JSON.stringify(v2))
    expect(res.ok && res.work.rounds).toEqual(v2.rounds)
    const closed = { ...v2, rounds: [R('sc sc sc sc sc sc')], inProgressRound: null }
    const res2 = S.parseWorkImport(JSON.stringify(closed))
    expect(res2.ok && res2.work.rounds).toEqual([R('sc sc sc sc sc sc'), []])
  })

  it('rejects bad files with a readable reason', () => {
    expect(S.parseWorkImport('nope')).toEqual({ ok: false, error: expect.stringMatching(/JSON/) })
    expect(S.parseWorkImport('{"app":"other"}')).toMatchObject({ ok: false })
    expect(S.parseWorkImport('{"app":"yun-gouzhi","version":3,"kind":"level","rounds":[[]]}')).toMatchObject({ ok: false, error: expect.stringMatching(/不是作品/) })
    expect(S.parseWorkImport('{"app":"yun-gouzhi","version":7,"kind":"work","rounds":[[]]}')).toMatchObject({ ok: false })
    expect(S.parseWorkImport(JSON.stringify({ app: 'yun-gouzhi', version: 3, kind: 'work', rounds: [R('sc sc sc'), R('sc'), []] }))).toMatchObject({ ok: false, error: expect.stringMatching(/第 2 圈/) })
    expect(S.parseWorkImport('x'.repeat(S.MAX_IMPORT_BYTES + 1))).toMatchObject({ ok: false, error: expect.stringMatching(/太大/) })
  })

  it('importWork adds a uniquely named copy', () => {
    let d = S.createWork(S.emptyData(), '杯垫', '#e11d48').data
    const res = S.importWork(d, JSON.stringify(S.buildWorkExport({ name: '杯垫', yarnColor: '#e11d48', rounds: [[]] })))
    expect(res.error).toBeNull()
    d = res.data
    expect(d.works.map((w) => w.name).sort()).toEqual(['杯垫', '杯垫 (2)'])
  })
})

describe('custom levels', () => {
  it('saves a work as a level, records best result, renames and deletes', () => {
    let d = S.emptyData()
    const bad = S.addCustomLevel(d, 'x', [R('sc')], 'pattern')
    expect(bad.error).toBeTruthy()
    expect(bad.data).toBe(d)
    const res = S.addCustomLevel(d, '我的杯垫', S.closedRounds([...COASTER_LEVEL.rounds, []]), 'work', 1)
    expect(res.error).toBeNull()
    d = res.data
    const id = res.level!.id
    expect(id.startsWith('my-')).toBe(true)
    d = S.recordCustomResult(d, id, 2, 2)
    d = S.recordCustomResult(d, id, 1, 5)
    expect(d.customLevels[0]).toMatchObject({ bestStars: 2, bestMistakes: 2 })
    d = S.recordCustomResult(d, id, 3, 0)
    expect(d.customLevels[0]).toMatchObject({ bestStars: 3, bestMistakes: 0 })
    d = S.renameCustomLevel(d, id, '杯垫 Pro')
    const kv = new MemKV()
    S.saveData(kv, d)
    expect(S.loadData(kv).data.customLevels[0]).toMatchObject({ title: '杯垫 Pro', bestStars: 3, bestMistakes: 0 })
    d = S.deleteCustomLevel(d, id)
    expect(d.customLevels).toEqual([])
  })

  it('closedRounds drops the in-progress round', () => {
    expect(S.closedRounds([R('sc sc sc'), R('sc')])).toEqual([R('sc sc sc')])
    expect(S.closedRounds([[]])).toEqual([])
  })
})

describe('colour changes in saves (phase 4, optional field)', () => {
  const rounds = [R('sc sc sc sc sc sc'), R('inc inc')]
  it('phase-2 saves without colours load unchanged (no new field added)', () => {
    const w = { id: 'w-1', name: 'old', rounds, yarnColor: '#123456', createdAt: 1, updatedAt: 2 }
    const kv = new MemKV({ [S.DATA_KEY]: JSON.stringify({ version: 3, works: [w], customLevels: [], lastWorkId: null, migrated: [S.LEGACY_SANDBOX_KEY] }) })
    const r = S.loadData(kv)
    expect(r.data.works[0]).toEqual(w)
    expect(r.dirty).toBe(false)
  })
  it('keeps valid colour changes, drops bad ones without dropping the work', () => {
    const w = { id: 'w-1', name: 'c', rounds, yarnColor: '#123456', colors: [{ from: 6, color: '#ABCDEF' }, { from: 'x', color: 1 }], createdAt: 1, updatedAt: 2 }
    const kv = new MemKV({ [S.DATA_KEY]: JSON.stringify({ version: 3, works: [w], migrated: [S.LEGACY_SANDBOX_KEY] }) })
    expect(S.loadData(kv).data.works[0].colors).toEqual([{ from: 6, color: '#abcdef' }])
  })
  it('export → import round-trips colour changes', () => {
    const colors = [{ from: 6, color: '#2563eb' }]
    const exp = S.buildWorkExport({ name: 'c', yarnColor: '#e11d48', rounds, colors })
    expect(exp.colors).toEqual(colors)
    const res = S.parseWorkImport(JSON.stringify(exp))
    expect(res.ok && res.work.colors).toEqual(colors)
    // 没有换线时不写 colors 字段（和二期导出一致）
    expect('colors' in S.buildWorkExport({ name: 'c', yarnColor: '#e11d48', rounds })).toBe(false)
  })
})
