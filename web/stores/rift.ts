import { defineStore } from 'pinia'
import { formatCountdown } from '../shared/bosses'
import {
  formatRiftClock,
  formatRiftClockLocal,
  getRiftBannerMode,
  getRiftSnapshot,
  RIFT_WARN_MS,
  RIFT_WARN_THRESHOLDS_MS,
  type RiftBannerMode,
  type RiftPhase,
} from '../shared/rift'
import { riftOpenSpeech, riftWarnSpeech, type SpeechPayload } from '../shared/speakLines'

export type RiftToastKind = 'warn' | 'open'

export type RiftToast = {
  id: string
  kind: RiftToastKind
  title: string
  body: string
  speech: SpeechPayload
}

function warnKey(opensAt: number, thresholdMs: number): string {
  return `${opensAt}:${thresholdMs}`
}

export const useRiftStore = defineStore('rift', {
  state: () => ({
    now: Date.now(),
    phase: 'closed' as RiftPhase,
    windowStartAt: null as number | null,
    portalClosesAt: null as number | null,
    nextOpensAt: Date.now(),
    eventEndsAt: null as number | null,
    lastAlertedOpenAt: null as number | null,
    /** Keys `${nextOpensAt}:${thresholdMs}` already warned */
    firedWarnKeys: [] as string[],
    ready: false,
    toast: null as null | RiftToast,
  }),

  getters: {
    isPortalOpen(state): boolean {
      return state.phase === 'open'
    },
    portalCountdown(state): string {
      if (state.portalClosesAt == null) return '—'
      return formatCountdown((state.portalClosesAt - state.now) / 1000)
    },
    nextCountdown(state): string {
      return formatCountdown((state.nextOpensAt - state.now) / 1000)
    },
    nextOpenLabel(state): string {
      return formatRiftClock(state.nextOpensAt)
    },
    nextOpenLabelLocal(state): string {
      return formatRiftClockLocal(state.nextOpensAt)
    },
    eventCountdown(state): string | null {
      if (state.eventEndsAt == null || state.now >= state.eventEndsAt) return null
      return formatCountdown((state.eventEndsAt - state.now) / 1000)
    },
    bannerMode(state): RiftBannerMode {
      return getRiftBannerMode(
        {
          phase: state.phase,
          windowStartAt: state.windowStartAt,
          portalClosesAt: state.portalClosesAt,
          nextOpensAt: state.nextOpensAt,
          eventEndsAt: state.eventEndsAt,
        },
        state.now,
      )
    },
    statusLabel(state): string {
      return state.phase === 'open' ? 'Портал открыт' : 'Портал закрыт'
    },
  },

  actions: {
    hasFiredWarn(opensAt: number, thresholdMs: number): boolean {
      return this.firedWarnKeys.includes(warnKey(opensAt, thresholdMs))
    },

    markFiredWarn(opensAt: number, thresholdMs: number) {
      const key = warnKey(opensAt, thresholdMs)
      if (!this.firedWarnKeys.includes(key)) {
        this.firedWarnKeys = [...this.firedWarnKeys, key]
      }
    },

    /** Drop warn keys for other openings so the list stays small. */
    pruneWarnKeys(opensAt: number) {
      const prefix = `${opensAt}:`
      this.firedWarnKeys = this.firedWarnKeys.filter((k) => k.startsWith(prefix))
    },

    tick(now = Date.now()) {
      this.now = now
      const snap = getRiftSnapshot(now)
      const prevPhase = this.phase

      this.phase = snap.phase
      this.windowStartAt = snap.windowStartAt
      this.portalClosesAt = snap.portalClosesAt
      this.nextOpensAt = snap.nextOpensAt
      this.eventEndsAt = snap.eventEndsAt

      if (!this.ready) {
        if (snap.phase === 'open' && snap.windowStartAt != null) {
          this.lastAlertedOpenAt = snap.windowStartAt
          for (const t of RIFT_WARN_THRESHOLDS_MS) {
            this.markFiredWarn(snap.windowStartAt, t)
          }
          this.ready = true
          return
        }

        this.ready = true
        const msToOpen = snap.nextOpensAt - now
        this.pruneWarnKeys(snap.nextOpensAt)

        if (msToOpen > 0 && msToOpen <= RIFT_WARN_MS) {
          // Late join: mark coarser thresholds, fire the tightest still applicable.
          let fireMs: number | null = null
          for (const t of [...RIFT_WARN_THRESHOLDS_MS].sort((a, b) => a - b)) {
            if (msToOpen <= t) {
              fireMs = t
              break
            }
          }
          for (const t of RIFT_WARN_THRESHOLDS_MS) {
            if (fireMs != null && t > fireMs) this.markFiredWarn(snap.nextOpensAt, t)
          }
          if (fireMs != null) {
            this.markFiredWarn(snap.nextOpensAt, fireMs)
            this.alertWarn(fireMs)
          }
        }
        return
      }

      if (snap.phase === 'closed') {
        const msToOpen = snap.nextOpensAt - now
        this.pruneWarnKeys(snap.nextOpensAt)
        // Fire larger lead times first (15m, then 10m) when crossing.
        for (const t of RIFT_WARN_THRESHOLDS_MS) {
          if (msToOpen > 0 && msToOpen <= t && !this.hasFiredWarn(snap.nextOpensAt, t)) {
            this.markFiredWarn(snap.nextOpensAt, t)
            this.alertWarn(t)
          }
        }
      }

      if (
        snap.phase === 'open'
        && snap.windowStartAt != null
        && snap.windowStartAt !== this.lastAlertedOpenAt
        && prevPhase === 'closed'
      ) {
        this.lastAlertedOpenAt = snap.windowStartAt
        for (const t of RIFT_WARN_THRESHOLDS_MS) {
          this.markFiredWarn(snap.windowStartAt, t)
        }
        this.alertOpened()
      }
    },

    alertWarn(thresholdMs: number = RIFT_WARN_MS) {
      const mins = Math.round(thresholdMs / 60000)
      const title = `Разлом через ${mins} мин`
      const body = `Портал откроется в ${formatRiftClockLocal(this.nextOpensAt)}.`
      this.toast = {
        id: `rift-warn-${mins}-${this.nextOpensAt}-${Date.now()}`,
        kind: 'warn',
        title,
        body,
        speech: riftWarnSpeech(mins),
      }
    },

    alertOpened() {
      const title = 'Разлом открыт'
      this.toast = {
        id: `rift-open-${this.windowStartAt ?? 'manual'}-${Date.now()}`,
        kind: 'open',
        title,
        body: '',
        speech: riftOpenSpeech(),
      }
    },

    dismissToast() {
      this.toast = null
    },
  },
})
