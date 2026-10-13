import type { MapDefinition, MapPoint } from './types'

/**
 * Linear affine projector: game/source XY → map pixel XY.
 * Fit from known control points (boss markers) when available.
 */
export class AffineCoordProjector {
  constructor(
    public readonly map: MapDefinition,
    private readonly a: number,
    private readonly b: number,
    private readonly c: number,
    private readonly d: number,
    private readonly e: number,
    private readonly f: number,
  ) {}

  /** Project source/game coords to map pixels. */
  toMap(x: number, y: number): MapPoint {
    return {
      x,
      y,
      mapX: this.a * x + this.b * y + this.c,
      mapY: this.d * x + this.e * y + this.f,
    }
  }

  /**
   * Fit a simple scale+translate (+ optional Y flip) from paired samples.
   * Samples: { x, y, mapX, mapY }.
   */
  static fitSimple(
    map: MapDefinition,
    samples: Array<{ x: number, y: number, mapX: number, mapY: number }>,
  ): AffineCoordProjector | null {
    if (samples.length < 2) return null

    const xs = samples.map((s) => s.x)
    const ys = samples.map((s) => s.y)
    const mxs = samples.map((s) => s.mapX)
    const mys = samples.map((s) => s.mapY)

    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const minMx = Math.min(...mxs)
    const maxMx = Math.max(...mxs)
    const minMy = Math.min(...mys)
    const maxMy = Math.max(...mys)

    const dx = maxX - minX
    const dy = maxY - minY
    if (dx < 1e-6 || dy < 1e-6) return null

    const scaleX = (maxMx - minMx) / dx
    const scaleY = (maxMy - minMy) / dy

    const yFlipped = scaleY < 0
      || (samples.length >= 2 && samples[0]!.y < samples[1]!.y && samples[0]!.mapY > samples[1]!.mapY)

    const sx = scaleX
    const sy = yFlipped ? -Math.abs(scaleY) : Math.abs(scaleY)
    const c = minMx - sx * minX
    const f = yFlipped
      ? maxMy + Math.abs(scaleY) * minY
      : minMy - Math.abs(scaleY) * minY

    return new AffineCoordProjector(map, sx, 0, c, 0, sy, f)
  }

  /** dbaion2 map points are on size 16384; our Verteron tiles are 8192. */
  static dbaion2ToTile8192(map: MapDefinition): AffineCoordProjector {
    return new AffineCoordProjector(map, 0.5, 0, 0, 0, 0.5, 0)
  }
}
