import { BossPinMarker } from './markers'
import type { IMapMarker, MapDefinition, MapPoint, MapScene } from './types'

export function createMapScene(input: {
  map: MapDefinition
  markers: IMapMarker[]
  focusPoint?: MapPoint | null
  emptyMessage?: string
  focusLabel?: string
  hintExtra?: string
}): MapScene {
  return {
    map: input.map,
    markers: input.markers,
    focusPoint: input.focusPoint ?? null,
    emptyMessage: input.emptyMessage,
    focusLabel: input.focusLabel,
    hintExtra: input.hintExtra,
  }
}

export function createBossMapScene(input: {
  map: MapDefinition
  bossId: string
  bossName: string
  point: MapPoint | null
}): MapScene {
  const markers = input.point
    ? [new BossPinMarker(input.bossId, input.point, input.bossName)]
    : []

  return createMapScene({
    map: input.map,
    markers,
    focusPoint: input.point,
    emptyMessage: 'Координаты для этого босса ещё не загружены.',
    focusLabel: 'К боссу',
    hintExtra: input.point && input.point.x != null && input.point.y != null
      ? `${input.point.x}, ${input.point.y}`
      : undefined,
  })
}
