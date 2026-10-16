import type { Level } from './levels'
import type { StitchType } from '../types/stitch'
import { formatPattern } from '../lib/pattern'

export function makeLevelFromRounds(rounds: StitchType[][]): Level {
  if (!rounds.length) throw new Error('图解为空')
  if (rounds[0].includes('dec')) throw new Error('第 1 圈（魔术环）不能有减针')
  return {
    id: 'custom',
    title: '自定义图解',
    description: '按你粘贴的图解一针一针钩。',
    pattern: formatPattern(rounds, 'zh'),
    rounds,
    tips: [],
  }
}
