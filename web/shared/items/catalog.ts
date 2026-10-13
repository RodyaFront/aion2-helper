import { DropChanceMarker } from '../map/markers'
import { createMapScene } from '../map/scene'
import type { MapScene } from '../map/types'
import { VERTERON_MAP_DEFINITION } from '../map/verteron'
import catalogJson from './catalog.json'
import freshRawMeatDrops from './drops/fresh_raw_meat.json'
import rawLeatherDrops from './drops/raw_leather.json'
import refiningStoneDrops from './drops/refining_stone.json'
import type { DropSource, ItemCatalogFile, ItemDef, ItemDropFile } from './types'

export type { ItemDef, DropSource, ItemDropFile } from './types'

const catalog = catalogJson as ItemCatalogFile

const DROPS: Record<string, ItemDropFile> = {
  raw_leather: rawLeatherDrops as ItemDropFile,
  fresh_raw_meat: freshRawMeatDrops as ItemDropFile,
  refining_stone: refiningStoneDrops as ItemDropFile,
}

export const ITEM_CATALOG = catalog
export const ITEMS = catalog.items as ItemDef[]

const byId = new Map(ITEMS.map((i) => [i.id, i]))

export function getItem(id: string): ItemDef | null {
  return byId.get(id) ?? null
}

export function getItemDrops(itemId: string): ItemDropFile | null {
  return DROPS[itemId] ?? null
}

export function getItemDropSource(itemId: string, mobId: string): DropSource | null {
  const file = getItemDrops(itemId)
  if (!file) return null
  return file.sources.find((s) => s.mobId === mobId) ?? null
}

export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

export function filterItems(input: {
  query: string
  category: string
  mapFilter: string
}): ItemDef[] {
  const q = normalizeSearch(input.query.trim())
  return ITEMS.filter((item) => {
    if (input.category !== 'all' && item.category !== input.category) return false
    if (input.mapFilter === 'verteron' && !item.hasVerteronMap) return false
    if (input.mapFilter === 'has-map' && !item.hasVerteronMap) return false
    if (!q) return true
    const hay = normalizeSearch(`${item.nameEn} ${item.nameRu} ${item.itemId}`)
    return hay.includes(q)
  })
}

export function getItemDropMarkers(itemKey: string, regionId = 'verteron'): DropChanceMarker[] {
  const file = getItemDrops(itemKey)
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
  let markers = getItemDropMarkers(item.id, 'verteron')
  const lo = opts?.minRate
  const hi = opts?.maxRate
  if (lo != null || hi != null) {
    const minR = lo ?? 0
    const maxR = hi ?? Number.POSITIVE_INFINITY
    markers = markers.filter((m) => m.rate >= minR && m.rate <= maxR)
  }
  const focus = markers[0]?.point ?? null
  return createMapScene({
    map: VERTERON_MAP_DEFINITION,
    markers,
    focusPoint: focus,
    emptyMessage: 'Нет точек дропа в выбранном диапазоне.',
    focusLabel: 'К меткам',
    hintExtra: markers.length
      ? `${markers.length} точек · клик по % — карточка моба`
      : undefined,
  })
}
