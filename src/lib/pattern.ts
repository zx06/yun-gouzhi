/**
 * 图解解析 / 生成 / 数针。
 * 支持中文符号写法（X 短针 / V 加针 / A 减针 / O 锁针，`6X`、`(X,V)*6`）
 * 与英文写法（sc / inc / dec / ch，`6 sc`、`(sc, inc) x6`、`sc2tog`）。
 */
import { STITCH_COST, stitchSymbol, type Notation, type StitchType } from '../types/stitch'

export interface ParsedRound {
  /** 1-based round number */
  round: number
  stitches: StitchType[]
  /** stitch count written in the pattern, e.g. `(18)` — optional */
  declaredCount?: number
}

export interface ParseResult {
  rounds: ParsedRound[]
  errors: string[]
}

export class PatternError extends Error {}

/** Stitches produced by a list of actions (= stitch count of that round). */
export function countProduced(actions: StitchType[]): number {
  return actions.reduce((n, a) => n + STITCH_COST[a].produce, 0)
}

/** Stitches of the previous round consumed by a list of actions. */
export function countConsumed(actions: StitchType[]): number {
  return actions.reduce((n, a) => n + STITCH_COST[a].consume, 0)
}

export interface RoundCheck {
  round: number
  count: number
  consumed: number
  expectedConsumed: number | null
  ok: boolean
  message?: string
}

/** Validate a full pattern: each round ≥2 must work exactly into every stitch of the previous round. */
export function checkRounds(rounds: StitchType[][], declared?: (number | undefined)[]): RoundCheck[] {
  const out: RoundCheck[] = []
  let prev: number | null = null
  rounds.forEach((r, i) => {
    const count = countProduced(r)
    const consumed = countConsumed(r)
    let ok = true
    let message: string | undefined
    if (prev !== null && consumed !== prev) {
      ok = false
      message = `第 ${i + 1} 圈用掉 ${consumed} 针，但上一圈有 ${prev} 针`
    }
    const d = declared?.[i]
    if (ok && d !== undefined && d !== count) {
      ok = false
      message = `第 ${i + 1} 圈应为 ${d} 针，实际 ${count} 针`
    }
    out.push({ round: i + 1, count, consumed, expectedConsumed: prev, ok, message })
    prev = count
  })
  return out
}

// ---------------------------------------------------------------- parser

const STITCH_WORDS: [RegExp, StitchType][] = [
  [/^sc2tog/i, 'dec'],
  [/^invdec/i, 'dec'],
  [/^dec/i, 'dec'],
  [/^inc/i, 'inc'],
  [/^sc/i, 'sc'],
  [/^ch/i, 'ch'],
  [/^短针/, 'sc'],
  [/^加针/, 'inc'],
  [/^减针/, 'dec'],
  [/^锁针/, 'ch'],
  [/^X/, 'sc'],
  [/^V/, 'inc'],
  [/^A/, 'dec'],
  [/^O/, 'ch'],
]

/** Words that are allowed but carry no stitch (magic ring etc.). */
const IGNORED = /^(in\s+(an?\s+)?(mr|magic\s+ring)|into\s+(mr|magic\s+ring)|in\s+each(\s+st)?|around|mr|magic\s+ring|魔术环|魔术圈|环起|起针|each|sts|st|针|in|into|next|the|共|=|\.|;|:)/i

function normalize(s: string): string {
  return s
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[【［]/g, '[')
    .replace(/[】］]/g, ']')
    .replace(/[，、；;]/g, ',')
    .replace(/[＊×✕]/g, '*')
    .replace(/[：]/g, ':')
    .replace(/[\uFF10-\uFF19]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[ＸＶＡ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
}

/** Parse one round body like `(2X,V)*6` or `2 sc, inc x6` into stitches. */
export function parseRoundBody(body: string): StitchType[] {
  const src = normalize(body)
  let i = 0

  const skipWs = () => {
    while (i < src.length && /[\s,]/.test(src[i])) i++
  }
  const readInt = (): number | null => {
    const m = /^\d+/.exec(src.slice(i))
    if (!m) return null
    i += m[0].length
    return parseInt(m[0], 10)
  }
  /** `*6`, `x6`, `X 6` (X only directly after a group) */
  const readRepeat = (afterGroup: boolean): number | null => {
    const rest = src.slice(i)
    const re = afterGroup ? /^\s*(?:\*|x|X|times)\s*(\d+)(\s*times)?/ : /^\s*(?:\*|x)\s*(\d+)(\s*times)?/
    const m = re.exec(rest)
    if (!m) return null
    i += m[0].length
    return parseInt(m[1], 10)
  }

  const parseSeq = (closer: string | null): StitchType[] => {
    const out: StitchType[] = []
    for (;;) {
      skipWs()
      if (i >= src.length) {
        if (closer) throw new PatternError(`缺少右括号「${closer}」`)
        return out
      }
      if (closer && src[i] === closer) {
        i++
        return out
      }
      if (src[i] === ')' || src[i] === ']') throw new PatternError(`多余的「${src[i]}」`)

      const lead = readInt()
      skipWs()
      if (src[i] === '(' || src[i] === '[') {
        const close = src[i] === '(' ? ')' : ']'
        i++
        const inner = parseSeq(close)
        const rep = readRepeat(true) ?? lead ?? 1
        for (let k = 0; k < rep; k++) out.push(...inner)
        continue
      }
      const rest = src.slice(i)
      const ign = IGNORED.exec(rest)
      // A stitch word takes priority over ignore words only if it matches here.
      let matched: StitchType | null = null
      for (const [re, t] of STITCH_WORDS) {
        const m = re.exec(rest)
        if (m) {
          matched = t
          i += m[0].length
          break
        }
      }
      if (!matched) {
        if (ign && ign[0].length > 0) {
          i += ign[0].length
          if (lead !== null) {
            // `(18)` style declared counts are handled by the caller; a bare number before an ignore word is noise.
          }
          continue
        }
        if (lead !== null) throw new PatternError(`数字 ${lead} 后面缺少针法`)
        throw new PatternError(`看不懂「${rest.slice(0, 8)}」`)
      }
      let rep = readRepeat(false)
      if (rep === null && lead === null) {
        // trailing count like `ch 1` / `sc 6,`
        const m = /^\s*(\d+)(?=\s*(?:$|[,)\]]))/.exec(src.slice(i))
        if (m) {
          i += m[0].length
          rep = parseInt(m[1], 10)
        }
      }
      const n = (lead ?? 1) * (rep ?? 1)
      if (n > 500) throw new PatternError('针数太多（单项超过 500）')
      for (let k = 0; k < n; k++) out.push(matched)
    }
  }

  return parseSeq(null)
}

