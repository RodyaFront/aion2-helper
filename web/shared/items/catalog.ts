import { shallowRef } from 'vue'
import { DropChanceMarker } from '../map/markers'
import { createMapScene } from '../map/scene'
import type { MapScene } from '../map/types'
import { VERTERON_MAP_DEFINITION } from '../map/verteron'
import freshRawMeatDrops from './drops/fresh_raw_meat.json'
import rawLeatherDrops from './drops/raw_leather.json'
import refiningStoneDrops from './drops/refining_stone.json'
import { normalizeItemGrade, type ItemGrade } from './grade'
import { APP_LOCALE, itemLocalizedName, localeCompareTag } from './i18n'
import {
  ASSUMED_PLAYER_LEVEL,
  composeLootForPlayerLevel,
} from './lootCompose'
import sharedLevel45 from './shared-levels/45.json'
import type {
  DropSource,
  ItemCatalogFile,
  ItemDef,
  ItemDropFile,
  ItemFilterInput,
  ItemSortKey,
  MobDropLine,
  MobLootFile,
  SharedLevelLootFile,
} from './types'

export type { ItemDef, DropSource, ItemDropFile, MobDropLine, MobLootFile } from './types'
export type { ItemFilterInput, ItemSortKey } from './types'
export { ASSUMED_PLAYER_LEVEL, isOwnDrop } from './lootCompose'

const SHARED_LEVEL_45 = sharedLevel45 as SharedLevelLootFile

/** Legacy seed files (slug keys) — fallback if drop index not loaded yet. */
const SEED_DROPS: Record<string, ItemDropFile> = {
  raw_leather: rawLeatherDrops as ItemDropFile,
  fresh_raw_meat: freshRawMeatDrops as ItemDropFile,
  refining_stone: refiningStoneDrops as ItemDropFile,
}

const SEED_SLUG_TO_ITEM_ID: Record<string, string> = {
  raw_leather: '610530011',
  fresh_raw_meat: '610531001',
  refining_stone: '610530001',
}

type DropIndexMob = {
  nameEn?: string | null
  nameRu?: string | null
  level?: number | null
  icon?: string | null
  iconUrl?: string | null
  title?: string | null
  gradeName?: string | null
  creatureName?: string | null
  race?: string | null
  spawns: DropSource['spawns']
}

type DropIndexFile = {
  scrapedAt?: string
  source?: string
  mobs: Record<string, DropIndexMob>
  items: Record<string, { mobId: string, rate: number }[]>
}

let dropIndex: DropIndexFile | null = null
let dropIndexPromise: Promise<DropIndexFile | null> | null = null
const composedDropCache = new Map<string, ItemDropFile | null>()

/** Eager map of ./mobs/{mobId}.json → loot table. */
const mobLootModules = import.meta.glob('./mobs/*.json', { eager: true, import: 'default' }) as Record<
  string,
  MobLootFile
>

const mobLootById = new Map<string, MobLootFile>()
for (const [pathKey, file] of Object.entries(mobLootModules)) {
  const id = pathKey.match(/\/(\d+)\.json$/)?.[1] || file?.mobId
  if (id) mobLootById.set(String(id), file)
}

export type MobLootView = {
  mobId: string
  baseLevel: number | null
  effectiveLevel: number
  /** True when own drops were merged with shared Lv45 band. */
  composed: boolean
  drops: MobDropLine[]
  source: string
}

/** Skins, titles, pets, wings, pantheon decor — clutter for gear/craft search. */
export const COSMETIC_CATEGORIES = new Set([
  'SKINSHOP',
  'GETTITLE',
  'VEHICLESOUL',
  'GETWING',
  'DECO',
])

const GRADE_RANK: Record<ItemGrade, number> = {
  common: 0,
  rare: 1,
  special: 2,
  epic: 3,
  unique: 4,
  heroic: 5,
  unknown: -1,
}

export const catalogItems = shallowRef<ItemDef[]>([])
export const catalogStatus = shallowRef<'idle' | 'loading' | 'ready' | 'error'>('idle')
export const catalogError = shallowRef<string | null>(null)
export const catalogMeta = shallowRef<{
  scrapedAt: string
  source: string
  attribution: string
  count: number
} | null>(null)

const byId = new Map<string, ItemDef>()

/** @deprecated Prefer catalogItems — kept as live array view for older call sites. */
export const ITEMS: ItemDef[] = []

