export interface AionTrackerBridge {
  notify: (payload: { title: string, body: string }) => void
  setAlarming: (active: boolean) => void
  /** Windows SAPI; used for EN names when Chromium getVoices() is empty. */
  speak?: (payload: { text: string, lang: string, volume: number }) => Promise<boolean>
  stopSpeak?: () => void
  onFocusApp: (handler: () => void) => () => void
  loadState: (key: 'bosses' | 'settings') => Promise<unknown>
  saveState: (key: 'bosses' | 'settings', data: unknown) => Promise<void>
}

declare global {
  interface Window {
    aionTracker?: AionTrackerBridge
  }
}

export {}
