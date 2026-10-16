export type StitchType = 'ch' | 'sc' | 'inc' | 'dec'

export interface PlacedStitch {
  id: string
  type: StitchType
  x: number
  y: number
  round: number
  angle: number
  /** Pop animation progress 0–1, optional */
  pop?: number
}

export interface RoundInfo {
  stitchCount: number
}

export const STITCH_LABELS: Record<
  StitchType,
  { en: string; zh: string; symbolEn: string; symbolZh: string }
> = {
  ch: { en: 'chain', zh: '锁针', symbolEn: 'ch', symbolZh: 'O' },
  sc: { en: 'single crochet', zh: '短针', symbolEn: 'sc', symbolZh: 'X' },
  inc: { en: 'increase', zh: '加针', symbolEn: 'inc', symbolZh: 'V' },
  dec: { en: 'decrease', zh: '减针', symbolEn: 'dec', symbolZh: 'A' },
}