function syncItemsExport(list: ItemDef[]) {
  ITEMS.length = 0
  ITEMS.push(...list)
  byId.clear()
  for (const item of list) byId.set(item.id, item)
}

let loadPromise: Promise<ItemDef[]> | null = null

function publicDataUrl(fileName: string): string {
  // Public files are served from the site root. Do not use import.meta.env.BASE_URL:
  // in Nuxt/Vite that is "/_nuxt/", which would 404 (/_nuxt/data/...).
  if (typeof window !== 'undefined' && window.location?.origin) {
    return new URL(`/data/${fileName}`, window.location.origin).href
  }
  return `/data/${fileName}`
}

function resolveNumericItemId(key: string): string {
  return SEED_SLUG_TO_ITEM_ID[key] || key
}

function composeDropFileFromIndex(itemId: string): ItemDropFile | null {
  if (!dropIndex) return null
  if (composedDropCache.has(itemId)) return composedDropCache.get(itemId) ?? null

  const links = dropIndex.items[itemId]
  if (!links?.length) {
    composedDropCache.set(itemId, null)
    return null
  }

  const sources: DropSource[] = []
  for (const link of links) {
    const mob = dropIndex.mobs[link.mobId]
    if (!mob?.spawns?.length) continue
    sources.push({
      mobId: link.mobId,
      nameEn: mob.nameEn || `NPC ${link.mobId}`,
      nameRu: mob.nameRu ?? null,
      level: mob.level ?? null,
      region: 'Verteron',
      regionId: 'verteron',
      rate: link.rate,
      hasMap: true,
      onmapUrl: `https://dbaion2.ru/en/map/#verteron&npc=${link.mobId}`,
      icon: mob.icon ?? null,
      iconUrl: mob.iconUrl ?? null,
      title: mob.title ?? null,
      gradeName: mob.gradeName ?? null,
      creatureName: mob.creatureName ?? null,
      race: mob.race ?? null,
      spawns: mob.spawns,
    })
  }

  if (!sources.length) {
    composedDropCache.set(itemId, null)
    return null
  }

  sources.sort((a, b) => b.rate - a.rate || a.nameEn.localeCompare(b.nameEn, 'en'))
  const file: ItemDropFile = {
    itemId,
    scrapedAt: dropIndex.scrapedAt || '',
    source: dropIndex.source || 'dbaion2.ru',
    sourceUrl: `https://dbaion2.ru/en/items/${itemId}/`,
    sources,
  }
  composedDropCache.set(itemId, file)
  return file
}

export async function ensureItemDropIndex(): Promise<DropIndexFile | null> {
  if (dropIndex) return dropIndex
  if (dropIndexPromise) return dropIndexPromise

  dropIndexPromise = (async () => {
    const res = await fetch(publicDataUrl('item-drop-index.json'), {
      headers: { accept: 'application/json' },
    })
    if (!res.ok) {
      console.warn(`Item drop index HTTP ${res.status}`)
      return null
    }
    const data = (await res.json()) as DropIndexFile
    dropIndex = data
    composedDropCache.clear()
    return data
  })().catch((err: unknown) => {
    console.warn('Item drop index failed', err)
    dropIndexPromise = null
    return null
  })

  return dropIndexPromise
}

export async function ensureItemCatalog(): Promise<ItemDef[]> {
  if (catalogStatus.value === 'ready' && catalogItems.value.length) {
    void ensureItemDropIndex()
    return catalogItems.value
  }
  if (loadPromise) return loadPromise

  catalogStatus.value = 'loading'
  catalogError.value = null

  loadPromise = (async () => {
    const [res] = await Promise.all([
      fetch(publicDataUrl('items-catalog.json'), { headers: { accept: 'application/json' } }),
      ensureItemDropIndex(),
    ])
    if (!res.ok) throw new Error(`Catalog HTTP ${res.status}`)
    const data = (await res.json()) as ItemCatalogFile
    const items = Array.isArray(data.items) ? data.items : []
    catalogItems.value = items
    syncItemsExport(items)
    catalogMeta.value = {
      scrapedAt: data.scrapedAt || '',
      source: data.source || 'dbaion2.ru',
      attribution: data.attribution || '',
      count: data.count ?? items.length,
    }
    catalogStatus.value = 'ready'
    return items
  })().catch((err: unknown) => {
    catalogStatus.value = 'error'
    catalogError.value = err instanceof Error ? err.message : String(err)
    loadPromise = null
    throw err
  })

  return loadPromise
}

