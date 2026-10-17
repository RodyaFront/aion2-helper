import { defineStore } from 'pinia'
import { loadPersisted, savePersisted } from '../shared/persist'
import {
  normalizeRace,
  regionForRace,
  type PlayerRace,
  type RegionId,
} from '../shared/race'

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 80
  return Math.min(100, Math.max(0, Math.round(value)))
}

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    hydrated: false,
    /** Player faction: drives active region for bosses and maps */
    race: 'elyos' as PlayerRace,
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
    /** Active field region for the selected race */
    regionId(state): RegionId {
      return regionForRace(state.race)
    },
    /** Linear gain 0–1 for Web Audio peaks and TTS volume */
    alertGain(state): number {
      return clampVolume(state.alertVolume) / 100
    },
  },

  actions: {
    async hydrate() {
      if (!import.meta.client || this.hydrated) return
      const parsed = await loadPersisted<{
        race?: PlayerRace
        alertVolume?: number
        bossSoundEnabled?: boolean
        riftSoundEnabled?: boolean
        ttsEnabled?: boolean
      }>('settings')
      if (parsed?.race != null) {
        this.race = normalizeRace(parsed.race)
      }
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
        race: this.race,
        alertVolume: this.alertVolume,
        bossSoundEnabled: this.bossSoundEnabled,
        riftSoundEnabled: this.riftSoundEnabled,
        ttsEnabled: this.ttsEnabled,
      })
    },

    setRace(value: PlayerRace) {
      this.race = normalizeRace(value)
      this.persist()
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
