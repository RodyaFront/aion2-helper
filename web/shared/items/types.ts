import type { MapPoint } from '../map/types'

export type ItemCategory = 'crafting_material' | 'material' | string

export type ItemDef = {
  id: string
  itemId: string
  nameEn: string
  nameRu: string
  category: ItemCategory
  grade?: string
  icon: string | null
  sourceUrl: string
  dropSourceCount: number
  verteronSpawnCount: number
  hasVerteronMap: boolean
}

export type DropSource = {
  mobId: string
  nameEn: string
  nameRu: string | null
  level: number | null
  region: string | null
  regionId: string | null
  rate: number
  hasMap: boolean
  onmapUrl: string | null
  /** dbaion2 icon key, e.g. UT_256_MOB_… */
  icon?: string | null
  /** Local `/mobs/{id}.webp` or remote dbaion2 icon URL. */
  iconUrl?: string | null
  /** Subtitle from dbaion2, e.g. "Verteron Unique". */
  title?: string | null
  gradeName?: string | null
  creatureName?: string | null
  race?: string | null
  spawns: MapPoint[]
}

export type ItemDropFile = {
  itemId: string
  scrapedAt: string
  source: string
  sourceUrl: string
  sources: DropSource[]
}

export type ItemCatalogFile = {
  scrapedAt: string
  source: string
  attribution: string
  items: ItemDef[]
}
