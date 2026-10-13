import { isBossExclusiveDrop, rateAccent, rateAccentInk, type RateColorScale } from './rateColor'
import type { IMapMarker, MapPoint, MarkerRenderModel } from './types'

function formatRate(rate: number): string {
  const rounded = Math.round(rate * 10) / 10
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`
}

function formatRateRange(min: number, max: number): string {
  if (Math.abs(min - max) < 0.05) return formatRate(min)
  return `${formatRate(min).replace('%', '')}–${formatRate(max)}`
}

export class BossPinMarker implements IMapMarker {
  readonly kind = 'pin' as const

  constructor(
    public readonly id: string,
    public readonly point: MapPoint,
    public readonly label: string,
  ) {}

  renderModel(): MarkerRenderModel {
    return {
      kind: 'pin',
      label: this.label,
      title: this.label,
    }
  }
}

export class DropChanceMarker implements IMapMarker {
  readonly kind = 'percent' as const
  readonly skipCluster: boolean

  constructor(
    public readonly id: string,
    public readonly point: MapPoint,
    public readonly mobId: string,
    public readonly rate: number,
    public readonly mobName?: string,
  ) {
    this.skipCluster = isBossExclusiveDrop(rate)
  }

  renderModel(scale?: RateColorScale): MarkerRenderModel {
    const rateText = formatRate(this.rate)
    const bossExclusive = isBossExclusiveDrop(this.rate)
    return {
      kind: 'percent',
      label: rateText,
      rateText,
      title: this.mobName
        ? `${this.mobName} · ${rateText}${bossExclusive ? ' · именной / босс' : ''}`
        : rateText,
      accent: rateAccent(this.rate, scale),
      accentInk: rateAccentInk(this.rate),
      bossExclusive,
    }
  }
}

export class DropClusterMarker implements IMapMarker {
  readonly kind = 'cluster' as const

  constructor(
    public readonly id: string,
    public readonly point: MapPoint,
    public readonly mobId: string,
    public readonly minRate: number,
    public readonly maxRate: number,
    public readonly count: number,
    public readonly mobName?: string,
  ) {}

  get rate(): number {
    return (this.minRate + this.maxRate) / 2
  }

  renderModel(scale?: RateColorScale): MarkerRenderModel {
    const rateText = formatRateRange(this.minRate, this.maxRate)
    // Color by the stronger end of the clustered farm range.
    const colorRate = this.maxRate
    return {
      kind: 'cluster',
      label: rateText,
      rateText,
      count: this.count,
      title: this.mobName
        ? `${this.mobName} · ${rateText} (${this.count})`
        : `${rateText} (${this.count})`,
      accent: rateAccent(colorRate, scale),
      accentInk: rateAccentInk(colorRate),
    }
  }
}

export { formatRate, formatRateRange }
