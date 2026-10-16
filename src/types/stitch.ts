export type StitchType = 'ch' | 'sc' | 'inc' | 'dec'

export type Notation = 'zh' | 'en'

export const STITCH_LABELS: Record<
  StitchType,
  { en: string; zh: string; symbolEn: string; symbolZh: string; tipZh: string }
> = {
  ch: { en: 'chain', zh: '锁针', symbolEn: 'ch', symbolZh: 'O', tipZh: '起针/装饰，不占针数' },
  sc: { en: 'single crochet', zh: '短针', symbolEn: 'sc', symbolZh: 'X', tipZh: '1 针里钩 1 针' },
  inc: { en: 'increase', zh: '加针', symbolEn: 'inc', symbolZh: 'V', tipZh: '1 针里钩 2 针' },
  dec: { en: 'decrease', zh: '减针', symbolEn: 'dec', symbolZh: 'A', tipZh: '2 针并 1 针' },
}

/** How many stitches of the previous round a stitch consumes / how many it produces. */
export const STITCH_COST: Record<StitchType, { consume: number; produce: number }> = {
  ch: { consume: 0, produce: 0 },
  sc: { consume: 1, produce: 1 },
  inc: { consume: 1, produce: 2 },
  dec: { consume: 2, produce: 1 },
}

export function stitchSymbol(t: StitchType, n: Notation): string {
  return n === 'zh' ? STITCH_LABELS[t].symbolZh : STITCH_LABELS[t].symbolEn
}
