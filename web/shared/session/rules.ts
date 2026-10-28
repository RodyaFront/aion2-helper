/**
 * Session dashboard product rules (defaults from plan).
 * Session = one calendar day in the local PC timezone; resets at local midnight.
 */
export const SESSION_RULES = {
  /** Calendar day key uses the machine's local timezone. */
  reset: 'local-midnight' as const,
  /** Kinah / AP: gained − spent (inventory deltas). */
  currencyMode: 'net' as const,
  /**
   * Count a mob death only when the local player damaged that entity
   * within the last few seconds before HP hit 0.
   */
  killScope: 'own-damage' as const,
  /** Own-damage window for kill attribution (seconds). */
  killDamageWindowSec: 12,
  /**
   * Drop rate = session pickups attributed to a mob / kills of that mob.
   * Catalog static rates remain available as secondary UI context.
   */
  dropRate: 'empirical' as const,
  /** Keep this many past day keys (plus today). */
  historyDays: 30,
  /** Below this kill count, drop % is shown as “мало данных”. */
  dropRateMinKills: 10,
  /** Resources list default length before “показать все”. */
  resourcesTopN: 20,
} as const

export type SessionRules = typeof SESSION_RULES

/** YYYY-MM-DD in local timezone. */
export function localDayKey(atMs: number = Date.now()): string {
  const d = new Date(atMs)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDayLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  if (!y || !m || !d) return dayKey
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