const ROUND_PREFIX =
  /^\s*(?:第\s*(\d+)\s*(?:[-~至到]\s*(\d+)\s*)?圈|(?:r|rnd|rnds|round|rounds|row)\s*(\d+)(?:\s*[-~]\s*(\d+))?|(\d+)(?:\s*[-~]\s*(\d+))?\s*圈)\s*[:.\s]?\s*/i

const DECLARED_COUNT = /[([]\s*(?:共\s*)?(\d+)\s*(?:针|sts?|stitches)?\s*[)\]]\s*$|(?:=|共)\s*(\d+)\s*(?:针|sts?|stitches)?\s*$|[-–—]\s*(\d+)\s*(?:针|sts?|stitches)\s*$/i

/** Parse a multi-line pattern. Each non-empty line is one round (or a range like `R4-6`). */
export function parsePattern(text: string): ParseResult {
  const rounds: ParsedRound[] = []
  const errors: string[] = []
  const lines = normalize(text).split(/\r?\n/)
  lines.forEach((raw, lineIdx) => {
    let line = raw.replace(/#.*$/, '').replace(/\/\/.*$/, '').trim()
    if (!line) return
    let from: number | null = null
    let to: number | null = null
    const m = ROUND_PREFIX.exec(line)
    if (m) {
      from = parseInt(m[1] ?? m[3] ?? m[5], 10)
      const t = m[2] ?? m[4] ?? m[6]
      to = t ? parseInt(t, 10) : from
      line = line.slice(m[0].length)
    }
    let declared: number | undefined
    const d = DECLARED_COUNT.exec(line)
    if (d) {
      declared = parseInt(d[1] ?? d[2] ?? d[3], 10)
      line = line.slice(0, d.index)
    }
    try {
      const stitches = parseRoundBody(line)
      if (stitches.length === 0) throw new PatternError('这一行没有针法')
      const times = from !== null && to !== null ? Math.max(1, to - from + 1) : 1
      if (times > 100) throw new PatternError('圈数范围太大')
      for (let k = 0; k < times; k++) {
        rounds.push({ round: rounds.length + 1, stitches: [...stitches], declaredCount: declared })
      }
    } catch (e) {
      errors.push(`第 ${lineIdx + 1} 行：${e instanceof Error ? e.message : String(e)}`)
    }
  })
  if (rounds.length > 0) {
    for (const c of checkRounds(
      rounds.map((r) => r.stitches),
      rounds.map((r) => r.declaredCount),
    )) {
      if (!c.ok && c.message) errors.push(c.message)
    }
  }
  return { rounds, errors }
}

// ---------------------------------------------------------------- formatter

function runs(actions: StitchType[]): [StitchType, number][] {
  const out: [StitchType, number][] = []
  for (const a of actions) {
    const last = out[out.length - 1]
    if (last && last[0] === a) last[1]++
    else out.push([a, 1])
  }
  return out
}

function formatRuns(actions: StitchType[], n: Notation): string {
  return runs(actions)
    .map(([t, c]) => {
      const s = stitchSymbol(t, n)
      if (c === 1) return s
      return n === 'zh' ? `${c}${s}` : `${c} ${s}`
    })
    .join(n === 'zh' ? ',' : ', ')
}

/** Smallest block that repeats ≥2 times to form the whole round, or null. */
export function findRepeat(actions: StitchType[]): { block: StitchType[]; times: number } | null {
  const len = actions.length
  for (let p = 2; p <= len / 2; p++) {
    if (len % p) continue
    let ok = true
    for (let i = p; i < len && ok; i++) if (actions[i] !== actions[i - p]) ok = false
    if (ok) return { block: actions.slice(0, p), times: len / p }
  }
  return null
}

/** Format one round's actions, e.g. `(X,V)*6` / `(sc, inc) x6`. */
export function formatRound(actions: StitchType[], n: Notation): string {
  if (actions.length === 0) return ''
  const r = runs(actions)
  if (r.length === 1) return formatRuns(actions, n)
  const rep = findRepeat(actions)
  if (rep && runs(rep.block).length > 1) {
    const inner = formatRuns(rep.block, n)
    return n === 'zh' ? `(${inner})*${rep.times}` : `(${inner}) x${rep.times}`
  }
  return formatRuns(actions, n)
}

/** Format whole pattern with round prefixes and stitch counts. */
export function formatPattern(rounds: StitchType[][], n: Notation): string {
  return rounds
    .filter((r) => r.length > 0)
    .map((r, i) => {
      const body = formatRound(r, n)
      const count = countProduced(r)
      const prefix = n === 'zh' ? `第${i + 1}圈：` : `Rnd ${i + 1}: `
      const head = i === 0 ? (n === 'zh' ? '魔术环 ' : 'MR, ') : ''
      return `${prefix}${head}${body} (${count})`
    })
    .join('\n')
}
