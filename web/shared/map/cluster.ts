import { DropChanceMarker, DropClusterMarker, GatherClusterMarker, GatherNodeMarker, PortraitClusterMarker, PortraitNodeMarker } from './markers'
import { isBossExclusiveDrop } from './rateColor'
import type { ClusterViewport, IClusterStrategy, IMapMarker } from './types'

/**
 * Clusters nearby spawn markers that share the same mobId via a world grid (O(n)).
 * Different mob types never merge. Boss-exclusive rates (>15%) never cluster.
 */
export class SameMobTypeZoomCluster implements IClusterStrategy {
  constructor(
    /** Screen-px distance under which same-mob markers merge. */
    public readonly screenRadiusPx = 36,
  ) {}

  cluster(markers: IMapMarker[], scale: number, _viewport: ClusterViewport): IMapMarker[] {
    if (markers.length === 0) return []
    const s = Math.max(scale, 0.0001)
    // Cell ≈ merge radius in world units (matches previous screen-radius intent).
    const cellSize = Math.max(this.screenRadiusPx / s, 1e-3)

    type Bucket = {
      mobId: string
      members: IMapMarker[]
      cellX: number
      cellY: number
    }

    const buckets = new Map<string, Bucket>()
    const passthrough: IMapMarker[] = []

    for (const m of markers) {
      const rate = m.rate
      if (
        !m.mobId
        || rate == null
        || m.skipCluster
        || isBossExclusiveDrop(rate)
      ) {
        passthrough.push(m)
        continue
      }
      const cellX = Math.floor(m.point.mapX / cellSize)
      const cellY = Math.floor(m.point.mapY / cellSize)
      const key = `${m.mobId}:${cellX}:${cellY}`
      let bucket = buckets.get(key)
      if (!bucket) {
        bucket = { mobId: m.mobId, members: [], cellX, cellY }
        buckets.set(key, bucket)
      }
      bucket.members.push(m)
    }

    const out: IMapMarker[] = [...passthrough]
    for (const bucket of buckets.values()) {
      out.push(...bucketToMarkers(bucket.mobId, bucket.members, bucket.cellX, bucket.cellY))
    }
    return out
  }
}

function bucketToMarkers(
  mobId: string,
  members: IMapMarker[],
  cellX: number,
  cellY: number,
): IMapMarker[] {
  if (members.length === 1) return [members[0]!]

  const rates = members
    .map((m) => m.rate!)
    .filter((r) => Number.isFinite(r) && !isBossExclusiveDrop(r))
  if (rates.length === 0) return members

  const minRate = Math.min(...rates)
  const maxRate = Math.max(...rates)
  const cx = members.reduce((sum, m) => sum + m.point.mapX, 0) / members.length
  const cy = members.reduce((sum, m) => sum + m.point.mapY, 0) / members.length
  const name = members.find((m) => m instanceof DropChanceMarker)?.mobName
    ?? (members[0] as DropChanceMarker | undefined)?.mobName

  return [
    new DropClusterMarker(
      `cluster:${mobId}:${cellX}:${cellY}`,
      { mapX: cx, mapY: cy },
      mobId,
      minRate,
      maxRate,
      members.length,
      name,
    ),
  ]
}

/**
 * Clusters nearby gather nodes that share the same Resources layer id (mobId).
 */
export class SameGatherLayerCluster implements IClusterStrategy {
  constructor(
    public readonly screenRadiusPx = 36,
  ) {}

  cluster(markers: IMapMarker[], scale: number, _viewport: ClusterViewport): IMapMarker[] {
    if (markers.length === 0) return []
    const s = Math.max(scale, 0.0001)
    const cellSize = Math.max(this.screenRadiusPx / s, 1e-3)

    type Bucket = {
      layerId: string
      members: IMapMarker[]
      cellX: number
      cellY: number
    }

    const buckets = new Map<string, Bucket>()
    const passthrough: IMapMarker[] = []

    for (const m of markers) {
      if (m.kind !== 'gather' || !m.mobId || m.skipCluster) {
        passthrough.push(m)
        continue
      }
      const cellX = Math.floor(m.point.mapX / cellSize)
      const cellY = Math.floor(m.point.mapY / cellSize)
      const key = `${m.mobId}:${cellX}:${cellY}`
      let bucket = buckets.get(key)
      if (!bucket) {
        bucket = { layerId: m.mobId, members: [], cellX, cellY }
        buckets.set(key, bucket)
      }
      bucket.members.push(m)
    }

    const out: IMapMarker[] = [...passthrough]
    for (const bucket of buckets.values()) {
      out.push(...gatherBucketToMarkers(bucket.layerId, bucket.members, bucket.cellX, bucket.cellY))
    }
    return out
  }
}

