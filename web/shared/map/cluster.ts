import { DropChanceMarker, DropClusterMarker } from './markers'
import { isBossExclusiveDrop } from './rateColor'
import type { ClusterViewport, IClusterStrategy, IMapMarker } from './types'

/**
 * Clusters nearby spawn markers that share the same mobId.
 * Different mob types never merge. Rates >50% never cluster or enter range calc.
 */
export class SameMobTypeZoomCluster implements IClusterStrategy {
  constructor(
    /** Screen-px distance under which same-mob markers merge. */
    public readonly screenRadiusPx = 36,
  ) {}

  cluster(markers: IMapMarker[], scale: number, _viewport: ClusterViewport): IMapMarker[] {
    if (markers.length === 0) return []
    const s = Math.max(scale, 0.0001)
    const worldRadius = this.screenRadiusPx / s

    const byMob = new Map<string, IMapMarker[]>()
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
      const list = byMob.get(m.mobId) ?? []
      list.push(m)
      byMob.set(m.mobId, list)
    }

    const out: IMapMarker[] = [...passthrough]
    for (const [mobId, group] of byMob) {
      out.push(...clusterGroup(mobId, group, worldRadius))
    }
    return out
  }
}

function clusterGroup(mobId: string, markers: IMapMarker[], worldRadius: number): IMapMarker[] {
  const remaining = [...markers]
  const result: IMapMarker[] = []
  let clusterSeq = 0

  while (remaining.length > 0) {
    const seed = remaining.shift()!
    const members = [seed]
    let changed = true
    while (changed) {
      changed = false
      for (let i = remaining.length - 1; i >= 0; i--) {
        const candidate = remaining[i]!
        if (members.some((m) => dist(m, candidate) <= worldRadius)) {
          members.push(candidate)
          remaining.splice(i, 1)
          changed = true
        }
      }
    }

    if (members.length === 1) {
      result.push(members[0]!)
      continue
    }

    const rates = members
      .map((m) => m.rate!)
      .filter((r) => Number.isFinite(r) && !isBossExclusiveDrop(r))
    if (rates.length === 0) {
      result.push(...members)
      continue
    }

    const minRate = Math.min(...rates)
    const maxRate = Math.max(...rates)
    const cx = members.reduce((sum, m) => sum + m.point.mapX, 0) / members.length
    const cy = members.reduce((sum, m) => sum + m.point.mapY, 0) / members.length
    const name = members.find((m) => m instanceof DropChanceMarker)?.mobName
      ?? (members[0] as DropChanceMarker | undefined)?.mobName

    result.push(
      new DropClusterMarker(
        `cluster:${mobId}:${clusterSeq++}`,
        { mapX: cx, mapY: cy },
        mobId,
        minRate,
        maxRate,
        members.length,
        name,
      ),
    )
  }

  return result
}

function dist(a: IMapMarker, b: IMapMarker): number {
  const dx = a.point.mapX - b.point.mapX
  const dy = a.point.mapY - b.point.mapY
  return Math.hypot(dx, dy)
}
