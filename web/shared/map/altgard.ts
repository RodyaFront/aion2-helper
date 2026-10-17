import { AffineCoordProjector } from './projector'
import type { MapDefinition } from './types'
import altgardMap from './altgard.json'

export type AltgardBossCoord = {
  id: string
  name: string
  nameSource: string
  /** dbaion2 world / source space. */
  x: number
  y: number
  /** Pixel on 8192×8192 map image. */
  mapX: number
  mapY: number
  description: string
  markerId: string
  source: string
  sourceUrl: string
  coordSystem: string
}

export type AltgardMapData = typeof altgardMap

export const ALTGARD_MAP = altgardMap as AltgardMapData

export const ALTGARD_BOSS_COORDS = ALTGARD_MAP.bosses as AltgardBossCoord[]

export const ALTGARD_MAP_DEFINITION: MapDefinition = {
  id: 'altgard',
  width: ALTGARD_MAP.map.width || 8192,
  height: ALTGARD_MAP.map.height || 8192,
  tileSize: ALTGARD_MAP.map.tileSize || 512,
  minZoom: ALTGARD_MAP.map.minZoom ?? 0,
  maxZoom: Math.min(ALTGARD_MAP.map.maxZoom ?? 3, 3),
  tileUrlTemplate: ALTGARD_MAP.map.tileUrlTemplate
    || '/maps/altgard/tiles/{z}/{x}/{y}.webp',
  overview: ALTGARD_MAP.map.overview,
  attribution: ALTGARD_MAP.map.attribution,
}

const byId = new Map(ALTGARD_BOSS_COORDS.map((b) => [b.id, b]))

export function getAltgardBossCoord(bossId: string): AltgardBossCoord | null {
  return byId.get(bossId) ?? null
}

export function altgardBossesMissingCoords() {
  return ALTGARD_MAP.missing
}

/** Projector fitted from known Altgard boss control points. */
export const ALTGARD_PROJECTOR = AffineCoordProjector.fitSimple(
  ALTGARD_MAP_DEFINITION,
  ALTGARD_BOSS_COORDS.map((b) => ({
    x: b.x,
    y: b.y,
    mapX: b.mapX,
    mapY: b.mapY,
  })),
)

export function projectAltgardSource(x: number, y: number) {
  return ALTGARD_PROJECTOR?.toMap(x, y) ?? null
}
