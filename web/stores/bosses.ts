import { defineStore } from 'pinia'
import {
  ALERT_THRESHOLDS_SEC,
  READY_ALERT,
  formatWarnLead,
  normalizeFiredAlerts,
  type AlertThreshold,
  type BossWarnTier,
  warnTierForThreshold,
  bossesForRegion,
  type BossRegionId,
  slugify,
} from '../shared/bosses'
import { isRegionId } from '../shared/race'
import { loadPersisted, savePersisted } from '../shared/persist'
import { bossAlertSpeech, type SpeechPayload } from '../shared/speakLines'

export interface BossState {
  id: string
  name: string
  nameRu: string
  location: string
  locationRu: string
  respawnMinutes: number
  image: string
  custom: boolean
  favorite: boolean
  respawnAt: number | null
  firedAlerts: AlertThreshold[]
}

export type FilterMode = 'all' | 'active' | 'ready' | 'idle' | 'favorite'

export type ToastKind = 'warn' | 'ready'

export interface TrackerToast {
  id: string
  bossId: string
  title: string
  body: string
  kind: ToastKind
  /** Set for kind === 'warn' — picks escalating sample */
  warnTier?: BossWarnTier
  /** Hybrid TTS: EN name + RU rest */
  speech?: SpeechPayload
}

type RegionsPayload = {
  bosses?: BossState[]
  regions?: Partial<Record<BossRegionId, BossState[]>>
}

function seedBosses(regionId: BossRegionId): BossState[] {
  return bossesForRegion(regionId).map((b) => ({
    id: b.id,
    name: b.name,
    nameRu: b.nameRu,
    location: b.location,
    locationRu: b.locationRu,
    respawnMinutes: b.respawnMinutes,
    image: b.image,
    custom: false,
    favorite: false,
    respawnAt: null,
    firedAlerts: [],
  }))
}

function seedById(regionId: BossRegionId) {
  return new Map(bossesForRegion(regionId).map((b) => [b.id, b]))
}

function mergeWithSeed(list: BossState[], regionId: BossRegionId): BossState[] {
  const seed = seedById(regionId)
  return list.map((b) => {
    const def = seed.get(b.id)
    return {
      ...b,
      nameRu: def?.nameRu ?? b.nameRu ?? '',
      locationRu: def?.locationRu ?? b.locationRu ?? '',
      favorite: Boolean(b.favorite),
      firedAlerts: normalizeFiredAlerts(b.firedAlerts),
    }
  })
}

function syncMissedAlerts(boss: BossState, now = Date.now()): BossState {
  if (boss.respawnAt == null) return boss
  const remainingSec = (boss.respawnAt - now) / 1000
  if (remainingSec <= 0) return boss
  const fired = new Set(boss.firedAlerts)
  let changed = false
  for (const threshold of ALERT_THRESHOLDS_SEC) {
    if (remainingSec < threshold && !fired.has(threshold)) {
      fired.add(threshold)
      changed = true
    }
  }
  if (!changed) return boss
  return { ...boss, firedAlerts: [...fired] as AlertThreshold[] }
}

function replaceBoss(list: BossState[], id: string, next: BossState): BossState[] {
  const index = list.findIndex((b) => b.id === id)
  if (index < 0) return list
  const copy = list.slice()
  copy[index] = next
  return copy
}

function syncAlarmBridge(alarmingIds: string[]) {
  if (!import.meta.client) return
  window.aionTracker?.setAlarming?.(alarmingIds.length > 0)
}

function emptyRegions(): Record<BossRegionId, BossState[]> {
  return {
    verteron: seedBosses('verteron'),
    altgard: seedBosses('altgard'),
  }
}

function parsePersistedRegions(parsed: RegionsPayload | null): Record<BossRegionId, BossState[]> {
  const next = emptyRegions()
  if (parsed?.regions) {
    for (const key of ['verteron', 'altgard'] as BossRegionId[]) {
      const list = parsed.regions[key]
      if (Array.isArray(list) && list.length) {
        next[key] = mergeWithSeed(list, key)
      }
    }
    return next
  }
  // Legacy: single bosses array = Verteron
  if (Array.isArray(parsed?.bosses) && parsed.bosses.length) {
    next.verteron = mergeWithSeed(parsed.bosses, 'verteron')
  }
  return next
}

