/**
 * Farm drop rates live in clear low bands (mostly well under ~15%).
 * Everything above that is a named/boss outlier: own color, no clustering.
 */
export const FARM_DROP_RATE_CAP = 15

/** @deprecated alias — same as FARM_DROP_RATE_CAP */
export const BOSS_DROP_RATE_THRESHOLD = FARM_DROP_RATE_CAP

export type RateColorScale = {
  min: number
  max: number
}

export function isBossExclusiveDrop(rate: number): boolean {
  return Number.isFinite(rate) && rate > FARM_DROP_RATE_CAP
}

/**
 * Fit green↔red ramp from farm rates on the current map only.
 * Outliers (>15%) never enter the scale.
 *
 * Important: pad tiny spans. Otherwise 0.16% vs 0.24% (both look like "~0.2%")
 * stretch across the full red→green ramp and read as random.
 */
export function fitRateColorScale(rates: number[]): RateColorScale {
  const farm = rates.filter((r) => Number.isFinite(r) && !isBossExclusiveDrop(r))
  if (farm.length === 0) return { min: 0, max: FARM_DROP_RATE_CAP }

  let min = Math.min(...farm)
  let max = Math.max(...farm)
  const mid = (min + max) / 2
  // At least ~1% absolute span (or half the mid rate), so close farm bands stay similar.
  const minSpan = Math.max(1, mid * 0.5)
  const span = max - min

  if (span < minSpan) {
    const pad = (minSpan - span) / 2
    min = Math.max(0, min - pad)
    max = Math.min(FARM_DROP_RATE_CAP, max + pad)
    if (max - min < minSpan) {
      max = Math.min(FARM_DROP_RATE_CAP, min + minSpan)
    }
  }
  return { min, max }
}

/**
 * Non-linear position in the farm band.
 * Raw relative t is eased so close low-band groups (1% / 2% / 4%) separate
 * more clearly than a flat 0–50 linear ramp would.
 */
export function farmRateT(rate: number, scale: RateColorScale): number {
  const span = scale.max - scale.min
  if (span <= 0) return 0.5
  const linear = Math.min(1, Math.max(0, (rate - scale.min) / span))
  // >1 expands mid/high farm groups toward green
  return Math.pow(linear, 0.7)
}

/**
 * Farm (≤15%): red = low (worse) → green = high (better).
 * >15%: unique magenta, outside this ramp.
 */
export function rateAccent(rate: number, scale?: RateColorScale): string {
  if (isBossExclusiveDrop(rate)) return '#e879f9'

  const t = farmRateT(rate, scale ?? { min: 0, max: FARM_DROP_RATE_CAP })
  // 0° red (low) → 130° green (high)
  const hue = t * 130
  const sat = 82 - t * 8
  const light = 42 + (1 - Math.abs(t - 0.55)) * 8
  return `hsl(${hue} ${sat}% ${light}%)`
}

export function rateAccentInk(rate: number): string {
  if (isBossExclusiveDrop(rate)) return '#1a061f'
  return '#0c1208'
}

/**
 * Fit red↔green ramp for mob counts (×N) on the current map.
 * Low count = red, high count = green (more farm denser = better).
 */
export function fitCountColorScale(counts: number[]): RateColorScale {
  const vals = counts.filter((n) => Number.isFinite(n) && n >= 2)
  if (vals.length === 0) return { min: 2, max: 16 }

  let min = Math.min(...vals)
  let max = Math.max(...vals)
  if (max <= min) {
    min = Math.max(2, min - 1)
    max = min + 1
  }
  return { min, max }
}

/** Log-ish position so ×2 / ×5 / ×24 separate more evenly than linear. */
export function countT(count: number, scale: RateColorScale): number {
  const lo = Math.log(Math.max(1, scale.min))
  const hi = Math.log(Math.max(scale.min + 1e-6, scale.max))
  const span = hi - lo
  if (span <= 0) return 0.5
  const linear = Math.min(1, Math.max(0, (Math.log(Math.max(1, count)) - lo) / span))
  return Math.pow(linear, 0.85)
}

export function countAccent(count: number, scale?: RateColorScale): string {
  const t = countT(count, scale ?? { min: 2, max: 16 })
  const hue = t * 130
  const sat = 88 - t * 6
  const light = 48 + (1 - Math.abs(t - 0.5)) * 10
  return `hsl(${hue} ${sat}% ${light}%)`
}
