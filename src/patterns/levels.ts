import { parsePattern } from '../lib/pattern'
import type { StitchType } from '../types/stitch'

export interface Level {
  id: string
  title: string
  description: string
  /** pattern text in Chinese symbol notation */
  pattern: string
  rounds: StitchType[][]
  tips: string[]
}

export function makeLevel(id: string, title: string, description: string, pattern: string, tips: string[] = []): Level {
  const { rounds, errors } = parsePattern(pattern)
  if (errors.length) throw new Error(`关卡 ${id} 图解有误：${errors.join('；')}`)
  return { id, title, description, pattern, rounds: rounds.map((r) => r.stitches), tips }
}

export const COASTER_PATTERN = `第1圈：魔术环 6X (6)
第2圈：6V (12)
第3圈：(X,V)*6 (18)
第4圈：(2X,V)*6 (24)
第5圈：24X (24)`

export const COASTER_LEVEL = makeLevel(
  'coaster-l1',
  '教程 · 杯垫',
  '魔术环起 6 针，每圈均匀加 6 针到 24 针，最后一圈不加不减收边。',
  COASTER_PATTERN,
  [
    '第 1 圈：在魔术环里钩 6 个短针 X。',
    '第 2 圈：每针都加针 V（1 针里钩 2 针），6 → 12。',
    '第 3 圈：短针、加针交替 (X,V)*6，12 → 18。',
    '第 4 圈：2 个短针 + 1 个加针，重复 6 次，18 → 24。',
    '第 5 圈：一圈 24 个短针，不加不减。',
  ],
)

/** 小球玩偶（amigurumi ball）示例：先加后平再减。 */
export const BALL_PATTERN = `R1: 6 sc in MR (6)
R2: inc x6 (12)
R3: (sc, inc) x6 (18)
R4-6: 18 sc (18)
R7: (sc, dec) x6 (12)
R8: 6 dec (6)`
