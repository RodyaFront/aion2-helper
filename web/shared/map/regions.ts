import type { RegionId } from '../race'
import {
  ALTGARD_MAP_DEFINITION,
  getAltgardBossCoord,
  type AltgardBossCoord,
} from './altgard'
import type { MapDefinition, MapPoint } from './types'
import {
  getVerteronBossCoord,
  VERTERON_MAP_DEFINITION,
  type VerteronBossCoord,
} from './verteron'

export type RegionBossCoord = VerteronBossCoord | AltgardBossCoord

export function mapDefinitionForRegion(regionId: RegionId): MapDefinition {
  return regionId === 'altgard' ? ALTGARD_MAP_DEFINITION : VERTERON_MAP_DEFINITION
}

export function getBossCoord(regionId: RegionId, bossId: string): RegionBossCoord | null {
  if (regionId === 'altgard') return getAltgardBossCoord(bossId)
  return getVerteronBossCoord(bossId)
}

export function bossCoordToPoint(coord: RegionBossCoord | null): MapPoint | null {
  if (!coord) return null
  return { mapX: coord.mapX, mapY: coord.mapY, x: coord.x, y: coord.y }
}

export function regionLabelEn(regionId: RegionId): string {
  return regionId === 'altgard' ? 'Altgard' : 'Verteron'
}
