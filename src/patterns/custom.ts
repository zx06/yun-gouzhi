import type { Level } from './levels'
import type { StitchType } from '../types/stitch'
import { formatPattern } from '../lib/pattern'
import { levelRoundsError, type CustomLevel } from '../lib/storage'

export function makeLevelFromRounds(rounds: StitchType[][]): Level {
  const err = levelRoundsError(rounds)
  if (err) throw new Error(err)
  return {
    id: 'custom',
    title: '自定义图解',
    description: '按你粘贴的图解一针一针钩。',
    pattern: formatPattern(rounds, 'zh'),
    rounds,
    tips: [],
  }
}

export function customLevelToLevel(l: CustomLevel): Level {
  return {
    id: l.id,
    title: l.title,
    description: l.source === 'work' ? '由「我的作品」保存的关卡，按自己钩过的针法再钩一遍。' : '由粘贴的图解保存的关卡。',
    pattern: formatPattern(l.rounds, 'zh'),
    rounds: l.rounds,
    tips: [],
    custom: true,
    doneTitle: `${l.title} 完成！🎉`,
  }
}
