import type { SpeechPayload } from '../../shared/speakLines'
import { useSettingsStore } from '../../stores/settings'

let voicesReady = false
let enVoice: SpeechSynthesisVoice | null = null
let ruVoice: SpeechSynthesisVoice | null = null
let voicesWait: Promise<void> | null = null

const EN_VOICE_NAME_PREF = [
  'zira',
  'aria',
  'jenny',
  'guy',
  'sara',
  'david',
  'mark',
  'susan',
  'hazel',
  'google us english',
  'google uk english',
]

const RU_VOICE_NAME_PREF = [
  'irina',
  'ekaterina',
  'pavel',
  'google русский',
  'google russian',
]

function normalizeLang(lang: string): string {
  return lang.replace(/_/g, '-').toLowerCase()
}

function langMatches(voice: SpeechSynthesisVoice, prefixes: string[]): boolean {
  const lang = normalizeLang(voice.lang)
  return prefixes.some((p) => {
    const needle = p.toLowerCase()
    return lang === needle || lang.startsWith(`${needle}-`)
  })
}

function scoreByName(voice: SpeechSynthesisVoice, prefs: string[]): number {
  const name = voice.name.toLowerCase()
  const idx = prefs.findIndex((p) => name.includes(p))
  return idx === -1 ? prefs.length + 1 : idx
}

function pickVoice(
  voices: SpeechSynthesisVoice[],
  langPrefixes: string[],
  namePrefs: string[],
  preferLang?: string,
): SpeechSynthesisVoice | null {
  const matches = voices.filter((v) => langMatches(v, langPrefixes))
  if (!matches.length) return null

  const local = matches.filter((v) => v.localService)
  const pool = local.length ? local : matches

  const prefer = preferLang ? normalizeLang(preferLang) : null
  pool.sort((a, b) => {
    const nameDelta = scoreByName(a, namePrefs) - scoreByName(b, namePrefs)
    if (nameDelta !== 0) return nameDelta
    if (prefer) {
      const aPref = normalizeLang(a.lang) === prefer ? 0 : 1
      const bPref = normalizeLang(b.lang) === prefer ? 0 : 1
      if (aPref !== bPref) return aPref - bPref
    }
    return a.name.localeCompare(b.name)
  })

  return pool[0] ?? null
}

function refreshVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return
  enVoice = pickVoice(voices, ['en'], EN_VOICE_NAME_PREF, 'en-US')
  ruVoice = pickVoice(voices, ['ru'], RU_VOICE_NAME_PREF, 'ru-RU')
  voicesReady = true
}

function whenVoicesReady(): Promise<void> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return Promise.resolve()
  refreshVoices()
  if (voicesReady) return Promise.resolve()

  if (!voicesWait) {
    voicesWait = new Promise((resolve) => {
      const finish = () => {
        refreshVoices()
        window.speechSynthesis.removeEventListener('voiceschanged', onChange)
        window.clearInterval(poll)
        resolve()
      }

      const onChange = () => {
        refreshVoices()
        if (voicesReady) finish()
      }

      window.speechSynthesis.addEventListener('voiceschanged', onChange)

      let attempts = 0
      const poll = window.setInterval(() => {
        attempts += 1
        refreshVoices()
        if (voicesReady || attempts >= 10) finish()
      }, 50)
    })
  }

  return voicesWait
}

function ensureVoices() {
  void whenVoicesReady()
}

function currentTtsVolume(): number {
  try {
    const settings = useSettingsStore()
    if (!settings.alertsLive || !settings.ttsEnabled) return 0
    return Math.max(0, Math.min(1, settings.alertGain))
  }
  catch {
    return 0.8
  }
}

function speakWebUtterance(utterance: SpeechSynthesisUtterance): Promise<void> {
  return new Promise((resolve) => {
    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()
    window.speechSynthesis.speak(utterance)
  })
}

function hasNativeSpeak(): boolean {
  return typeof window !== 'undefined' && typeof window.aionTracker?.speak === 'function'
}

async function speakNative(text: string, lang: string, volume01: number) {
  const api = window.aionTracker
  if (!api?.speak) return
  await api.speak({
    text,
    lang,
    volume: Math.round(Math.max(0, Math.min(1, volume01)) * 100),
  })
}

export function useSpeechAlert() {
  async function speakAlert(payload: SpeechPayload) {
    if (typeof window === 'undefined') return
    const volume = currentTtsVolume()
    if (volume <= 0) return

    if (window.speechSynthesis) window.speechSynthesis.cancel()
    window.aionTracker?.stopSpeak?.()

    const enName = payload.enName?.trim()
    const ruText = payload.ru?.trim()

    // Electron path: Piper (or SAPI fallback) for both languages.
    if (hasNativeSpeak()) {
      if (enName) await speakNative(enName, 'en-US', volume)
      if (ruText) await speakNative(ruText, 'ru-RU', volume)
      return
    }

    // Browser fallback: Web Speech API.
    await whenVoicesReady()
    refreshVoices()

    if (enName) {
      const en = new SpeechSynthesisUtterance(enName)
      if (enVoice) {
        en.voice = enVoice
        en.lang = enVoice.lang || 'en-US'
      }
      else {
        en.lang = 'en-US'
      }
      en.rate = 0.95
      en.volume = volume
      await speakWebUtterance(en)
    }

    if (ruText) {
      const ru = new SpeechSynthesisUtterance(ruText)
      if (ruVoice) {
        ru.voice = ruVoice
        ru.lang = ruVoice.lang || 'ru-RU'
      }
      else {
        ru.lang = 'ru-RU'
      }
      ru.rate = 0.95
      ru.volume = volume
      await speakWebUtterance(ru)
    }
  }

  function stopSpeech() {
    if (typeof window === 'undefined') return
    if (window.speechSynthesis) window.speechSynthesis.cancel()
    window.aionTracker?.stopSpeak?.()
  }

  return { speakAlert, stopSpeech, ensureVoices }
}