export function getItem(id: string): ItemDef | null {
  return byId.get(id) ?? null
}

export function getItemDrops(itemKey: string): ItemDropFile | null {
  if (SEED_DROPS[itemKey]) return SEED_DROPS[itemKey]
  const itemId = resolveNumericItemId(itemKey)
  const fromIndex = composeDropFileFromIndex(itemId)
  if (fromIndex) return fromIndex
  // Slug seed fallback when index missing
  for (const [slug, id] of Object.entries(SEED_SLUG_TO_ITEM_ID)) {
    if (id === itemId && SEED_DROPS[slug]) return SEED_DROPS[slug]
  }
  return null
}

export function getItemDropSource(itemKey: string, mobId: string): DropSource | null {
  const file = getItemDrops(itemKey)
  if (!file) return null
  return file.sources.find((s) => s.mobId === mobId) ?? null
}

export function getMobLoot(mobId: string): MobLootFile | null {
  return mobLootById.get(String(mobId)) ?? null
}

export function getSharedLevelLoot(level: number, regionId = 'verteron'): SharedLevelLootFile | null {
  if (level === 45 && regionId === 'verteron') return SHARED_LEVEL_45
  return null
}

/**
 * Loot as seen by a high-level character: for baseLevel < playerLevel,
 * keep mob-own rewards and attach the shared Verteron Lv45 band.
 */
export function getMobLootForPlayer(
  mobId: string,
  opts?: {
    baseLevel?: number | null
    playerLevel?: number
    /** Default true — attach shared Lv45 band for low baseLevel mobs. */
    useSharedScaling?: boolean
  },
): MobLootView | null {
  const file = getMobLoot(mobId)
  if (!file) return null
  const playerLevel = opts?.playerLevel ?? ASSUMED_PLAYER_LEVEL
  const baseLevel = opts?.baseLevel ?? file.baseLevel ?? null
  const useSharedScaling = opts?.useSharedScaling !== false
  const shared = getSharedLevelLoot(playerLevel, 'verteron')
  const composed = composeLootForPlayerLevel({
    baseDrops: file.drops || [],
    sharedDrops: shared?.drops || [],
    baseLevel,
    playerLevel,
    useSharedScaling,
  })
  return {
    mobId: String(mobId),
    baseLevel: baseLevel == null ? null : Number(baseLevel),
    effectiveLevel: composed.effectiveLevel,
    composed: composed.composed,
    drops: composed.drops,
    source: file.source,
  }
}

export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function isCosmeticItem(item: ItemDef): boolean {
  return COSMETIC_CATEGORIES.has(String(item.category || '').toUpperCase())
}

function compareByLocalizedName(a: ItemDef, b: ItemDef): number {
  const tag = localeCompareTag(APP_LOCALE)
  const n = itemLocalizedName(a).localeCompare(itemLocalizedName(b), tag)
  return n || a.itemId.localeCompare(b.itemId, 'en', { numeric: true })
}

function sortItems(list: ItemDef[], sort: ItemSortKey): ItemDef[] {
  const out = list.slice()
  out.sort((a, b) => {
    switch (sort) {
      case 'grade': {
        const ga = GRADE_RANK[normalizeItemGrade(a.grade)]
        const gb = GRADE_RANK[normalizeItemGrade(b.grade)]
        if (ga !== gb) return gb - ga
        return compareByLocalizedName(a, b)
      }
      case 'level': {
        const la = a.itemLevel ?? a.levelReq ?? 0
        const lb = b.itemLevel ?? b.levelReq ?? 0
        if (la !== lb) return lb - la
        return compareByLocalizedName(a, b)
      }
      case 'id':
        return a.itemId.localeCompare(b.itemId, 'en', { numeric: true })
      case 'map': {
        if (a.hasVerteronMap !== b.hasVerteronMap) return a.hasVerteronMap ? -1 : 1
        return compareByLocalizedName(a, b)
      }
      case 'name':
      default:
        return compareByLocalizedName(a, b)
    }
  })
  return out
}

