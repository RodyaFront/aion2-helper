/**
 * Inventory item ids treated as session currencies (from items-catalog / dbaion2).
 * Confirm with a calib dump if a patch remaps them.
 */
export const CURRENCY_IDS = {
  /** Unbound Kina — primary wallet. */
  kinah: 930100031,
  /** Bound Kina — counted into the same Kinah net total. */
  kinahBound: 930100001,
  /**
   * “Kina (All)” aggregate — do not count; duplicates unbound+bound
   * and the frame quantity is the full wallet, not a loot delta.
   */
  kinahAll: 930100030,
  /** Abyss Points. */
  abyssPoints: 930100003,
} as const

const KINAH_TRACKED = new Set<number>([
  CURRENCY_IDS.kinah,
  CURRENCY_IDS.kinahBound,
])

export type CurrencyKind = 'kinah' | 'abyss' | null

export function currencyKindOf(itemId: number): CurrencyKind {
  if (KINAH_TRACKED.has(itemId)) return 'kinah'
  if (itemId === CURRENCY_IDS.abyssPoints) return 'abyss'
  return null
}

/**
 * Inventory frames carry the **new absolute** stack/wallet size for kind 0/1,
 * not the amount gained. Kind 2 is a removal: prefer new absolute when it is
 * ≤ previous, otherwise treat quantity as the amount removed.
 *
 * First sighting of an id only sets the baseline (delta 0) so a full wallet
 * sync is never counted as “session gain”.
 */
export function currencyAbsoluteDelta(
  kind: number,
  quantity: number,
  previous: number | undefined,
): { delta: number, nextAbs: number | undefined } {
  const q = Math.abs(quantity)
  if (!Number.isFinite(q) || q > 1_000_000_000) {
    return { delta: 0, nextAbs: previous }
  }

  if (kind === 0 || kind === 1) {
    if (previous == null) return { delta: 0, nextAbs: q }
    return { delta: q - previous, nextAbs: q }
  }

  if (kind === 2) {
    if (previous != null && q <= previous) {
      return { delta: q - previous, nextAbs: q }
    }
    const next = previous != null ? Math.max(0, previous - q) : undefined
    return { delta: -q, nextAbs: next }
  }

  return { delta: 0, nextAbs: previous }
}
