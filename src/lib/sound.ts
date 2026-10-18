/** 轻量音效：全部用 WebAudio 现场合成，不加载任何音频文件。 */
export type Sfx = 'stitch' | 'inc' | 'dec' | 'ch' | 'error' | 'round' | 'win' | 'tap'

type Note = { f: number; t: number; d: number; type?: OscillatorType; g?: number; slide?: number }

const PATCHES: Record<Sfx, Note[]> = {
  stitch: [{ f: 660, t: 0, d: 0.07, type: 'triangle', g: 0.18, slide: 880 }],
  inc: [
    { f: 660, t: 0, d: 0.06, type: 'triangle', g: 0.16, slide: 820 },
    { f: 880, t: 0.05, d: 0.07, type: 'triangle', g: 0.14, slide: 1040 },
  ],
  dec: [{ f: 620, t: 0, d: 0.09, type: 'triangle', g: 0.18, slide: 440 }],
  ch: [{ f: 990, t: 0, d: 0.04, type: 'sine', g: 0.12 }],
  error: [
    { f: 196, t: 0, d: 0.12, type: 'square', g: 0.07 },
    { f: 165, t: 0.1, d: 0.16, type: 'square', g: 0.07 },
  ],
  round: [
    { f: 784, t: 0, d: 0.12, type: 'sine', g: 0.16 },
    { f: 1175, t: 0.09, d: 0.2, type: 'sine', g: 0.14 },
  ],
  win: [
    { f: 523, t: 0, d: 0.14, type: 'triangle', g: 0.16 },
    { f: 659, t: 0.12, d: 0.14, type: 'triangle', g: 0.16 },
    { f: 784, t: 0.24, d: 0.14, type: 'triangle', g: 0.16 },
    { f: 1047, t: 0.36, d: 0.4, type: 'triangle', g: 0.18 },
  ],
  tap: [{ f: 520, t: 0, d: 0.03, type: 'sine', g: 0.08 }],
}

class SoundEngine {
  muted = false
  played = 0
  private ctx: AudioContext | null = null
  private master: GainNode | null = null

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.6
      this.master.connect(this.ctx.destination)
    } catch {
      this.ctx = null
    }
    return this.ctx
  }

  play(name: Sfx) {
    if (this.muted || typeof window === 'undefined') return
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
    const now = ctx.currentTime + 0.005
    for (const n of PATCHES[name]) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = n.type ?? 'sine'
      o.frequency.setValueAtTime(n.f, now + n.t)
      if (n.slide) o.frequency.exponentialRampToValueAtTime(n.slide, now + n.t + n.d)
      const peak = n.g ?? 0.15
      g.gain.setValueAtTime(0.0001, now + n.t)
      g.gain.exponentialRampToValueAtTime(peak, now + n.t + 0.008)
      g.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d)
      o.connect(g).connect(this.master)
      o.start(now + n.t)
      o.stop(now + n.t + n.d + 0.02)
    }
    this.played++
  }
}

export const sound = new SoundEngine()
