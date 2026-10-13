import { watch } from 'vue'
import { notifyNative } from '../../shared/notify'
import { useBossStore } from '../../stores/bosses'
import { useRiftStore } from '../../stores/rift'
import { useSettingsStore } from '../../stores/settings'
import { useAlertSound } from '../composables/useAlertSound'
import { useSpeechAlert } from '../composables/useSpeechAlert'

export default defineNuxtPlugin(() => {
  const store = useBossStore()
  const rift = useRiftStore()
  const settings = useSettingsStore()
  const { unlockAudio, playBossWarn, playRiftWarn, playRiftAlert, startAlarmLoop, stopAlarmLoop } = useAlertSound()
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

  /** Every new toast = Windows notify + SFX + TTS (ready: TTS once, alarm loop separate). */
  let lastBossToastIds = new Set<string>()
  watch(
    () => store.toasts.map((t) => `${t.id}:${t.kind}:${t.warnTier ?? ''}`).join('|'),
    () => {
      for (const toast of store.toasts) {
        if (lastBossToastIds.has(toast.id)) continue
        notifyNative(toast.title, toast.body)
        if (toast.speech) speakAlert(toast.speech)
        if (toast.kind === 'warn') {
          void playBossWarn(toast.warnTier ?? 'ping')
        }
      }
      lastBossToastIds = new Set(store.toasts.map((t) => t.id))
    },
  )

  watch(
    () => store.isAlarming,
    (alarming) => {
      if (alarming) startAlarmLoop()
      else stopAlarmLoop()
      window.aionTracker?.setAlarming?.(alarming)
    },
    { immediate: true },
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
      notifyNative(rift.toast.title, rift.toast.body)
      if (rift.toast.speech) speakAlert(rift.toast.speech)
      if (rift.toast.kind === 'warn') playRiftWarn()
      else playRiftAlert()
    },
  )

  const offFocus = window.aionTracker?.onFocusApp?.(() => {})

  let timer: ReturnType<typeof setInterval> | undefined

  void (async () => {
    await settings.hydrate()
    await store.hydrate()
    store.query = ''
    rift.tick()
    timer = setInterval(() => {
      store.tick()
      rift.tick()
    }, 250)
  })()

  const flush = () => {
    if (store.hydrated) store.persist()
    if (settings.hydrated) settings.persist()
  }
  window.addEventListener('pagehide', flush)
  window.addEventListener('beforeunload', flush)

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      if (timer) clearInterval(timer)
      stopAlarmLoop()
      offFocus?.()
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('beforeunload', flush)
    })
  }
})
