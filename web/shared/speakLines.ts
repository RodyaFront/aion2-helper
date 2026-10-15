import { READY_ALERT, type AlertThreshold } from './bosses'

export interface SpeechPayload {
  /** Spoken with en-US voice (boss English name). */
  enName?: string
  /** Spoken with ru-RU voice. */
  ru: string
}

function ruMinutes(n: number): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return `${n} минут`
  if (last === 1) return `${n} минуту`
  if (last >= 2 && last <= 4) return `${n} минуты`
  return `${n} минут`
}

function ruSeconds(n: number): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return `${n} секунд`
  if (last === 1) return `${n} секунду`
  if (last >= 2 && last <= 4) return `${n} секунды`
  return `${n} секунд`
}

/** Full Russian lead for TTS (not abbreviated toast copy). */
export function formatWarnLeadSpoken(sec: number): string {
  if (sec < 60) return ruSeconds(Math.round(sec))
  return ruMinutes(Math.round(sec / 60))
}

export function bossWarnSpeech(name: string, thresholdSec: number): SpeechPayload {
  return {
    enName: name,
    ru: `возродится через ${formatWarnLeadSpoken(thresholdSec)}.`,
  }
}

export function bossReadySpeech(name: string): SpeechPayload {
  return {
    enName: name,
    ru: 'возродился. Можно фармить.',
  }
}

export function bossAlertSpeech(name: string, threshold: AlertThreshold): SpeechPayload {
  if (threshold === READY_ALERT) return bossReadySpeech(name)
  return bossWarnSpeech(name, threshold)
}

export function riftWarnSpeech(mins: number): SpeechPayload {
  return {
    ru: `Разлом откроется через ${ruMinutes(mins)}.`,
  }
}

export function riftOpenSpeech(): SpeechPayload {
  return {
    ru: 'Разлом открыт.',
  }
}
