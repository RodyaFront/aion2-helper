import { shallowRef } from 'vue'
import { DropChanceMarker, GatherNodeMarker, PortraitNodeMarker } from '../map/markers'
import { mapDefinitionForRegion, regionLabelEn } from '../map/regions'
import { createMapScene } from '../map/scene'
import type { MapPoint, MapScene } from '../map/types'
import type { RegionId } from '../race'
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
import sharedLevel45Altgard from './shared-levels/45-altgard.json'
import type {
  DropSource,
  ItemCatalogFile,
  ItemDef,
  ItemDropFile,
  ItemFilterInput,
  ItemSortKey,
  MobDropLine,
  MobLootFile,
  RegionMob,
  SharedLevelLootFile,
  VerteronMob,
} from './types'

export type { ItemDef, DropSource, ItemDropFile, MobDropLine, MobLootFile, RegionMob, VerteronMob } from './types'
export type { ItemFilterInput, ItemSortKey } from './types'
export { ASSUMED_PLAYER_LEVEL, isOwnDrop } from './lootCompose'

const SHARED_LEVEL_45 = sharedLevel45 as SharedLevelLootFile
const SHARED_LEVEL_45_ALTGARD = sharedLevel45Altgard as SharedLevelLootFile

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
  /** Present when loot was scraped into the regional drop index (e.g. Altgard). */
  drops?: MobDropLine[] | null
}

type DropIndexFile = {
  scrapedAt?: string
  source?: string
  mobs: Record<string, DropIndexMob>
  items: Record<string, { mobId: string, rate: number }[]>
}

type GatherIndexLayer = {
  nameEn: string
  nameRu?: string | null
  icon?: string | null
  iconUrl?: string | null
  itemIds: string[]
  spawns: MapPoint[]
}

type GatherIndexFile = {
  scrapedAt?: string
  source?: string
  layers: Record<string, GatherIndexLayer>
  items: Record<string, string>
}

const dropIndexes = new Map<RegionId, DropIndexFile | null>()
const dropIndexPromises = new Map<RegionId, Promise<DropIndexFile | null>>()
const composedDropCaches = new Map<RegionId, Map<string, ItemDropFile | null>>()

const gatherIndexes = new Map<RegionId, GatherIndexFile | null>()
const gatherIndexPromises = new Map<RegionId, Promise<GatherIndexFile | null>>()

/** @deprecated Active region indexes — prefer ensure*Index(regionId). */
let dropIndex: DropIndexFile | null = null
let gatherIndex: GatherIndexFile | null = null

function dropFileName(regionId: RegionId): string {
  return regionId === 'altgard' ? 'item-drop-index-altgard.json' : 'item-drop-index.json'
}

function gatherFileName(regionId: RegionId): string {
  return regionId === 'altgard' ? 'item-gather-index-altgard.json' : 'item-gather-index.json'
}

function regionDisplayName(regionId: RegionId): string {
  return regionLabelEn(regionId)
}

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

