import type { BossWarnTier } from '../../shared/bosses'
import { useSettingsStore } from '../../stores/settings'

let ctx: AudioContext | null = null

const SAMPLE_URLS: Record<BossWarnTier, string> = {
  ping: '/sounds/boss-ping.ogg',
  warning: '/sounds/boss-warning.ogg',
  alert: '/sounds/boss-alert.ogg',
}

/** Bed under rift TTS — ~60% of voice (alertGain). */
const RIFT_BED_URL = '/sounds/rift-riser-bed.ogg'
/** Relative to alertGain / TTS volume. */
const RIFT_BED_PEAK = 0.6

/** Runtime peaks aligned to urgency brief (files already laddered). */
const TIER_PEAK: Record<BossWarnTier, number> = {
  ping: 0.5,
  warning: 0.62,
  alert: 0.75,
}

const bufferCache = new Map<string, AudioBuffer | null>()
const loadJobs = new Map<string, Promise<AudioBuffer | null>>()

function getCtx(): AudioContext | null {
  if (!import.meta.client) return null
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  return ctx
}

function currentGain(): number {
  try {
    const settings = useSettingsStore()
    if (!settings.alertsLive) return 0
    return settings.alertGain
  }
  catch {
    return 0.8
  }
}

async function loadBuffer(url: string): Promise<AudioBuffer | null> {
  if (bufferCache.has(url)) return bufferCache.get(url) ?? null
  const existing = loadJobs.get(url)
  if (existing) return existing

  const job = (async () => {
    const audio = getCtx()
    if (!audio) return null
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const raw = await res.arrayBuffer()
      const buf = await audio.decodeAudioData(raw.slice(0))
      bufferCache.set(url, buf)
      return buf
    }
    catch {
      bufferCache.set(url, null)
      return null
    }
    finally {
      loadJobs.delete(url)
    }
  })()

  loadJobs.set(url, job)
  return job
}

function playBuffer(buffer: AudioBuffer, peak = 0.9, playbackRate = 1) {
  const audio = getCtx()
  if (!audio) return
  const gainMul = currentGain()
  if (gainMul <= 0) return
  void audio.resume()
  const src = audio.createBufferSource()
  const gain = audio.createGain()
  src.buffer = buffer
  src.playbackRate.value = playbackRate
  gain.gain.value = Math.max(0.0001, peak * gainMul)
  src.connect(gain)
  gain.connect(audio.destination)
  src.start()
}

function tone(
  audio: AudioContext,
  freq: number,
  start: number,
  duration: number,
  peak = 0.12,
  type: OscillatorType = 'sine',
) {
  const scaled = Math.max(0.0001, peak * currentGain())
  if (scaled <= 0.0001 && currentGain() <= 0) return

  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = type
  osc.frequency.value = freq
  const attack = Math.min(0.06, duration * 0.35)
  const release = Math.min(0.22, duration * 0.55)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(scaled, start + attack)
  gain.gain.exponentialRampToValueAtTime(
    Math.max(0.0001, scaled * 0.55),
    start + duration - release,
  )
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain)
  gain.connect(audio.destination)
  osc.start(start)
  osc.stop(start + duration + 0.03)
}

function fallbackTier(tier: BossWarnTier) {
  const audio = getCtx()
  if (!audio || currentGain() <= 0) return
  void audio.resume()
  const now = audio.currentTime
  if (tier === 'ping') {
    tone(audio, 780, now, 0.28, 0.08, 'sine')
  }
  else if (tier === 'warning') {
    ;[820, 980].forEach((freq, i) => {
      tone(audio, freq, now + i * 0.22, 0.24, 0.1, 'sine')
    })
  }
  else {
    ;[900, 1000, 1100, 1175].forEach((freq, i) => {
      tone(audio, freq, now + i * 0.14, 0.16, 0.12, 'sine')
    })
  }
}

export function useAlertSound() {
  function unlockAudio() {
    const audio = getCtx()
    if (!audio) return
    void audio.resume()
    for (const url of Object.values(SAMPLE_URLS)) {
      void loadBuffer(url)
    }
    void loadBuffer(RIFT_BED_URL)
  }

  async function playBossWarn(tier: BossWarnTier = 'ping') {
    if (currentGain() <= 0) return
    const url = SAMPLE_URLS[tier]
    const buf = await loadBuffer(url)
    if (buf) {
      playBuffer(buf, TIER_PEAK[tier])
      return
    }
    fallbackTier(tier)
  }

  function playAlert() {
    void playBossWarn('ping')
  }

  /** Sub-bass riser bed under rift voice (CC-BY MarwanAntonios). */
  async function playRiftBed() {
    if (currentGain() <= 0) return
    const buf = await loadBuffer(RIFT_BED_URL)
    if (buf) {
      playBuffer(buf, RIFT_BED_PEAK)
      return
    }
    // Fallback if sample missing: short low swell.
    const audio = getCtx()
    if (!audio) return
    void audio.resume()
    const now = audio.currentTime
    ;[196, 247].forEach((freq, i) => {
      tone(audio, freq, now + i * 0.2, 0.4, 0.08, 'sine')
    })
  }

  function playRiftWarn() {
    void playRiftBed()
  }

  function playRiftAlert() {
    void playRiftBed()
  }

  return {
    unlockAudio,
    playAlert,
    playBossWarn,
    playRiftWarn,
    playRiftAlert,
  }
}
