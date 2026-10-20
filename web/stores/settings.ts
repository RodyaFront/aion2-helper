import { defineStore } from 'pinia'
import { loadPersisted, savePersisted } from '../shared/persist'
import {
  applyRaceDocumentTheme,
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
    /**
     * Force-mute: blocks sound, voice, and Windows notify without changing other toggles.
     * Other settings keep their values; this layers on top.
     */
    alertsMuted: false,
    /** Auto-start respawn timers from Npcap boss-death capture (Electron only). Default on. */
    autoKillTrackEnabled: true,
    /** Once true, we stop resetting autoKillTrackEnabled to default-on after upgrades. */
    autoKillTrackUserSet: false,
  }),

  getters: {
    /** Active field region for the selected race */
    regionId(state): RegionId {
      return regionForRace(state.race)
    },
    /** Linear gain 0–1 for Web Audio peaks and TTS volume (0 when force-muted). */
    alertGain(state): number {
      if (state.alertsMuted) return 0
      return clampVolume(state.alertVolume) / 100
    },
    /** False when global mute is on - outbound alerts must no-op. */
    alertsLive(state): boolean {
      return !state.alertsMuted
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
        alertsMuted?: boolean
        autoKillTrackEnabled?: boolean
        autoKillTrackUserSet?: boolean
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
      if (typeof parsed?.alertsMuted === 'boolean') {
        this.alertsMuted = parsed.alertsMuted
      }
      // Older builds wiped "enabled" to false on start races — only honor saved
      // value after the user explicitly toggles (autoKillTrackUserSet).
      if (parsed?.autoKillTrackUserSet === true && typeof parsed.autoKillTrackEnabled === 'boolean') {
        this.autoKillTrackEnabled = parsed.autoKillTrackEnabled
        this.autoKillTrackUserSet = true
      }
      else {
        this.autoKillTrackEnabled = true
        this.autoKillTrackUserSet = false
      }
      applyRaceDocumentTheme(this.race)
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
        alertsMuted: this.alertsMuted,
        autoKillTrackEnabled: this.autoKillTrackEnabled,
        autoKillTrackUserSet: this.autoKillTrackUserSet,
      })
    },

    setRace(value: PlayerRace) {
      this.race = normalizeRace(value)
      applyRaceDocumentTheme(this.race)
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

    /** Force mute only - does not flip boss/rift/tts toggles or volume. */
    setAlertsMuted(value: boolean) {
      this.alertsMuted = Boolean(value)
      this.persist()
    },

    setAutoKillTrackEnabled(value: boolean) {
      this.autoKillTrackEnabled = Boolean(value)
      this.autoKillTrackUserSet = true
      this.persist()
    },
  },
})