function composeDropFileFromIndex(itemId: string, regionId: RegionId = 'verteron'): ItemDropFile | null {
  const index = dropIndexes.get(regionId) ?? (regionId === 'verteron' ? dropIndex : null)
  if (!index) return null
  let cache = composedDropCaches.get(regionId)
  if (!cache) {
    cache = new Map()
    composedDropCaches.set(regionId, cache)
  }
  if (cache.has(itemId)) return cache.get(itemId) ?? null

  const links = index.items[itemId]
  if (!links?.length) {
    cache.set(itemId, null)
    return null
  }

  const sources: DropSource[] = []
  for (const link of links) {
    const mob = index.mobs[link.mobId]
    if (!mob?.spawns?.length) continue
    sources.push({
      mobId: link.mobId,
      nameEn: mob.nameEn || `NPC ${link.mobId}`,
      nameRu: mob.nameRu ?? null,
      level: mob.level ?? null,
      region: regionDisplayName(regionId),
      regionId,
      rate: link.rate,
      hasMap: true,
      onmapUrl: `https://dbaion2.ru/en/map/#${regionId}&npc=${link.mobId}`,
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
    cache.set(itemId, null)
    return null
  }

  sources.sort((a, b) => b.rate - a.rate || a.nameEn.localeCompare(b.nameEn, 'en'))
  const file: ItemDropFile = {
    itemId,
    scrapedAt: index.scrapedAt || '',
    source: index.source || 'dbaion2.ru',
    sourceUrl: `https://dbaion2.ru/en/items/${itemId}/`,
    sources,
  }
  cache.set(itemId, file)
  return file
}

export async function ensureItemDropIndex(regionId: RegionId = 'verteron'): Promise<DropIndexFile | null> {
  if (dropIndexes.has(regionId) && dropIndexes.get(regionId)) {
    dropIndex = dropIndexes.get(regionId) ?? null
    return dropIndexes.get(regionId) ?? null
  }
  const pending = dropIndexPromises.get(regionId)
  if (pending) return pending

  const promise = (async () => {
    const res = await fetch(publicDataUrl(dropFileName(regionId)), {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })
    if (!res.ok) {
      console.warn(`Item drop index (${regionId}) HTTP ${res.status}`)
      dropIndexes.set(regionId, null)
      return null
    }
    const data = (await res.json()) as DropIndexFile
    dropIndexes.set(regionId, data)
    composedDropCaches.set(regionId, new Map())
    if (regionId === 'verteron') dropIndex = data
    return data
  })().catch((err: unknown) => {
    console.warn(`Item drop index (${regionId}) failed`, err)
    dropIndexPromises.delete(regionId)
    return null
  })

  dropIndexPromises.set(regionId, promise)
  return promise
}

export async function ensureItemGatherIndex(regionId: RegionId = 'verteron'): Promise<GatherIndexFile | null> {
  if (gatherIndexes.has(regionId) && gatherIndexes.get(regionId)) {
    gatherIndex = gatherIndexes.get(regionId) ?? null
    return gatherIndexes.get(regionId) ?? null
  }
  const pending = gatherIndexPromises.get(regionId)
  if (pending) return pending

  const promise = (async () => {
    const res = await fetch(publicDataUrl(gatherFileName(regionId)), {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })
    if (!res.ok) {
      console.warn(`Item gather index (${regionId}) HTTP ${res.status}`)
      gatherIndexes.set(regionId, null)
      return null
    }
    const data = (await res.json()) as GatherIndexFile
    gatherIndexes.set(regionId, data)
    if (regionId === 'verteron') gatherIndex = data
    return data
  })().catch((err: unknown) => {
    console.warn(`Item gather index (${regionId}) failed`, err)
    gatherIndexPromises.delete(regionId)
    return null
  })

  gatherIndexPromises.set(regionId, promise)
  return promise
}

export function getGatherLayerForItem(itemId: string, regionId: RegionId = 'verteron'): GatherIndexLayer | null {
  const index = gatherIndexes.get(regionId) ?? (regionId === 'verteron' ? gatherIndex : null)
  if (!index) return null
  const layerId = index.items[itemId]
  if (!layerId) return null
  return index.layers[layerId] ?? null
}

export function itemHasMap(item: ItemDef, regionId: RegionId = 'verteron'): boolean {
  if (regionId === 'altgard') {
    return Boolean(item.hasAltgardMap || item.hasAltgardGatherMap)
  }
  return Boolean(item.hasVerteronMap || item.hasGatherMap)
}

function normalizeCatalogItem(item: ItemDef): ItemDef {
  return {
    ...item,
    gatherSpawnCount: item.gatherSpawnCount ?? 0,
    hasGatherMap: Boolean(item.hasGatherMap),
    altgardSpawnCount: item.altgardSpawnCount ?? 0,
    hasAltgardMap: Boolean(item.hasAltgardMap),
    altgardGatherSpawnCount: item.altgardGatherSpawnCount ?? 0,
    hasAltgardGatherMap: Boolean(item.hasAltgardGatherMap),
  }
}

export async function ensureItemCatalog(regionId: RegionId = 'verteron'): Promise<ItemDef[]> {
  if (catalogStatus.value === 'ready' && catalogItems.value.length) {
    void ensureItemDropIndex(regionId)
    void ensureItemGatherIndex(regionId)
    return catalogItems.value
  }
  if (loadPromise) return loadPromise

  catalogStatus.value = 'loading'
  catalogError.value = null

  loadPromise = (async () => {
    const [res] = await Promise.all([
      fetch(publicDataUrl('items-catalog.json'), {
        cache: 'no-store',
        headers: { accept: 'application/json' },
      }),
      ensureItemDropIndex(regionId),
      ensureItemGatherIndex(regionId),
    ])
    if (!res.ok) throw new Error(`Catalog HTTP ${res.status}`)
    const data = (await res.json()) as ItemCatalogFile
    const items = (Array.isArray(data.items) ? data.items : []).map(normalizeCatalogItem)
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

export function getItemDrops(itemKey: string, regionId: RegionId = 'verteron'): ItemDropFile | null {
  if (regionId === 'verteron' && SEED_DROPS[itemKey]) return SEED_DROPS[itemKey]
  const itemId = resolveNumericItemId(itemKey)
  const fromIndex = composeDropFileFromIndex(itemId, regionId)
  if (fromIndex) return fromIndex
  if (regionId === 'verteron') {
    for (const [slug, id] of Object.entries(SEED_SLUG_TO_ITEM_ID)) {
      if (id === itemId && SEED_DROPS[slug]) return SEED_DROPS[slug]
    }
  }
  return null
}

export function getItemDropSource(
  itemKey: string,
  mobId: string,
  regionId: RegionId = 'verteron',
): DropSource | null {
  const file = getItemDrops(itemKey, regionId)
  if (!file) return null
  return file.sources.find((s) => s.mobId === mobId) ?? null
}

export function getMobLoot(mobId: string, regionId: RegionId = 'verteron'): MobLootFile | null {
  const local = mobLootById.get(String(mobId))
  if (local) return local
  const index = dropIndexes.get(regionId) ?? (regionId === 'verteron' ? dropIndex : null)
  const mob = index?.mobs?.[String(mobId)]
  if (!mob?.drops?.length) return null
  return {
    mobId: String(mobId),
    scrapedAt: index?.scrapedAt || '',
    source: index?.source || 'dbaion2.ru',
    baseLevel: mob.level ?? null,
    drops: mob.drops,
  }
}

export function getSharedLevelLoot(level: number, regionId: RegionId = 'verteron'): SharedLevelLootFile | null {
  if (level !== 45) return null
  if (regionId === 'altgard') return SHARED_LEVEL_45_ALTGARD
  return SHARED_LEVEL_45
}

/**
 * Loot as seen by a high-level character: for baseLevel < playerLevel,
 * keep mob-own rewards and attach the shared Lv45 band for the region.
 */
export function getMobLootForPlayer(
  mobId: string,
  opts?: {
    baseLevel?: number | null
    playerLevel?: number
    regionId?: RegionId
    /** Default true — attach shared Lv45 band for low baseLevel mobs. */
    useSharedScaling?: boolean
  },
): MobLootView | null {
  const regionId = opts?.regionId ?? 'verteron'
  const file = getMobLoot(mobId, regionId)
  if (!file) return null
  const playerLevel = opts?.playerLevel ?? ASSUMED_PLAYER_LEVEL
  const baseLevel = opts?.baseLevel ?? file.baseLevel ?? null
  const useSharedScaling = opts?.useSharedScaling !== false
  const shared = getSharedLevelLoot(playerLevel, regionId)
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

function sortItems(list: ItemDef[], sort: ItemSortKey, regionId: RegionId = 'verteron'): ItemDef[] {
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
        const aMap = itemHasMap(a, regionId)
        const bMap = itemHasMap(b, regionId)
        if (aMap !== bMap) return aMap ? -1 : 1
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
  const regionId = input.regionId ?? 'verteron'
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
    if (input.onlyWithDropPoints && !itemHasMap(item, regionId)) return false
    if (!q) return true
    const hay = normalizeSearch(
      `${item.nameEn} ${item.nameRu} ${item.itemId} ${item.category} ${item.categoryName || ''}`,
    )
    return hay.includes(q)
  })

  return sortItems(matched, input.sort, regionId)
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

export function getItemDropMarkers(itemKey: string, regionId: RegionId = 'verteron'): DropChanceMarker[] {
  let file: ItemDropFile | null = null
  for (const key of dropLookupKeys(itemKey)) {
    file = getItemDrops(key, regionId)
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
  opts?: { minRate?: number, maxRate?: number, regionId?: RegionId },
): MapScene {
  const regionId = opts?.regionId ?? 'verteron'
  let markers = getItemDropMarkers(item.itemId, regionId)
  if (!markers.length && item.id !== item.itemId) {
    markers = getItemDropMarkers(item.id, regionId)
  }
  const lo = opts?.minRate
  const hi = opts?.maxRate
  if (lo != null || hi != null) {
    const minR = lo ?? 0
    const maxR = hi ?? Number.POSITIVE_INFINITY
    markers = markers.filter((m) => m.rate >= minR && m.rate <= maxR)
  }
  const label = regionDisplayName(regionId)
  return createMapScene({
    map: mapDefinitionForRegion(regionId),
    markers,
    focusPoint: null,
    emptyMessage: `Нет координат дропа на карте ${label}.`,
    focusLabel: 'Все координаты',
    hintExtra: markers.length
      ? `${markers.length} координат · клик по % — карточка моба`
      : undefined,
  })
}

export function getItemGatherMarkers(itemId: string, regionId: RegionId = 'verteron'): GatherNodeMarker[] {
  const index = gatherIndexes.get(regionId) ?? (regionId === 'verteron' ? gatherIndex : null)
  if (!index) return []
  const layerId = index.items[itemId]
  if (!layerId) return []
  const layer = index.layers[layerId]
  if (!layer?.spawns?.length) return []
  const name = layer.nameRu || layer.nameEn
  const iconUrl = layer.iconUrl ?? null
  return layer.spawns.map((pt, idx) =>
    new GatherNodeMarker(
      `${layerId}:${idx}`,
      pt,
      layerId,
      name,
      iconUrl,
    ),
  )
}

export function listRegionMobs(regionId: RegionId = 'verteron'): RegionMob[] {
  const index = dropIndexes.get(regionId) ?? (regionId === 'verteron' ? dropIndex : null)
  if (!index) return []
  const out: RegionMob[] = []
  for (const [mobId, mob] of Object.entries(index.mobs)) {
    const spawns = mob.spawns ?? []
    out.push({
      mobId,
      nameEn: mob.nameEn || `NPC ${mobId}`,
      nameRu: mob.nameRu ?? null,
      level: mob.level ?? null,
      icon: mob.icon ?? null,
      iconUrl: mob.iconUrl ?? null,
      title: mob.title ?? null,
      gradeName: mob.gradeName ?? null,
      creatureName: mob.creatureName ?? null,
      race: mob.race ?? null,
      spawnCount: spawns.length,
      spawns,
    })
  }
  out.sort((a, b) =>
    (a.nameRu || a.nameEn).localeCompare(b.nameRu || b.nameEn, 'ru'),
  )
  return out
}

/** @deprecated Use listRegionMobs('verteron') */
export function listVerteronMobs(): VerteronMob[] {
  return listRegionMobs('verteron')
}

export function createMonsterSpawnScene(
  mob: RegionMob,
  regionId: RegionId = 'verteron',
): MapScene {
  const name = mob.nameRu || mob.nameEn
  const markers = (mob.spawns ?? []).map((pt, idx) =>
    new PortraitNodeMarker(
      `${mob.mobId}:${idx}`,
      pt,
      mob.mobId,
      name,
      mob.iconUrl,
    ),
  )
  const label = regionDisplayName(regionId)
  return createMapScene({
    map: mapDefinitionForRegion(regionId),
    markers,
    focusPoint: null,
    emptyMessage: `Нет координат спауна на карте ${label}.`,
    focusLabel: 'Все координаты',
    hintExtra: markers.length
      ? `${markers.length} координат · клик по портрету — дроп`
      : undefined,
  })
}

export function createItemGatherMapScene(
  item: ItemDef,
  regionId: RegionId = 'verteron',
): MapScene {
  let markers = getItemGatherMarkers(item.itemId, regionId)
  if (!markers.length && item.id !== item.itemId) {
    markers = getItemGatherMarkers(item.id, regionId)
  }
  const label = regionDisplayName(regionId)
  return createMapScene({
    map: mapDefinitionForRegion(regionId),
    markers,
    focusPoint: null,
    emptyMessage: `Нет координат сбора на карте ${label}.`,
    focusLabel: 'Все координаты',
    hintExtra: markers.length
      ? `${markers.length} координат сбора`
      : undefined,
  })
}
