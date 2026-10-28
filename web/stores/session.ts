import { defineStore } from 'pinia'
import { loadPersisted, savePersisted } from '../shared/persist'
import { currencyAbsoluteDelta, currencyKindOf } from '../shared/session/currency'
import { catalogSnapshot, sessionItemView } from '../shared/session/display'
import { formatDayLabel, localDayKey, SESSION_RULES } from '../shared/session/rules'
import type {
  SessionCapturePayload,
  SessionDay,
  SessionDropRow,
  SessionItemRow,
  SessionKillRow,
  SessionPersistShape,
} from '../shared/session/types'

function emptyDay(dayKey: string): SessionDay {
  return {
    dayKey,
    kinahNet: 0,
    kinahGained: 0,
    kinahSpent: 0,
    abyssNet: 0,
    abyssGained: 0,
    abyssSpent: 0,
    monsterKills: 0,
    resources: [],
    kills: [],
    drops: [],
    updatedAt: Date.now(),
  }
}

function bumpItem(list: SessionItemRow[], itemId: number, count: number): SessionItemRow[] {
  const snap = catalogSnapshot(itemId)
  const next = list.map((r) => ({ ...r }))
  const row = next.find((r) => r.itemId === itemId)
  if (row) {
    row.count += count
    row.picks += 1
    if (snap.icon) row.icon = snap.icon
    if (snap.grade) row.grade = snap.grade
    if (snap.name) row.name = snap.name
  }
  else {
    next.push({
      itemId,
      count,
      picks: 1,
      name: snap.name,
      icon: snap.icon,
      grade: snap.grade,
    })
  }
  return next.sort((a, b) => b.count - a.count)
}

/** Backfill icon/grade/name on persisted rows once catalog is available. */
function enrichDayDisplay(day: SessionDay): SessionDay {
  const resources = day.resources.map((r) => {
    if (r.icon && r.grade && r.name) return r
    const v = sessionItemView(r.itemId, r.name)
    return {
      ...r,
      name: r.name || v.name,
      icon: r.icon || v.icon,
      grade: r.grade || v.grade,
    }
  })
  // Drop legacy gather-attributed lines (feature removed — no reliable protocol signal).
  const drops = day.drops
    .filter((r) => r.source === 'mob')
    .map((r) => {
      if (r.icon && r.grade && r.name) return r
      const v = sessionItemView(r.itemId, r.name)
      return {
        ...r,
        source: 'mob' as const,
        name: r.name || v.name,
        icon: r.icon || v.icon,
        grade: r.grade || v.grade,
      }
    })
  return { ...day, resources, drops }
}

function bumpKill(list: SessionKillRow[], npcId: number, name?: string | null): SessionKillRow[] {
  const next = list.map((r) => ({ ...r }))
  const row = next.find((r) => r.npcId === npcId)
  if (row) {
    row.count += 1
    if (name && !row.name) row.name = name
  }
  else {
    next.push({ npcId, name: name ?? null, count: 1 })
  }
  return next.sort((a, b) => b.count - a.count)
}

/** Normalize legacy drop rows that used `kills` instead of `attempts` / `source`. */
function normalizeDrop(raw: SessionDropRow & { kills?: number, source?: string }): SessionDropRow | null {
  if (raw.source === 'gather') return null
  const attempts = Number.isFinite(raw.attempts)
    ? raw.attempts
    : (Number.isFinite(raw.kills) ? Number(raw.kills) : 0)
  return {
    source: 'mob',
    itemId: raw.itemId,
    picks: raw.picks,
    attempts,
    rate: raw.rate ?? null,
    npcId: raw.npcId,
    npcName: raw.npcName ?? null,
  }
}

