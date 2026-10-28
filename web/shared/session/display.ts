import { catalogItems, catalogStatus, getItem } from '../items/catalog'
import { itemLocalizedName } from '../items/i18n'

export type SessionItemView = {
  itemId: number | null
  name: string
  icon: string | null
  grade: string | null
}

function fromDef(item: { id: string, icon?: string | null, grade?: string | null }, fallbackName?: string): SessionItemView {
  const idNum = Number(item.id)
  return {
    itemId: Number.isFinite(idNum) ? idNum : null,
    name: fallbackName || itemLocalizedName(item as Parameters<typeof itemLocalizedName>[0]),
    icon: item.icon ?? null,
    grade: item.grade ?? null,
  }
}

/** Match catalog by exact RU/EN name. */
export function findCatalogByName(name: string | null | undefined): SessionItemView | null {
  const q = String(name || '').trim()
  if (!q) return null
  void catalogStatus.value
  const list = catalogItems.value
  if (!list.length) return null
  const hit = list.find((i) => i.nameRu === q || i.nameEn === q)
  return hit ? fromDef(hit) : null
}

/** Resolve catalog name / icon / grade for a session item id (and optional name fallback). */
export function sessionItemView(
  itemId: number | null | undefined,
  nameFallback?: string | null,
): SessionItemView {
  void catalogStatus.value
  if (itemId != null && Number.isFinite(itemId) && itemId > 0) {
    const item = getItem(String(itemId))
    if (item) return fromDef(item)
  }
  const byName = findCatalogByName(nameFallback)
  if (byName) return byName
  if (itemId != null && Number.isFinite(itemId) && itemId > 0) {
    return { itemId, name: `#${itemId}`, icon: null, grade: null }
  }
  if (nameFallback) {
    return { itemId: null, name: nameFallback, icon: null, grade: null }
  }
  return { itemId: null, name: '—', icon: null, grade: null }
}

/** Prefer fields already stored on a row; fill gaps from catalog. */
export function sessionRowView(row: {
  itemId?: number | null
  key?: string
  name?: string | null
  icon?: string | null
  grade?: string | null
}): SessionItemView {
  void catalogStatus.value
  if (row.icon && row.grade && (row.name || row.key)) {
    return {
      itemId: row.itemId ?? null,
      name: row.name || row.key || '—',
      icon: row.icon,
      grade: row.grade,
    }
  }
  const resolved = sessionItemView(row.itemId, row.name || row.key)
  return {
    itemId: row.itemId ?? resolved.itemId,
    name: row.name || resolved.name,
    icon: row.icon || resolved.icon,
    grade: row.grade || resolved.grade,
  }
}

/** Scraped into public/drop-icons from dbaion2. */
const LOCAL_KINAH_ICON = '/drop-icons/Icon_Currency_Coin_GoldNonbinding.webp'
const LOCAL_ABYSS_ICON = '/drop-icons/Icon_abysspoint.webp'

export function sessionKinahIcon(): string {
  return LOCAL_KINAH_ICON
}

export function sessionAbyssIcon(): string {
  return LOCAL_ABYSS_ICON
}

/** Snapshot catalog fields to persist on session rows at capture time. */
export function catalogSnapshot(itemId: number): { name: string, icon: string | null, grade: string | null } {
  const v = sessionItemView(itemId)
  return { name: v.name, icon: v.icon, grade: v.grade }
}
