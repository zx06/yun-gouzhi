/** 显示与音效设置（独立 key，不影响作品存档）。 */
export type ViewMode = '3d' | '2d'

export interface Settings {
  /** null = 还没选过，按设备能力自动决定 */
  view: ViewMode | null
  muted: boolean
}

export const SETTINGS_KEY = 'yun-gouzhi-settings-v1'

export const defaultSettings = (): Settings => ({ view: null, muted: false })

interface KV {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function parseSettings(raw: string | null): Settings {
  const d = defaultSettings()
  if (!raw) return d
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    if (!o || typeof o !== 'object') return d
    return {
      view: o.view === '3d' || o.view === '2d' ? o.view : null,
      muted: o.muted === true,
    }
  } catch {
    return d
  }
}

export function loadSettings(kv: KV): Settings {
  try {
    return parseSettings(kv.getItem(SETTINGS_KEY))
  } catch {
    return defaultSettings()
  }
}

export function saveSettings(kv: KV, s: Settings): boolean {
  try {
    kv.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, view: s.view, muted: s.muted }))
    return true
  } catch {
    return false
  }
}

/** 实际使用的视图：用户选过就用用户的；否则有 WebGL 才默认 3D。3D 需要 WebGL，没有时总是 2D。 */
export function resolveView(s: Settings, webgl: boolean): ViewMode {
  if (!webgl) return '2d'
  return s.view ?? '3d'
}