function recomputeDrops(day: SessionDay): SessionDropRow[] {
  const killMap = new Map(day.kills.map((k) => [k.npcId, k]))
  return day.drops
    .map((raw) => normalizeDrop(raw as SessionDropRow & { kills?: number }))
    .filter((d): d is SessionDropRow => d != null)
    .map((d) => {
      const kill = d.npcId != null ? killMap.get(d.npcId) : undefined
      const attempts = kill?.count ?? d.attempts
      return {
        ...d,
        npcName: d.npcName || kill?.name || null,
        attempts,
        rate: attempts > 0 ? d.picks / attempts : null,
      }
    })
    .sort((a, b) => b.picks - a.picks)
}

function pruneDays(days: Record<string, SessionDay>): Record<string, SessionDay> {
  const keys = Object.keys(days).sort().reverse()
  const keep = new Set(keys.slice(0, SESSION_RULES.historyDays + 1))
  const out: Record<string, SessionDay> = {}
  for (const k of keep) {
    if (days[k]) out[k] = days[k]
  }
  return out
}

function dayHasActivity(day: SessionDay): boolean {
  return day.monsterKills > 0
    || day.resources.length > 0
    || day.kinahGained > 0
    || day.kinahSpent > 0
    || day.abyssGained > 0
    || day.abyssSpent > 0
}

type PendingKill = { npcId: number, name?: string | null, at: number }

