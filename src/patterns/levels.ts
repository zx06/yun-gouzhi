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
  /** 高亮下一针该按的按钮（入门关） */
  guide?: boolean
  /** 通关弹窗标题 */
  doneTitle?: string
  /** 我的关卡（玩家自建） */
  custom?: boolean
}

export function makeLevel(
  id: string,
  title: string,
  description: string,
  pattern: string,
  tips: string[] = [],
  extra: Pick<Level, 'guide' | 'doneTitle'> = {},
): Level {
  const { rounds, errors } = parsePattern(pattern)
  if (errors.length) throw new Error(`关卡 ${id} 图解有误：${errors.join('；')}`)
  return { id, title, description, pattern, rounds: rounds.map((r) => r.stitches), tips, ...extra }
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
  { guide: true, doneTitle: '杯垫完成！🎉' },
)

export const BIG_CIRCLE_PATTERN = `第1圈：魔术环 6X (6)
第2圈：6V (12)
第3圈：(X,V)*6 (18)
第4圈：(2X,V)*6 (24)
第5圈：(3X,V)*6 (30)
第6圈：(4X,V)*6 (36)
第7圈：36X (36)`

export const BIG_CIRCLE_LEVEL = makeLevel(
  'circle-l2',
  '教程 · 大圆垫',
  '找规律：每圈加针前的短针多 1 个，平面圆就能一直变大。',
  BIG_CIRCLE_PATTERN,
  [
    '第 1 圈：魔术环里 6 个短针 X。',
    '第 2 圈：6 个加针 V，6 → 12。',
    '第 3 圈：(X,V)*6，12 → 18。',
    '第 4 圈：(2X,V)*6，18 → 24。',
    '第 5 圈：规律来了——加针前 3 个短针，(3X,V)*6，24 → 30。',
    '第 6 圈：(4X,V)*6，30 → 36。每圈都加 6 针，圆片才平整。',
    '第 7 圈：36 个短针收边。',
  ],
  { doneTitle: '大圆垫完成！🎉' },
)

export const BOWL_PATTERN = `第1圈：魔术环 6X (6)
第2圈：6V (12)
第3圈：(X,V)*6 (18)
第4圈：(2X,V)*6 (24)
第5-8圈：24X (24)`

export const BOWL_LEVEL = makeLevel(
  'bowl-l3',
  '教程 · 小碗',
  '先加针钩出碗底，再一圈圈不加不减平钩——平钩的圈会立起来变成碗壁。',
  BOWL_PATTERN,
  [
    '第 1 圈：魔术环里 6 个短针 X（碗底开始）。',
    '第 2 圈：6V，6 → 12。',
    '第 3 圈：(X,V)*6，12 → 18。',
    '第 4 圈：(2X,V)*6，18 → 24，碗底完成。',
    '第 5 圈：开始平钩 24X。不再加针，织片就不再变大，而是向上立起来。',
    '第 6 圈：24X，碗壁继续长高。',
    '第 7 圈：24X。',
    '第 8 圈：24X，碗口完成！（画布是俯视图，平钩的圈在实物里是竖着的）',
  ],
  { doneTitle: '小碗完成！🥣' },
)

export const BALL_LEVEL_PATTERN = `第1圈：魔术环 6X (6)
第2圈：6V (12)
第3圈：(X,V)*6 (18)
第4-6圈：18X (18)
第7圈：(X,A)*6 (12)
第8圈：6A (6)`

export const BALL_LEVEL = makeLevel(
  'ball-l4',
  '教程 · 小球',
  '学会减针 A（2 针并 1 针）：加针 → 平钩 → 减针收口，就是一个立体小球。',
  BALL_LEVEL_PATTERN,
  [
    '第 1 圈：魔术环里 6 个短针 X。',
    '第 2 圈：6V，6 → 12。',
    '第 3 圈：(X,V)*6，12 → 18。',
    '第 4 圈：18X 平钩，球开始变圆。',
    '第 5 圈：18X。',
    '第 6 圈：18X，球的最宽处。',
    '第 7 圈：开始减针！(X,A)*6——减针 A 一次用掉上一圈 2 针，18 → 12。',
    '第 8 圈：6A，12 → 6。实物里这时塞好棉花，最后收紧剩下的 6 针。',
  ],
  { doneTitle: '小球完成！⚽' },
)

export const DOLL_HEAD_PATTERN = `第1圈：魔术环 6X (6)
第2圈：6V (12)
第3圈：(X,V)*6 (18)
第4圈：(2X,V)*6 (24)
第5圈：(3X,V)*6 (30)
第6-8圈：30X (30)
第9圈：(3X,A)*6 (24)
第10圈：(2X,A)*6 (18)
第11圈：(X,A)*6 (12)
第12圈：6A (6)`

export const DOLL_HEAD_LEVEL = makeLevel(
  'head-l5',
  '挑战 · 玩偶头',
  '综合关：加到 30 针、平钩 3 圈、再对称减针收口——钩玩偶头的标准做法。',
  DOLL_HEAD_PATTERN,
  [
    '第 1 圈：魔术环里 6 个短针 X。',
    '第 2 圈：6V，6 → 12。',
    '第 3 圈：(X,V)*6，12 → 18。',
    '第 4 圈：(2X,V)*6，18 → 24。',
    '第 5 圈：(3X,V)*6，24 → 30。',
    '第 6 圈：30X 平钩，开始长出脸的高度。',
    '第 7 圈：30X。（真玩偶常在这几圈之间缝上安全眼）',
    '第 8 圈：30X。',
    '第 9 圈：减针和加针是对称的：(3X,A)*6，30 → 24。',
    '第 10 圈：(2X,A)*6，24 → 18。',
    '第 11 圈：(X,A)*6，18 → 12。实物这时开始塞棉花。',
    '第 12 圈：6A，12 → 6，收口完成！',
  ],
  { doneTitle: '玩偶头完成！🧸' },
)

/** 内置关卡，按难度排序；通关上一关（≥1 星）解锁下一关。 */
export const LEVELS: Level[] = [COASTER_LEVEL, BIG_CIRCLE_LEVEL, BOWL_LEVEL, BALL_LEVEL, DOLL_HEAD_LEVEL]

export function isLevelUnlocked(index: number, bestStars: Record<string, number>, levels: Level[] = LEVELS): boolean {
  if (index <= 0) return true
  const prev = levels[index - 1]
  return !!prev && (bestStars[prev.id] ?? 0) >= 1
}

export function nextLevel(id: string, levels: Level[] = LEVELS): Level | null {
  const i = levels.findIndex((l) => l.id === id)
  return i >= 0 && i + 1 < levels.length ? levels[i + 1] : null
}

/** 小球玩偶（amigurumi ball）示例：先加后平再减。 */
export const BALL_PATTERN = `R1: 6 sc in MR (6)
R2: inc x6 (12)
R3: (sc, inc) x6 (18)
R4-6: 18 sc (18)
R7: (sc, dec) x6 (12)
R8: 6 dec (6)`
