import { defineStore } from 'pinia'
import { loadPersisted, savePersisted } from '../shared/persist'

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 80
  return Math.min(100, Math.max(0, Math.round(value)))
}

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    hydrated: false,
    /** 0–100 UI percent; applied as gain multiplier for alerts/alarm/TTS */
    alertVolume: 80,
    /** Boss warn SFX and respawn alarm loop */
    bossSoundEnabled: true,
    /** Rift warn and open SFX */
    riftSoundEnabled: true,
    /** Web Speech API voice alerts */
    ttsEnabled: true,
  }),

  getters: {
    /** Linear gain 0–1 for Web Audio peaks and TTS volume */
    alertGain(state): number {
      return clampVolume(state.alertVolume) / 100
    },
  },

  actions: {
    async hydrate() {
      if (!import.meta.client || this.hydrated) return
      const parsed = await loadPersisted<{
        alertVolume?: number
        bossSoundEnabled?: boolean
        riftSoundEnabled?: boolean
        ttsEnabled?: boolean
      }>('settings')
      if (parsed?.alertVolume != null) {
        this.alertVolume = clampVolume(parsed.alertVolume)
      }
      if (typeof parsed?.bossSoundEnabled === 'boolean') {
        this.bossSoundEnabled = parsed.bossSoundEnabled
      }
      if (typeof parsed?.riftSoundEnabled === 'boolean') {
        this.riftSoundEnabled = parsed.riftSoundEnabled
      }
      if (typeof parsed?.ttsEnabled === 'boolean') {
        this.ttsEnabled = parsed.ttsEnabled
      }
      this.hydrated = true
    },

    persist() {
      if (!import.meta.client || !this.hydrated) return
      void savePersisted('settings', {
        alertVolume: this.alertVolume,
        bossSoundEnabled: this.bossSoundEnabled,
        riftSoundEnabled: this.riftSoundEnabled,
        ttsEnabled: this.ttsEnabled,
      })
    },

    setAlertVolume(value: number) {
      this.alertVolume = clampVolume(value)
      this.persist()
    },

    setBossSoundEnabled(value: boolean) {
      this.bossSoundEnabled = Boolean(value)
      this.persist()
    },

    setRiftSoundEnabled(value: boolean) {
      this.riftSoundEnabled = Boolean(value)
      this.persist()
    },

    setTtsEnabled(value: boolean) {
      this.ttsEnabled = Boolean(value)
      this.persist()
    },
  },
})