function gatherBucketToMarkers(
  layerId: string,
  members: IMapMarker[],
  cellX: number,
  cellY: number,
): IMapMarker[] {
  if (members.length === 1) return [members[0]!]

  const seed = members.find((m) => m instanceof GatherNodeMarker) as GatherNodeMarker | undefined
    ?? members.find((m) => m instanceof GatherClusterMarker) as GatherClusterMarker | undefined
  const name = seed?.resourceName ?? layerId
  const iconUrl = seed?.iconUrl ?? null
  const count = members.reduce((sum, m) => {
    if (m instanceof GatherClusterMarker) return sum + m.count
    return sum + 1
  }, 0)
  const cx = members.reduce((sum, m) => sum + m.point.mapX, 0) / members.length
  const cy = members.reduce((sum, m) => sum + m.point.mapY, 0) / members.length

  return [
    new GatherClusterMarker(
      `gather:${layerId}:${cellX}:${cellY}`,
      { mapX: cx, mapY: cy },
      layerId,
      count,
      name,
      iconUrl,
    ),
  ]
}

/** Clusters nearby portrait pins that share the same mob id. */
export class SameMobPortraitCluster implements IClusterStrategy {
  constructor(
    public readonly screenRadiusPx = 36,
  ) {}

  cluster(markers: IMapMarker[], scale: number, _viewport: ClusterViewport): IMapMarker[] {
    if (markers.length === 0) return []
    const s = Math.max(scale, 0.0001)
    const cellSize = Math.max(this.screenRadiusPx / s, 1e-3)

    type Bucket = {
      mobId: string
      members: IMapMarker[]
      cellX: number
      cellY: number
    }

    const buckets = new Map<string, Bucket>()
    const passthrough: IMapMarker[] = []

    for (const m of markers) {
      if (m.kind !== 'portrait' || !m.mobId || m.skipCluster) {
        passthrough.push(m)
        continue
      }
      const cellX = Math.floor(m.point.mapX / cellSize)
      const cellY = Math.floor(m.point.mapY / cellSize)
      const key = `${m.mobId}:${cellX}:${cellY}`
      let bucket = buckets.get(key)
      if (!bucket) {
        bucket = { mobId: m.mobId, members: [], cellX, cellY }
        buckets.set(key, bucket)
      }
      bucket.members.push(m)
    }

    const out: IMapMarker[] = [...passthrough]
    for (const bucket of buckets.values()) {
      out.push(...portraitBucketToMarkers(bucket.mobId, bucket.members, bucket.cellX, bucket.cellY))
    }
    return out
  }
}

function portraitBucketToMarkers(
  mobId: string,
  members: IMapMarker[],
  cellX: number,
  cellY: number,
): IMapMarker[] {
  if (members.length === 1) return [members[0]!]

  const seed = members.find((m) => m instanceof PortraitNodeMarker) as PortraitNodeMarker | undefined
    ?? members.find((m) => m instanceof PortraitClusterMarker) as PortraitClusterMarker | undefined
  const name = seed?.mobName ?? mobId
  const iconUrl = seed?.iconUrl ?? null
  const count = members.reduce((sum, m) => {
    if (m instanceof PortraitClusterMarker) return sum + m.count
    return sum + 1
  }, 0)
  const cx = members.reduce((sum, m) => sum + m.point.mapX, 0) / members.length
  const cy = members.reduce((sum, m) => sum + m.point.mapY, 0) / members.length

  return [
    new PortraitClusterMarker(
      `portrait:${mobId}:${cellX}:${cellY}`,
      { mapX: cx, mapY: cy },
      mobId,
      count,
      name,
      iconUrl,
    ),
  ]
}
