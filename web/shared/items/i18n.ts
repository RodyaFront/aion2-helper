import type { ItemDef } from './types'

/**
 * UI / sort locale for item labels.
 * Add a locale here when catalog gains another name field — not a new sort option.
 */
export type AppLocale = 'ru' | 'en'

/** App chrome is Russian today; swap when a real locale switch appears. */
export const APP_LOCALE: AppLocale = 'ru'

type NameGetter = (item: ItemDef) => string | null | undefined

const NAME_BY_LOCALE: Record<AppLocale, NameGetter> = {
  ru: (item) => item.nameRu,
  en: (item) => item.nameEn,
}

/** Fallback order when the preferred locale string is empty. */
const FALLBACK_LOCALES: AppLocale[] = ['en', 'ru']

/** BCP 47 tag for localeCompare / Intl. */
export function localeCompareTag(locale: AppLocale = APP_LOCALE): string {
  return locale
}

/**
 * Primary display name for the active locale, with fallbacks.
 * Future langs: extend AppLocale + NAME_BY_LOCALE (and ItemDef), keep sort key `name`.
 */
export function itemLocalizedName(item: ItemDef, locale: AppLocale = APP_LOCALE): string {
  const primary = NAME_BY_LOCALE[locale]?.(item)?.trim()
  if (primary) return primary
  for (const loc of FALLBACK_LOCALES) {
    if (loc === locale) continue
    const next = NAME_BY_LOCALE[loc]?.(item)?.trim()
    if (next) return next
  }
  return item.itemId
}

/** Secondary line under the primary name (other locale), or null if same/empty. */
export function itemSecondaryName(item: ItemDef, locale: AppLocale = APP_LOCALE): string | null {
  const primary = itemLocalizedName(item, locale)
  for (const loc of FALLBACK_LOCALES) {
    if (loc === locale) continue
    const alt = NAME_BY_LOCALE[loc]?.(item)?.trim()
    if (alt && alt !== primary) return alt
  }
  return null
}
