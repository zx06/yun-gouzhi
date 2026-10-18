/** 换线：从第 from 个动作（全局针序，含锁针）起使用 color。 */
export interface ColorChange {
  from: number
  color: string
}

export const isHexColor = (x: unknown): x is string => typeof x === 'string' && /^#[0-9a-f]{6}$/i.test(x)

/** 校验并规整换线记录：坏条目丢弃，按 from 排序，同一位置保留最后一次。 */
export function sanitizeColorChanges(x: unknown): ColorChange[] {
  if (!Array.isArray(x)) return []
  const byFrom = new Map<number, string>()
  for (const c of x) {
    if (!c || typeof c !== 'object') continue
    const { from, color } = c as Record<string, unknown>
    if (typeof from !== 'number' || !Number.isInteger(from) || from < 0 || from > 100_000 || !isHexColor(color)) continue
    byFrom.set(from, color.toLowerCase())
  }
  return [...byFrom.entries()].sort((a, b) => a[0] - b[0]).map(([from, color]) => ({ from, color }))
}

/** 第 seq 针的颜色 */
export function colorAt(seq: number, base: string, changes: ColorChange[]): string {
  let c = base
  for (const ch of changes) {
    if (ch.from <= seq) c = ch.color
    else break
  }
  return c
}

/** 当前（下一针）的颜色 */
export const currentColor = (base: string, changes: ColorChange[]): string => (changes.length ? changes[changes.length - 1].color : base)

/**
 * 在已钩 total 针后换线。还没钩针时直接换底色；
 * 同一位置重复换线只保留最后一次；换回当前颜色不产生记录。
 */
export function changeColor(base: string, changes: ColorChange[], total: number, color: string): { base: string; changes: ColorChange[] } {
  const c = color.toLowerCase()
  if (total <= 0) return { base: c, changes: [] }
  const kept = changes.filter((x) => x.from < total)
  if (currentColor(base, kept) === c) return { base, changes: kept }
  return { base, changes: [...kept, { from: total, color: c }] }
}

/** 撤销到 total 针后，丢掉之后才生效的换线（刚换、还没钩的那次保留）。 */
export function trimColorChanges(changes: ColorChange[], total: number): ColorChange[] {
  return changes.filter((x) => x.from <= total)
}
