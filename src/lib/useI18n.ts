import { useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_LOCALE,
  getStoredLocale,
  Locale,
  setStoredLocale,
  translate
} from './i18n'

export function useI18n() {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    setLocaleState(getStoredLocale())

    function handleStorage(event: StorageEvent) {
      if (event.key === 'mirebook_locale') {
        setLocaleState(getStoredLocale())
      }
    }

    function handleLocaleChange() {
      setLocaleState(getStoredLocale())
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener('mirebook:locale-changed', handleLocaleChange)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('mirebook:locale-changed', handleLocaleChange)
    }
  }, [])

  const api = useMemo(() => {
    function setLocale(nextLocale: Locale) {
      setStoredLocale(nextLocale)
      setLocaleState(nextLocale)
    }

    function toggleLocale() {
      setLocale(locale === 'en' ? 'sq' : 'en')
    }

    function t(key: string, fallback?: string) {
      return translate(locale, key, fallback)
    }

    return {
      locale,
      setLocale,
      toggleLocale,
      t
    }
  }, [locale])

  return api
}