export function filterItems(
  input: ItemFilterInput,
  source: ItemDef[] = catalogItems.value,
): ItemDef[] {
  const q = normalizeSearch(input.query.trim())
  const gradeKey = input.grade !== 'all' ? normalizeItemGrade(input.grade) : null
  const typeKey = input.itemType !== 'all' ? input.itemType.toUpperCase() : null
  const catKey = input.category !== 'all' ? input.category : null

  const matched = source.filter((item) => {
    if (input.hideCosmetics && isCosmeticItem(item)) return false
    if (catKey && item.category !== catKey) return false
    if (typeKey && String(item.itemType || '').toUpperCase() !== typeKey) return false
    if (gradeKey && gradeKey !== 'unknown' && normalizeItemGrade(item.grade) !== gradeKey) {
      return false
    }
    if (input.onlyWithDropPoints && !item.hasVerteronMap) return false
    if (!q) return true
    const hay = normalizeSearch(
      `${item.nameEn} ${item.nameRu} ${item.itemId} ${item.category} ${item.categoryName || ''}`,
    )
    return hay.includes(q)
  })

  return sortItems(matched, input.sort)
}

export function buildCategoryOptions(source: ItemDef[] = catalogItems.value) {
  const counts = new Map<string, { label: string, count: number }>()
  for (const item of source) {
    const key = item.category || 'MISC'
    const cur = counts.get(key)
    if (cur) cur.count += 1
    else {
      counts.set(key, {
        label: item.categoryName || categoryLabel(key),
        count: 1,
      })
    }
  }
  return [...counts.entries()]
    .sort((a, b) => a[1].label.localeCompare(b[1].label, 'en') || b[1].count - a[1].count)
    .map(([value, meta]) => ({
      value,
      label: `${meta.label} (${meta.count})`,
      keywords: `${value} ${meta.label}`,
    }))
}

export function categoryLabel(category: string): string {
  const map: Record<string, string> = {
    CRAFTRESOURCE: 'Крафт-материалы',
    SKINSHOP: 'Скины',
    GETTITLE: 'Титулы',
    VEHICLESOUL: 'Питомцы',
    GETWING: 'Крылья',
    DECO: 'Декор',
    REWARDBOX: 'Сундуки',
    ADDCONTENTSTICKETCOUNT: 'Тикеты',
  }
  return map[category] || category
}

function dropLookupKeys(item: ItemDef | string): string[] {
  if (typeof item === 'string') return [item, resolveNumericItemId(item)]
  const keys = [item.itemId, item.id]
  const mapped = SEED_SLUG_TO_ITEM_ID[item.id]
  if (mapped) keys.push(mapped)
  return [...new Set(keys.filter(Boolean))]
}

export function getItemDropMarkers(itemKey: string, regionId = 'verteron'): DropChanceMarker[] {
  let file: ItemDropFile | null = null
  for (const key of dropLookupKeys(itemKey)) {
    file = getItemDrops(key)
    if (file) break
  }
  if (!file) return []
  const markers: DropChanceMarker[] = []
  for (const src of file.sources) {
    if (regionId && src.regionId && src.regionId !== regionId) continue
    if (!src.spawns?.length) continue
    src.spawns.forEach((pt, idx) => {
      markers.push(
        new DropChanceMarker(
          `${src.mobId}:${idx}`,
          pt,
          src.mobId,
          src.rate,
          src.nameRu || src.nameEn,
        ),
      )
    })
  }
  return markers
}

export function createItemDropMapScene(
  item: ItemDef,
  opts?: { minRate?: number, maxRate?: number },
): MapScene {
  let markers = getItemDropMarkers(item.itemId, 'verteron')
  if (!markers.length && item.id !== item.itemId) {
    markers = getItemDropMarkers(item.id, 'verteron')
  }
  const lo = opts?.minRate
  const hi = opts?.maxRate
  if (lo != null || hi != null) {
    const minR = lo ?? 0
    const maxR = hi ?? Number.POSITIVE_INFINITY
    markers = markers.filter((m) => m.rate >= minR && m.rate <= maxR)
  }
  return createMapScene({
    map: VERTERON_MAP_DEFINITION,
    markers,
    // No focusPoint: camera fits all drop markers (not an arbitrary first spawn).
    focusPoint: null,
    emptyMessage: 'Нет точек дропа в выбранном диапазоне.',
    focusLabel: 'Все точки',
    hintExtra: markers.length
      ? `${markers.length} точек · клик по % — карточка моба`
      : undefined,
  })
}
