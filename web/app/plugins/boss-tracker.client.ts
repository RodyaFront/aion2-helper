import { watch } from 'vue'
import { notifyNative } from '../../shared/notify'
import { applyRaceDocumentTheme } from '../../shared/race'
import { useBossStore } from '../../stores/bosses'
import { useFavoritesStore } from '../../stores/favorites'
import { useRiftStore } from '../../stores/rift'
import { useSettingsStore } from '../../stores/settings'
import { useAlertSound } from '../composables/useAlertSound'
import { useSpeechAlert } from '../composables/useSpeechAlert'

export default defineNuxtPlugin(() => {
  const store = useBossStore()
  const rift = useRiftStore()
  const settings = useSettingsStore()
  const favorites = useFavoritesStore()
  const { unlockAudio, playBossWarn, playRiftWarn, playRiftAlert } = useAlertSound()
  const { speakAlert, ensureVoices } = useSpeechAlert()

  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    void Notification.requestPermission().catch(() => {})
  }

  const unlock = () => {
    unlockAudio()
    ensureVoices()
  }
  window.addEventListener('pointerdown', unlock, { once: true })
  window.addEventListener('keydown', unlock, { once: true })
  ensureVoices()

  /** Every new toast = Windows notify + one sound + voice (no looping alarm). */
  let lastBossToastIds = new Set<string>()
  watch(
    () => store.toasts.map((t) => `${t.id}:${t.kind}:${t.warnTier ?? ''}`).join('|'),
    () => {
      for (const toast of store.toasts) {
        if (lastBossToastIds.has(toast.id)) continue
        if (!settings.alertsLive) continue
        notifyNative(toast.title, toast.body)
        if (toast.speech) speakAlert(toast.speech)
        if (!settings.bossSoundEnabled) continue
        if (toast.kind === 'ready') void playBossWarn('alert')
        else void playBossWarn(toast.warnTier ?? 'ping')
      }
      lastBossToastIds = new Set(store.toasts.map((t) => t.id))
    },
  )

  let lastRiftToastKey = ''
  watch(
    () => rift.toast ? `${rift.toast.id}:${rift.toast.kind}` : '',
    (key) => {
      if (!key || key === lastRiftToastKey || !rift.toast) {
        lastRiftToastKey = key
        return
      }
      lastRiftToastKey = key
      if (!settings.alertsLive) return
      notifyNative(rift.toast.title, rift.toast.body)
      // Banner mute (riftSoundEnabled) silences both bed SFX and rift voice.
      if (!settings.riftSoundEnabled) return
      if (rift.toast.speech) speakAlert(rift.toast.speech)
      if (rift.toast.kind === 'warn') playRiftWarn()
      else playRiftAlert()
    },
  )

  const offFocus = window.aionTracker?.onFocusApp?.(() => {})

  const offBossKill = window.aionTracker?.onBossKill?.((payload) => {
    if (!store.hydrated || !settings.hydrated) return
    if (!settings.autoKillTrackEnabled) return
    const def = store.ensureTrackedAndMarkKilled(payload.npcId, settings.regionId)
    if (!def) return
    if (settings.alertsLive) notifyNative('Таймер', def.nameRu || def.name)
  })

  const offFieldSync = window.aionTracker?.onFieldSync?.((payload) => {
    if (!store.hydrated || !settings.hydrated) return
    if (!settings.autoKillTrackEnabled) return
    if (!payload?.bosses?.length) return
    store.offerFieldSync(payload.bosses, settings.regionId)
  })

  let timer: ReturnType<typeof setInterval> | undefined

  watch(
    () => settings.regionId,
    (regionId) => {
      if (!store.hydrated) return
      store.setRegion(regionId)
    },
  )

  // Default theme before async hydrate (elyos) so first paint is not unthemed.
  applyRaceDocumentTheme(settings.race)

  void (async () => {
    await settings.hydrate()
    await favorites.hydrate()
    await store.hydrate()
    store.setRegion(settings.regionId)
    store.query = ''
    // Default-on: if user wants auto-timer (default true) and Npcap is there — start watcher.
    // Do not wipe the preference on transient start failures.
    if (settings.autoKillTrackEnabled && window.aionTracker?.ensureAutoKillTrack) {
      const status = await window.aionTracker.ensureAutoKillTrack()
      if (status.status === 'missing_npcap') {
        // Driver missing — keep preference; banner shows install CTA.
      }
      else if (status.enabled) {
        settings.setAutoKillTrackEnabled(true)
      }
    }
    else if (settings.autoKillTrackEnabled && window.aionTracker?.setAutoKillTrack) {
      await window.aionTracker.setAutoKillTrack(true)
    }
    rift.tick()
    timer = setInterval(() => {
      store.tick()
      rift.tick()
    }, 250)
  })()

  const flush = () => {
    if (store.hydrated) store.persist()
    if (settings.hydrated) settings.persist()
    if (favorites.hydrated) favorites.persist()
  }
  window.addEventListener('pagehide', flush)
  window.addEventListener('beforeunload', flush)

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      if (timer) clearInterval(timer)
      offFocus?.()
      offBossKill?.()
      offFieldSync?.()
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('beforeunload', flush)
    })
  }
})
