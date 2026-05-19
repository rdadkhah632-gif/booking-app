import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, Locale } from './types'

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'sq'
}

export function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  return isLocale(stored) ? stored : DEFAULT_LOCALE
}

export function setStoredLocale(locale: Locale) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  window.dispatchEvent(new Event('mirebook:locale-changed'))
}