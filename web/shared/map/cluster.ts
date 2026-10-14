import { DropChanceMarker, DropClusterMarker } from './markers'
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
