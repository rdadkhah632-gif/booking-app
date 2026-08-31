import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  LOCALE_STORAGE_KEY,
  Locale,
} from './types'

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'sq'
}

export function getCookieLocale(): Locale | null {
  if (typeof document === 'undefined') return null

  const cookieLocale = document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${LOCALE_COOKIE_NAME}=`))
    ?.split('=')[1]

  return isLocale(cookieLocale) ? cookieLocale : null
}

export function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  if (isLocale(stored)) return stored

  return getCookieLocale() || DEFAULT_LOCALE
}

export function setStoredLocale(locale: Locale) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`
  window.dispatchEvent(new Event('mirebook:locale-changed'))
}
