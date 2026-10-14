/** Item rarity from dbaion2 `grade` / `gradeName`. */

export type ItemGrade =
  | 'common'
  | 'rare'
  | 'special'
  | 'epic'
  | 'unique'
  | 'heroic'
  | 'unknown'

/** Normalize dump labels to a stable grade key. */
export function normalizeItemGrade(raw: string | null | undefined): ItemGrade {
  const g = String(raw || '').trim().toLowerCase()
  if (!g) return 'unknown'
  if (g === 'common') return 'common'
  if (g === 'rare') return 'rare'
  if (g === 'special') return 'special'
  if (g === 'epic') return 'epic'
  if (g === 'unique') return 'unique'
  if (g === 'heroic' || g === 'mythic') return 'heroic'
  // Some portals label game-Epic as "Legend" internally — keep blue Epic band.
  if (g === 'legend') return 'epic'
  return 'unknown'
}

/** CSS modifier class for colored item names, e.g. `is-grade-rare`. */
export function gradeClass(raw: string | null | undefined): string {
  const g = normalizeItemGrade(raw)
  return g === 'unknown' ? '' : `is-grade-${g}`
}
