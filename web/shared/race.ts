/** Player faction → home field region. */

export type PlayerRace = 'elyos' | 'asmodian'

export type RegionId = 'verteron' | 'altgard'

export const RACE_REGION: Record<PlayerRace, RegionId> = {
  elyos: 'verteron',
  asmodian: 'altgard',
}

export const REGION_RACE: Record<RegionId, PlayerRace> = {
  verteron: 'elyos',
  altgard: 'asmodian',
}

export const RACE_LABEL_RU: Record<PlayerRace, string> = {
  elyos: 'Элийцы',
  asmodian: 'Асмодиане',
}

export const REGION_LABEL_RU: Record<RegionId, string> = {
  verteron: 'Вертерон',
  altgard: 'Альтгард',
}

export function regionForRace(race: PlayerRace): RegionId {
  return RACE_REGION[race]
}

export function normalizeRace(raw: unknown): PlayerRace {
  return raw === 'asmodian' ? 'asmodian' : 'elyos'
}

export function isRegionId(raw: unknown): raw is RegionId {
  return raw === 'verteron' || raw === 'altgard'
}
