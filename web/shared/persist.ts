type PersistKey = 'bosses' | 'settings' | 'favorites'

type BossTimerRow = { respawnAt?: number | null }

type BossesPayload = {
  /** Legacy single-region list (pre race split). */
  bosses?: BossTimerRow[]
  /** Current multi-region shape. */
  regions?: {
    verteron?: BossTimerRow[]
    altgard?: BossTimerRow[]
  }
}

function localKey(key: PersistKey): string {
  if (key === 'bosses') return 'aion-boss-tracker-state-v1'
  if (key === 'favorites') return 'aion-boss-tracker-favorites-v1'
  return 'aion-boss-tracker-settings-v1'
}

/** Structured clone for IPC cannot carry Vue/Pinia Proxies. */
function toPlain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T
}

function readLocalStorage<T>(key: PersistKey): T | null {
  try {
    const raw = localStorage.getItem(localKey(key))
    if (!raw) return null
    return JSON.parse(raw) as T
  }
  catch {
    return null
  }
}

function listScore(list: BossTimerRow[] | null | undefined): number {
  if (!Array.isArray(list) || !list.length) return -1
  const active = list.filter((b) => b.respawnAt != null).length
  return list.length * 1000 + active
}

/** Prefer the richer timer snapshot across legacy `bosses` and `regions.*`. */
function bossesScore(data: BossesPayload | null): number {
  if (!data) return -1
  const legacy = listScore(data.bosses)
  const verteron = listScore(data.regions?.verteron)
  const altgard = listScore(data.regions?.altgard)
  return Math.max(legacy, verteron, altgard)
}

function pickBosses(bridge: BossesPayload | null, local: BossesPayload | null): BossesPayload | null {
  const bs = bossesScore(bridge)
  const ls = bossesScore(local)
  if (bs < 0 && ls < 0) return null
  return ls > bs ? local : bridge
}

export async function loadPersisted<T>(key: PersistKey): Promise<T | null> {
  if (!import.meta.client) return null

  let fromBridge: T | null = null
  if (window.aionTracker?.loadState) {
    try {
      const data = await window.aionTracker.loadState(key)
      fromBridge = (data as T) ?? null
    }
    catch {
      fromBridge = null
    }
  }

  const fromLocal = readLocalStorage<T>(key)

  if (key === 'bosses') {
    return pickBosses(fromBridge as BossesPayload | null, fromLocal as BossesPayload | null) as T | null
  }

  return fromBridge ?? fromLocal
}

export async function savePersisted(key: PersistKey, data: unknown): Promise<void> {
  if (!import.meta.client) return

  const plain = toPlain(data)

  if (window.aionTracker?.saveState) {
    try {
      await window.aionTracker.saveState(key, plain)
    }
    catch {
      // localStorage still written below
    }
  }

  try {
    localStorage.setItem(localKey(key), JSON.stringify(plain))
  }
  catch {
    // ignore quota / private mode
  }
}
