import { DEFAULT_LOCALE, Locale } from './types'
import { translations } from './translations'

export * from './types'
export * from './storage'
export * from './translations'
export * from './dateFormatting'

export function translate(locale: Locale, key: string, fallback?: string) {
  return translations[locale]?.[key] || translations[DEFAULT_LOCALE]?.[key] || fallback || key
}

export function localeCodeFor(locale: Locale) {
  return locale === 'sq' ? 'sq-AL' : 'en-GB'
}
