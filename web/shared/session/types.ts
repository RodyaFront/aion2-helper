export type SessionItemRow = {
  itemId: number
  count: number
  picks: number
  /** Cached at capture so UI works before/without re-resolving catalog. */
  name?: string | null
  icon?: string | null
  grade?: string | null
}

export type SessionKillRow = {
  npcId: number
  name?: string | null
  count: number
}

/** Empirical drop line: loot attributed to a mob kill window. */
export type SessionDropRow = {
  source: 'mob'
  itemId: number
  picks: number
  /** Kill count for npcId. */
  attempts: number
  /** picks / attempts when attempts > 0 */
  rate: number | null
  npcId?: number
  npcName?: string | null
  name?: string | null
  icon?: string | null
  grade?: string | null
}

export type SessionDay = {
  dayKey: string
  /** Net Kinah (gained − spent). */
  kinahNet: number
  kinahGained: number
  kinahSpent: number
  /** Net Abyss Points. */
  abyssNet: number
  abyssGained: number
  abyssSpent: number
  monsterKills: number
  resources: SessionItemRow[]
  kills: SessionKillRow[]
  drops: SessionDropRow[]
  updatedAt: number
}

export type SessionPersistShape = {
  version: 1
  days: Record<string, SessionDay>
}

export type SessionLootPayload = {
  type: 'loot'
  itemId: number
  count: number
  zone?: number
  at: number
}

export type SessionInventoryPayload = {
  type: 'inventory'
  itemId: number
  kind: number
  quantity: number
  at: number
}

export type SessionMobKillPayload = {
  type: 'mob_kill'
  npcId: number
  entityId?: number
  own?: boolean
  name?: string | null
  at: number
}

export type SessionCapturePayload =
  | SessionLootPayload
  | SessionInventoryPayload
  | SessionMobKillPayload
