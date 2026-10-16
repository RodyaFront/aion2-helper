/** Shared map domain contracts (region-agnostic). */

export type MapPoint = {
  mapX: number
  mapY: number
  /** Optional in-game / source-space coords. */
  x?: number
  y?: number
}

export type MapDefinition = {
  id: string
  width: number
  height: number
  tileSize: number
  minZoom: number
  maxZoom: number
  /** e.g. `/maps/verteron/tiles/{z}/{x}/{y}.webp` */
  tileUrlTemplate: string
  overview?: string
  attribution?: string
}

export type MarkerKind = 'pin' | 'percent' | 'cluster' | 'gather' | 'portrait'

export type MarkerRenderModel = {
  kind: MarkerKind
  label: string
  title?: string
  /** For percent/cluster chips. */
  rateText?: string
  count?: number
  accent?: string
  accentInk?: string
  /** Boss-only outlier (>50%): never clustered. */
  bossExclusive?: boolean
  /** Gather node / gather-cluster chip icon. */
  iconUrl?: string | null
}

export interface IMapMarker {
  id: string
  point: MapPoint
  kind: MarkerKind
  /** Same-mob clustering key; absent for boss pins. */
  mobId?: string
  /** Drop rate percent (e.g. 5.2). */
  rate?: number
  /** When true, marker skips zoom clustering and range calc. */
  skipCluster?: boolean
  renderModel(scale?: import('./rateColor').RateColorScale): MarkerRenderModel
}

export type MapScene = {
  map: MapDefinition
  markers: IMapMarker[]
  focusPoint?: MapPoint | null
  emptyMessage?: string
  focusLabel?: string
  hintExtra?: string
}

export type ClusterViewport = {
  width: number
  height: number
}

export interface IClusterStrategy {
  cluster(markers: IMapMarker[], scale: number, viewport: ClusterViewport): IMapMarker[]
}
