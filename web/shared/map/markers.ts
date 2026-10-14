import { isBossExclusiveDrop, rateAccent, rateAccentInk, type RateColorScale } from './rateColor'
import type { IMapMarker, MapPoint, MarkerRenderModel } from './types'

/** Display rates below this are shown as "<0.1%" (one-decimal rounding would be 0%). */
const RATE_DISPLAY_FLOOR = 0.1

function isRateAbbreviated(rate: number): boolean {
  return Number.isFinite(rate) && rate > 0 && rate < RATE_DISPLAY_FLOOR
}

function formatRate(rate: number): string {
  if (!Number.isFinite(rate)) return '?'
  // Sub-0.1% rounds to 0% at one decimal — keep a readable floor label.
  if (isRateAbbreviated(rate)) return '<0.1%'
  // Under 1%: two decimals so 0.16% vs 0.24% are not both labeled "0.2%".
  if (rate < 1) {
    const rounded = Math.round(rate * 100) / 100
    return `${rounded.toFixed(2)}%`
  }
  const rounded = Math.round(rate * 10) / 10
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`
}

/** Full precision for tooltips when the chip uses "<0.1%" (or any hover detail). */
function formatRatePrecise(rate: number): string {
  if (!Number.isFinite(rate)) return '?'
  if (rate === 0) return '0%'
  const decimals = rate < 0.01 ? 4 : rate < 1 ? 3 : 2
  const trimmed = rate.toFixed(decimals).replace(/\.?0+$/, '')
  return `${trimmed}%`
}

/** Tooltip label with the exact %; null when the chip already shows the same value. */
function rateTooltip(rate: number): string | null {
  if (!isRateAbbreviated(rate)) return null
  return formatRatePrecise(rate)
}

function formatRateRange(min: number, max: number): string {
  if (Math.abs(min - max) < 0.05) return formatRate(min)
  return `${formatRate(min).replace('%', '')}–${formatRate(max)}`
}

function formatRateRangePrecise(min: number, max: number): string {
  if (Math.abs(min - max) < 1e-9) return formatRatePrecise(min)
  return `${formatRatePrecise(min).replace('%', '')}–${formatRatePrecise(max)}`
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
    const rateExact = formatRatePrecise(this.rate)
    const bossExclusive = isBossExclusiveDrop(this.rate)
    return {
      kind: 'percent',
      label: rateText,
      rateText,
      title: this.mobName
        ? `${this.mobName} · ${rateExact}${bossExclusive ? ' · именной / босс' : ''}`
        : rateExact,
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
    const rateExact = formatRateRangePrecise(this.minRate, this.maxRate)
    // Color by the stronger end of the clustered farm range.
    const colorRate = this.maxRate
    return {
      kind: 'cluster',
      label: rateText,
      rateText,
      count: this.count,
      title: this.mobName
        ? `${this.mobName} · ${rateExact} (×${this.count})`
        : `${rateExact} (×${this.count})`,
      accent: rateAccent(colorRate, scale),
      accentInk: rateAccentInk(colorRate),
    }
  }
}

export {
  formatRate,
  formatRatePrecise,
  formatRateRange,
  formatRateRangePrecise,
  isRateAbbreviated,
  rateTooltip,
}
