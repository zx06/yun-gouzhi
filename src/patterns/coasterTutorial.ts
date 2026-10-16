import type { StitchType } from '../types/stitch'

/** 杯垫教程：魔环 6 短针，再 3 圈加针，最后一圈 plain sc */
export const COASTER_TUTORIAL: {
  id: string
  titleZh: string
  titleEn: string
  descriptionZh: string
  descriptionEn: string
  sequence: StitchType[]
  roundBoundaries: number[]
} = {
  id: 'coaster-l1',
  titleZh: '教程 · 杯垫 L1',
  titleEn: 'Tutorial · Coaster L1',
  descriptionZh: '魔环起 6 针，逐圈加针至 24 针，再织一圈短针收边。',
  descriptionEn: 'Magic ring with 6 sc, increase to 24, one plain sc round.',
  roundBoundaries: [0, 6, 12, 18, 24, 48],
  sequence: [
    // R1: MR 6 sc
    'sc',
    'sc',
    'sc',
    'sc',
    'sc',
    'sc',
    // R2: inc × 6 → 12
    'inc',
    'inc',
    'inc',
    'inc',
    'inc',
    'inc',
    // R3: (sc, inc) × 6 → 18
    'sc',
    'inc',
    'sc',
    'inc',
    'sc',
    'inc',
    'sc',
    'inc',
    'sc',
    'inc',
    'sc',
    'inc',
    // R4: (2 sc, inc) × 6 → 24
    'sc',
    'sc',
    'inc',
    'sc',
    'sc',
    'inc',
    'sc',
    'sc',
    'inc',
    'sc',
    'sc',
    'inc',
    'sc',
    'sc',
    'inc',
    'sc',
    'sc',
    'inc',
    // R5: 24 sc
    ...Array<StitchType>(24).fill('sc'),
  ],
}

export function getTutorialRound(index: number): number {
  const b = COASTER_TUTORIAL.roundBoundaries
  for (let r = b.length - 1; r >= 0; r--) {
    if (index >= b[r]) return r + 1
  }
  return 1
}
