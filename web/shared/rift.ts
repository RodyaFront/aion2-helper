/** Global Spacetime Rift schedule (community-observed UTC). */
export const RIFT_UTC_HOURS = [0, 3, 6, 9, 12, 15, 18, 21] as const

/** Portal entry window after each opening. */
export const RIFT_PORTAL_MS = 10 * 60 * 1000

/** Time on the other side after entering (informational). */
export const RIFT_EVENT_MS = 60 * 60 * 1000

/** Pre-open warning lead times (15 min, then 10 min). */
export const RIFT_WARN_THRESHOLDS_MS = [15 * 60 * 1000, 10 * 60 * 1000] as const

/** Largest pre-open warn window (15 min). */
export const RIFT_WARN_MS = RIFT_WARN_THRESHOLDS_MS[0]

export type RiftPhase = 'open' | 'closed'

export interface RiftSnapshot {
  phase: RiftPhase
  /** Current portal window start (ms), if in/after that window today. */
  windowStartAt: number | null
  /** When the entry portal closes (ms). Set while phase === 'open'. */
  portalClosesAt: number | null
  /** Next portal opening (ms). Always the next future open (or current if open). */
  nextOpensAt: number
  /** Event (inside) ends at windowStart + 1h; set when inside the hour window. */
  eventEndsAt: number | null
}

function utcWindowStart(year: number, month: number, day: number, hour: number): number {
  return Date.UTC(year, month, day, hour, 0, 0, 0)
}

/** All window starts from yesterday through tomorrow (UTC). */
function candidateStarts(now: number): number[] {
  const d = new Date(now)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  const day = d.getUTCDate()
  const out: number[] = []
  for (const dayOffset of [-1, 0, 1]) {
    const base = Date.UTC(y, m, day + dayOffset, 0, 0, 0, 0)
    const bd = new Date(base)
    for (const h of RIFT_UTC_HOURS) {
      out.push(utcWindowStart(bd.getUTCFullYear(), bd.getUTCMonth(), bd.getUTCDate(), h))
    }
  }
  return out.sort((a, b) => a - b)
}

export function getRiftSnapshot(now = Date.now()): RiftSnapshot {
  const starts = candidateStarts(now)
  let openStart: number | null = null
  for (const start of starts) {
    if (now >= start && now < start + RIFT_PORTAL_MS) {
      openStart = start
      break
    }
  }

  if (openStart != null) {
    return {
      phase: 'open',
      windowStartAt: openStart,
      portalClosesAt: openStart + RIFT_PORTAL_MS,
      nextOpensAt: openStart,
      eventEndsAt: openStart + RIFT_EVENT_MS,
    }
  }

  const next = starts.find((s) => s > now) ?? starts[starts.length - 1]! + 3 * 60 * 60 * 1000
  const prev = [...starts].reverse().find((s) => s <= now) ?? null
  const inEvent = prev != null && now < prev + RIFT_EVENT_MS

  return {
    phase: 'closed',
    windowStartAt: inEvent ? prev : null,
    portalClosesAt: null,
    nextOpensAt: next,
    eventEndsAt: inEvent ? prev! + RIFT_EVENT_MS : null,
  }
}

export function formatRiftClock(ms: number): string {
  return new Date(ms).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}
