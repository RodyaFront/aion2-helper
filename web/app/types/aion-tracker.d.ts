export type NpcapDetectResult = {
  ok: boolean
  status: 'ok' | 'missing' | 'error' | string
  location?: string | null
  downloadUrl?: string
  message?: string
  exitCode?: number | null
}

export type AutoKillStatusPayload = {
  enabled: boolean
  status: 'off' | 'missing_npcap' | 'listening' | 'error' | 'starting' | string
  message: string
  hasSidecar: boolean
}

export type BossKillPayload = {
  npcId: number
  at?: number
  entityId?: number
}

export type FieldSyncEntry = {
  npcId: number
  alive: boolean
  /** Unix ms when the boss returns; null if up / ready. */
  respawnAt: number | null
}

export type FieldSyncPayload = {
  at?: number
  bosses: FieldSyncEntry[]
}

export interface AionTrackerBridge {
  notify: (payload: { title: string, body: string }) => void
  /** Windows SAPI; used for EN names when Chromium getVoices() is empty. */
  speak?: (payload: { text: string, lang: string, volume: number }) => Promise<boolean>
  stopSpeak?: () => void
  onFocusApp: (handler: () => void) => () => void
  loadState: (key: 'bosses' | 'settings' | 'favorites') => Promise<unknown>
  saveState: (key: 'bosses' | 'settings' | 'favorites', data: unknown) => Promise<void>
  detectNpcap?: () => Promise<NpcapDetectResult>
  getAutoKillStatus?: () => Promise<AutoKillStatusPayload>
  setAutoKillTrack?: (enabled: boolean) => Promise<AutoKillStatusPayload>
  /** Start auto-timer when Npcap is installed (app launch default-on). */
  ensureAutoKillTrack?: () => Promise<AutoKillStatusPayload & { detect?: NpcapDetectResult }>
  onBossKill?: (handler: (payload: BossKillPayload) => void) => () => void
  onFieldSync?: (handler: (payload: FieldSyncPayload) => void) => () => void
  onAutoKillStatus?: (handler: (payload: AutoKillStatusPayload) => void) => () => void
  openExternal?: (url: string) => Promise<boolean>
}

declare global {
  interface Window {
    aionTracker?: AionTrackerBridge
  }
}

export {}
