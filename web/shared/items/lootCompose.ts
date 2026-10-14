import type { MobDropLine } from './types'

/** Assumed character level for open-world Verteron farming. */
export const ASSUMED_PLAYER_LEVEL = 45

/**
 * Mob-specific kill rewards (Soul / species mats), not the shared level band.
 * Mirrors scripts/build-shared-level-45.mjs — keep in sync.
 */
export function isOwnDrop(d: MobDropLine): boolean {
  const cat = String(d.category || '')
  const name = String(d.nameEn || '')
  if (/^pet$/i.test(cat) || /^soul\s*:/i.test(name)) return true
  if (/refining\s*stone/i.test(name)) return false
  if (
    /Gloves|Shoes|Boots|Helm|Cloak|Pauldrons|Greaves|Breastplate|Top|Legs|Mantle|Greatsword|Longsword|Dagger|Bow|Spellbook|Orb|Mace|Staff|Guard|Knife|Sword|Shield/i.test(
      cat,
    )
  ) {
    return false
  }
  if (/crafting\s*material/i.test(cat) && d.chance != null && d.chance >= 1) return true
  return false
}

function sortDrops(drops: MobDropLine[]): MobDropLine[] {
  return [...drops].sort((a, b) => {
    const ca = a.chance
    const cb = b.chance
    if (ca == null && cb == null) return a.nameEn.localeCompare(b.nameEn, 'en')
    if (ca == null) return 1
    if (cb == null) return -1
    if (cb !== ca) return cb - ca
    return a.nameEn.localeCompare(b.nameEn, 'en')
  })
}

/** Merge own + shared; own wins on duplicate itemId. */
export function mergeLootTables(own: MobDropLine[], shared: MobDropLine[]): MobDropLine[] {
  const byId = new Map<string, MobDropLine>()
  for (const d of shared) byId.set(String(d.itemId), d)
  for (const d of own) byId.set(String(d.itemId), d)
  return sortDrops([...byId.values()])
}

export function composeLootForPlayerLevel(input: {
  baseDrops: MobDropLine[]
  sharedDrops: MobDropLine[]
  baseLevel: number | null | undefined
  playerLevel?: number
  /** When false, always use the native base-level dump (no shared band). */
  useSharedScaling?: boolean
}): { drops: MobDropLine[], composed: boolean, effectiveLevel: number } {
  const playerLevel = input.playerLevel ?? ASSUMED_PLAYER_LEVEL
  const baseLevel = input.baseLevel == null || !Number.isFinite(input.baseLevel)
    ? null
    : Number(input.baseLevel)
  const useShared = input.useSharedScaling !== false

  if (!useShared) {
    return {
      drops: sortDrops(input.baseDrops),
      composed: false,
      effectiveLevel: baseLevel ?? playerLevel,
    }
  }

  // Native table already at/above player level — keep dump as-is.
  if (baseLevel != null && baseLevel >= playerLevel) {
    return {
      drops: sortDrops(input.baseDrops),
      composed: false,
      effectiveLevel: baseLevel,
    }
  }

  const own = input.baseDrops.filter(isOwnDrop)
  return {
    drops: mergeLootTables(own, input.sharedDrops),
    composed: true,
    effectiveLevel: playerLevel,
  }
}
