import type { MapPoint } from '../map/types'

export type ItemCategory = 'crafting_material' | 'material' | string

export type ItemDef = {
  id: string
  itemId: string
  nameEn: string
  nameRu: string
  category: ItemCategory
  /** Human label from dump, e.g. "Crafting Material". */
  categoryName?: string | null
  /** EQUIP | USABLE | MISC | CURRENCY */
  itemType?: string | null
  grade?: string | null
  itemLevel?: number | null
  levelReq?: number | null
  icon: string | null
  iconKey?: string | null
  sourceUrl: string
  dropSourceCount: number
  verteronSpawnCount: number
  hasVerteronMap: boolean
  /** Verteron Resources-layer spawn points (gather nodes). */
  gatherSpawnCount?: number
  hasGatherMap?: boolean
  /** Altgard drop spawn points. */
  altgardSpawnCount?: number
  hasAltgardMap?: boolean
  /** Altgard Resources-layer spawn points. */
  altgardGatherSpawnCount?: number
  hasAltgardGatherMap?: boolean
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
  count?: number
  runtimePath?: string
  items: ItemDef[]
}

/** One line from an NPC drop table (dbaion2). */
export type MobDropLine = {
  itemId: string
  nameEn: string
  icon?: string | null
  iconUrl?: string | null
  gradeName?: string | null
  category?: string | null
  chance: number | null
  min?: number | null
  max?: number | null
}

/** One region mob from the drop index, with spawn points. */
export type RegionMob = {
  mobId: string
  nameEn: string
  nameRu: string | null
  level: number | null
  icon: string | null
  iconUrl: string | null
  title: string | null
  gradeName: string | null
  creatureName: string | null
  race: string | null
  spawnCount: number
  spawns: MapPoint[]
}

/** @deprecated Use RegionMob */
export type VerteronMob = RegionMob

export type MobLootFile = {
  mobId: string
  scrapedAt: string
  source: string
  /** Base NPC level from dbaion2 (before player-level scaling). */
  baseLevel?: number | null
  drops: MobDropLine[]
}

/** Shared reward_basic band for an effective monster level (e.g. Verteron 45). */
export type SharedLevelLootFile = {
  level: number
  regionId: string
  region?: string
  scrapedAt: string
  source: string
  method?: string
  seedMobIds?: string[]
  note?: string
  drops: MobDropLine[]
}

export type ItemSortKey =
  | 'name'
  | 'grade'
  | 'level'
  | 'id'
  | 'map'

export type ItemFilterInput = {
  query: string
  category: string
  itemType: string
  grade: string
  /** Only items with drop or gather markers for the active region. */
  onlyWithDropPoints: boolean
  /** Hide skins / titles / pets / wings / decor by default. */
  hideCosmetics: boolean
  sort: ItemSortKey
  /** Active field region for «with coordinates» filter. */
  regionId?: 'verteron' | 'altgard'
}