export const useBossStore = defineStore('bosses', {
  state: () => ({
    regionId: 'verteron' as BossRegionId,
    regions: emptyRegions() as Record<BossRegionId, BossState[]>,
    bosses: [] as BossState[],
    now: Date.now(),
    query: '',
    filter: 'all' as FilterMode,
    hydrated: false,
    toasts: [] as TrackerToast[],
    alarmingIds: [] as string[],
  }),

  getters: {
    isAlarming(state): boolean {
      return state.alarmingIds.length > 0
    },
    activeCount(state): number {
      return state.bosses.filter((b) => b.respawnAt != null && b.respawnAt > state.now).length
    },
    readyCount(state): number {
      return state.bosses.filter((b) => b.respawnAt != null && b.respawnAt <= state.now).length
    },
    nextBoss(state): BossState | null {
      const upcoming = state.bosses
        .filter((b) => b.respawnAt != null && b.respawnAt > state.now)
        .sort((a, b) => (a.respawnAt! - b.respawnAt!))
      return upcoming[0] ?? null
    },
    sortedBosses(state): BossState[] {
      const q = state.query.trim().toLowerCase()
      const filtered = state.bosses.filter((b) => {
        const remaining = b.respawnAt == null ? null : b.respawnAt - state.now
        if (state.filter === 'active' && !(remaining != null && remaining > 0)) return false
        if (state.filter === 'ready' && !(remaining != null && remaining <= 0)) return false
        if (state.filter === 'idle' && b.respawnAt != null) return false
        if (state.filter === 'favorite' && !b.favorite) return false
        if (!q) return true
        return (
          b.name.toLowerCase().includes(q)
          || (b.nameRu ?? '').toLowerCase().includes(q)
          || b.location.toLowerCase().includes(q)
          || (b.locationRu ?? '').toLowerCase().includes(q)
        )
      })

      return filtered.sort((a, b) => {
        const ra = a.respawnAt == null ? null : a.respawnAt - state.now
        const rb = b.respawnAt == null ? null : b.respawnAt - state.now
        const rank = (r: number | null) => {
          if (r == null) return 2
          if (r <= 0) return 0
          return 1
        }
        const da = rank(ra)
        const db = rank(rb)
        if (da !== db) return da - db
        if (da === 1 && ra != null && rb != null) return ra - rb
        return a.name.localeCompare(b.name, 'ru')
      })
    },
  },

  actions: {
    async hydrate() {
      if (!import.meta.client || this.hydrated) return
      const parsed = await loadPersisted<RegionsPayload>('bosses')
      this.regions = parsePersistedRegions(parsed)

      const now = Date.now()
      for (const key of ['verteron', 'altgard'] as BossRegionId[]) {
        this.regions[key] = this.regions[key].map((boss) => syncMissedAlerts(boss, now))
      }
      this.now = now
      this.applyRegion(this.regionId, { persist: false, clearAlerts: false })
      this.hydrated = true
      void this.persist()
    },

    persist() {
      if (!import.meta.client || !this.hydrated) return
      this.regions[this.regionId] = this.bosses
      void savePersisted('bosses', {
        regions: {
          verteron: this.regions.verteron,
          altgard: this.regions.altgard,
        },
      })
    },

    /** Switch active field region (from race setting). Timers for other region stay frozen. */
    setRegion(regionId: BossRegionId) {
      if (!isRegionId(regionId) || regionId === this.regionId) return
      this.applyRegion(regionId, { persist: true, clearAlerts: true })
    },

    applyRegion(
      regionId: BossRegionId,
      opts: { persist: boolean, clearAlerts: boolean },
    ) {
      if (this.hydrated) {
        this.regions[this.regionId] = this.bosses
      }
      this.regionId = regionId
      this.bosses = this.regions[regionId] ?? seedBosses(regionId)
      if (opts.clearAlerts) {
        this.toasts = []
        this.alarmingIds = []
        syncAlarmBridge([])
      }
      this.now = Date.now()
      if (opts.persist) this.persist()
    },

    tick() {
      const now = Date.now()
      this.now = now
      const fired: Array<{ boss: BossState, threshold: AlertThreshold }> = []
      let bossesChanged = false

      const nextBosses = this.bosses.map((boss) => {
        if (boss.respawnAt == null) return boss
        const remainingSec = (boss.respawnAt - now) / 1000
        let alerts = boss.firedAlerts
        let changed = false

        for (const threshold of ALERT_THRESHOLDS_SEC) {
          if (alerts.includes(threshold)) continue
          if (remainingSec <= threshold && remainingSec > 0) {
            if (!changed) {
              alerts = [...alerts]
              changed = true
            }
            alerts.push(threshold)
            fired.push({ boss: { ...boss, firedAlerts: alerts }, threshold })
          }
        }

        if (remainingSec <= 0 && !alerts.includes(READY_ALERT)) {
          if (!changed) {
            alerts = [...alerts]
            changed = true
          }
          alerts.push(READY_ALERT)
          fired.push({ boss: { ...boss, firedAlerts: alerts }, threshold: READY_ALERT })
        }

        if (!changed) return boss
        bossesChanged = true
        return { ...boss, firedAlerts: alerts }
      })

      if (bossesChanged) {
        this.bosses = nextBosses
        this.persist()
      }
      for (const item of fired) {
        this.pushAlert(item.boss, item.threshold)
      }
    },

    pushAlert(boss: BossState, threshold: AlertThreshold) {
      const kind: ToastKind = threshold === READY_ALERT ? 'ready' : 'warn'
      const warnTier = threshold === READY_ALERT
        ? undefined
        : warnTierForThreshold(threshold)
      const body = threshold === READY_ALERT
        ? 'Респаун! Можно фармить'
        : `Возродится через ${formatWarnLead(threshold)}`
      const id = `${boss.id}-${threshold}-${Date.now()}`

      this.toasts = [
        {
          id,
          bossId: boss.id,
          title: boss.name,
          body,
          kind,
          warnTier,
          speech: bossAlertSpeech(boss.name, threshold),
        },
        ...this.toasts,
      ].slice(0, 6)

      if (kind === 'warn') {
        window.setTimeout(() => {
          this.toasts = this.toasts.filter((t) => t.id !== id)
        }, 12000)
      }
      else {
        this.startAlarm(boss.id)
      }
    },

    startAlarm(bossId: string) {
      if (!this.alarmingIds.includes(bossId)) {
        this.alarmingIds = [...this.alarmingIds, bossId]
      }
      syncAlarmBridge(this.alarmingIds)
    },

    silenceAlarm(bossId?: string) {
      if (bossId) {
        this.alarmingIds = this.alarmingIds.filter((id) => id !== bossId)
        this.toasts = this.toasts.filter((t) => !(t.kind === 'ready' && t.bossId === bossId))
      }
      else {
        this.alarmingIds = []
        this.toasts = this.toasts.filter((t) => t.kind !== 'ready')
      }
      syncAlarmBridge(this.alarmingIds)
    },

    markKilled(id: string) {
      const boss = this.bosses.find((b) => b.id === id)
      if (!boss) return
      const now = Date.now()
      this.silenceAlarm(id)
      this.bosses = replaceBoss(this.bosses, id, {
        ...boss,
        respawnAt: now + boss.respawnMinutes * 60000,
        firedAlerts: [],
      })
      this.now = now
      this.persist()
    },

    setCustomRemaining(id: string, minutes: number) {
      const boss = this.bosses.find((b) => b.id === id)
      if (!boss || !Number.isFinite(minutes) || minutes <= 0) return
      const now = Date.now()
      this.silenceAlarm(id)
      const next = syncMissedAlerts({
        ...boss,
        respawnAt: now + minutes * 60000,
        firedAlerts: [],
      }, now)
      this.bosses = replaceBoss(this.bosses, id, next)
      this.now = now
      this.persist()
    },

    setIntervalMinutes(id: string, minutes: number) {
      const boss = this.bosses.find((b) => b.id === id)
      if (!boss || !Number.isFinite(minutes) || minutes < 1) return
      this.bosses = replaceBoss(this.bosses, id, {
        ...boss,
        respawnMinutes: Math.round(minutes),
      })
      this.persist()
    },

    clearTimer(id: string) {
      const boss = this.bosses.find((b) => b.id === id)
      if (!boss) return
      this.silenceAlarm(id)
      this.bosses = replaceBoss(this.bosses, id, {
        ...boss,
        respawnAt: null,
        firedAlerts: [],
      })
      this.now = Date.now()
      this.persist()
    },

    addCustomBoss(name: string, location: string, minutes: number) {
      const clean = name.trim()
      if (!clean || minutes < 1) return
      const id = `custom_${slugify(clean)}_${Math.random().toString(16).slice(2, 8)}`
      this.bosses = [
        ...this.bosses,
        {
          id,
          name: clean,
          nameRu: '',
          location: location.trim(),
          locationRu: '',
          respawnMinutes: Math.round(minutes),
          image: '',
          custom: true,
          favorite: false,
          respawnAt: null,
          firedAlerts: [],
        },
      ]
      this.persist()
    },

    toggleFavorite(id: string) {
      const boss = this.bosses.find((b) => b.id === id)
      if (!boss) return
      this.bosses = replaceBoss(this.bosses, id, {
        ...boss,
        favorite: !boss.favorite,
      })
      this.persist()
    },

    removeBoss(id: string) {
      const boss = this.bosses.find((b) => b.id === id)
      if (!boss?.custom) return
      this.silenceAlarm(id)
      this.bosses = this.bosses.filter((b) => b.id !== id)
      this.persist()
    },

    dismissToast(id: string) {
      const toast = this.toasts.find((t) => t.id === id)
      this.toasts = this.toasts.filter((t) => t.id !== id)
      if (toast?.kind === 'ready') {
        this.silenceAlarm(toast.bossId)
      }
    },
  },
})
