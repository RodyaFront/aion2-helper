import { AffineCoordProjector } from './projector'
import type { MapDefinition } from './types'
import verteronMap from './verteron.json'

export type VerteronBossCoord = {
  id: string
  name: string
  nameSource: string
  /** Quellkoordinaten / source space (matches KINA world-boss page). */
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

export type VerteronMapData = typeof verteronMap

export const VERTERON_MAP = verteronMap as VerteronMapData

export const VERTERON_BOSS_COORDS = VERTERON_MAP.bosses as VerteronBossCoord[]

export const VERTERON_MAP_DEFINITION: MapDefinition = {
  id: 'verteron',
  width: VERTERON_MAP.map.width || 8192,
  height: VERTERON_MAP.map.height || 8192,
  tileSize: VERTERON_MAP.map.tileSize || 512,
  minZoom: VERTERON_MAP.map.minZoom ?? 0,
  maxZoom: Math.min(VERTERON_MAP.map.maxZoom ?? 3, 3),
  tileUrlTemplate: VERTERON_MAP.map.tileUrlTemplate
    || '/maps/verteron/tiles/{z}/{x}/{y}.webp',
  overview: VERTERON_MAP.map.overview,
  attribution: VERTERON_MAP.map.attribution,
}

const byId = new Map(VERTERON_BOSS_COORDS.map((b) => [b.id, b]))

export function getVerteronBossCoord(bossId: string): VerteronBossCoord | null {
  return byId.get(bossId) ?? null
}

export function verteronBossesMissingCoords() {
  return VERTERON_MAP.missing
}

/** Projector fitted from known Verteron boss control points. */
export const VERTERON_PROJECTOR = AffineCoordProjector.fitSimple(
  VERTERON_MAP_DEFINITION,
  VERTERON_BOSS_COORDS.map((b) => ({
    x: b.x,
    y: b.y,
    mapX: b.mapX,
    mapY: b.mapY,
  })),
)

export function projectVerteronSource(x: number, y: number) {
  return VERTERON_PROJECTOR?.toMap(x, y) ?? null
}