export const useSessionStore = defineStore('session', {
  state: () => ({
    hydrated: false,
    days: {} as Record<string, SessionDay>,
    selectedDayKey: localDayKey(),
    pendingKills: [] as PendingKill[],
    /**
     * Last absolute wallet/stack size per currency itemId (not persisted).
     * Inventory frames send the new total — session nets use deltas from this.
     */
    currencyAbs: {} as Record<number, number>,
    /** Live capture pulse (not persisted). */
    lastEventAt: 0,
    lastEventSummary: '',
  }),
  getters: {
    rules: () => SESSION_RULES,
    todayKey: () => localDayKey(),
    current(state): SessionDay {
      const key = state.selectedDayKey || localDayKey()
      return state.days[key] ?? emptyDay(key)
    },
    historyKeys(state): string[] {
      return Object.keys(state.days).sort().reverse()
    },
    historyLabels(): Array<{ key: string, label: string, active: boolean }> {
      return this.historyKeys.map((key) => ({
        key,
        label: formatDayLabel(key),
        active: dayHasActivity(this.days[key] ?? emptyDay(key)),
      }))
    },
    currentIsEmpty(): boolean {
      return !dayHasActivity(this.current)
    },
  },
  actions: {
    async hydrate() {
      const data = await loadPersisted<SessionPersistShape & { days: Record<string, SessionDay & { gather?: unknown }> }>('sessions')
      if (data?.version === 1 && data.days && typeof data.days === 'object') {
        const next: Record<string, SessionDay> = {}
        for (const [key, day] of Object.entries(data.days)) {
          const { gather: _dropGather, ...rest } = day as SessionDay & { gather?: unknown }
          const drops = (rest.drops || [])
            .map((d) => normalizeDrop(d as SessionDropRow & { kills?: number }))
            .filter((d): d is SessionDropRow => d != null)
          next[key] = enrichDayDisplay({
            ...emptyDay(key),
            ...rest,
            drops,
          })
        }
        this.days = next
      }
      this.selectedDayKey = localDayKey()
      if (!this.days[this.selectedDayKey]) {
        this.days[this.selectedDayKey] = emptyDay(this.selectedDayKey)
      }
      this.hydrated = true
    },
    /** Re-resolve icons/grades after item catalog finishes loading. */
    enrichFromCatalog() {
      const next: Record<string, SessionDay> = {}
      for (const [key, day] of Object.entries(this.days)) {
        next[key] = enrichDayDisplay(day)
      }
      this.days = next
      this.persist()
    },
    persist() {
      const payload: SessionPersistShape = {
        version: 1,
        days: pruneDays(this.days),
      }
      this.days = payload.days
      void savePersisted('sessions', payload)
    },
    selectDay(dayKey: string) {
      this.selectedDayKey = dayKey
      if (!this.days[dayKey]) this.days[dayKey] = emptyDay(dayKey)
    },
    ensureDay(dayKey: string): SessionDay {
      if (!this.days[dayKey]) this.days[dayKey] = emptyDay(dayKey)
      return this.days[dayKey]!
    },
    noteEvent(summary: string, at: number) {
      this.lastEventAt = at
      this.lastEventSummary = summary
    },
    touch(day: SessionDay) {
      day.updatedAt = Date.now()
      day.drops = recomputeDrops(day)
      this.persist()
    },
    applyCapture(payload: SessionCapturePayload) {
      if (!this.hydrated) return
      const at = Number(payload.at) || Date.now()
      const dayKey = localDayKey(at)
      const day = this.ensureDay(dayKey)

      if (payload.type === 'inventory') {
        this.applyInventory(day, payload.itemId, payload.kind, payload.quantity, at)
        this.touch(day)
        return
      }
      if (payload.type === 'loot') {
        this.applyLoot(day, payload.itemId, payload.count, at)
        this.noteEvent(`Лут #${payload.itemId}`, at)
        this.touch(day)
        return
      }
      if (payload.type === 'mob_kill') {
        if (payload.own === false) return
        day.monsterKills += 1
        day.kills = bumpKill(day.kills, payload.npcId, payload.name)
        this.pendingKills.push({ npcId: payload.npcId, name: payload.name, at })
        this.trimPending(at)
        this.noteEvent(payload.name ? `Убит ${payload.name}` : `Убит NPC ${payload.npcId}`, at)
        this.touch(day)
      }
    },
    applyInventory(day: SessionDay, itemId: number, kind: number, quantity: number, at: number) {
      const cur = currencyKindOf(itemId)
      if (!cur) return
      const prev = this.currencyAbs[itemId]
      const { delta, nextAbs } = currencyAbsoluteDelta(kind, quantity, prev)
      if (nextAbs != null) this.currencyAbs[itemId] = nextAbs
      if (!delta) return
      if (cur === 'kinah') {
        if (delta > 0) day.kinahGained += delta
        else day.kinahSpent += -delta
        day.kinahNet = day.kinahGained - day.kinahSpent
        this.noteEvent(delta > 0 ? `Кины +${delta}` : `Кины ${delta}`, at)
        return
      }
      if (delta > 0) day.abyssGained += delta
      else day.abyssSpent += -delta
      day.abyssNet = day.abyssGained - day.abyssSpent
      this.noteEvent(delta > 0 ? `AP +${delta}` : `AP ${delta}`, at)
    },
    applyLoot(day: SessionDay, itemId: number, count: number, at: number) {
      if (currencyKindOf(itemId)) return
      day.resources = bumpItem(day.resources, itemId, count)
      this.attributeMobDrop(day, itemId, at)
    },
    attributeMobDrop(day: SessionDay, itemId: number, at: number) {
      const windowMs = 8000
      const kill = [...this.pendingKills].reverse().find((k) => at - k.at >= 0 && at - k.at <= windowMs)
      if (!kill) return
      const next = day.drops
        .map((d) => normalizeDrop(d as SessionDropRow & { kills?: number }))
        .filter((d): d is SessionDropRow => d != null)
      const row = next.find((d) => d.source === 'mob' && d.npcId === kill.npcId && d.itemId === itemId)
      if (row) {
        row.picks += 1
      }
      else {
        const snap = catalogSnapshot(itemId)
        next.push({
          source: 'mob',
          npcId: kill.npcId,
          npcName: kill.name ?? null,
          itemId,
          picks: 1,
          attempts: day.kills.find((k) => k.npcId === kill.npcId)?.count ?? 1,
          rate: null,
          name: snap.name,
          icon: snap.icon,
          grade: snap.grade,
        })
      }
      day.drops = next
    },
    trimPending(now: number) {
      const kWin = 15000
      this.pendingKills = this.pendingKills.filter((k) => now - k.at < kWin)
    },
    clearDay(dayKey: string) {
      this.days[dayKey] = emptyDay(dayKey)
      this.persist()
    },
  },
})
