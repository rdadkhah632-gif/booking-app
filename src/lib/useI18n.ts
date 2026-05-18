import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  DEFAULT_LOCALE,
  getStoredLocale,
  isLocale,
  Locale,
  LOCALE_STORAGE_KEY,
  setStoredLocale,
  translate
} from './i18n'

function browserLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE

  const browserLanguage = window.navigator.language?.toLowerCase() || ''
  const browserLanguages = window.navigator.languages?.map((item) => item.toLowerCase()) || []
  const languageList = [browserLanguage, ...browserLanguages]

  if (languageList.some((language) => language.startsWith('sq') || language.includes('al'))) {
    return 'sq'
  }

  return DEFAULT_LOCALE
}

function guestStartingLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  if (isLocale(stored)) return stored

  return browserLocale()
}

export function useI18n() {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)
  const [profileLoaded, setProfileLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadLocalePreference() {
      const guestLocale = guestStartingLocale()
      setLocaleState(guestLocale)
      setStoredLocale(guestLocale)

      const { data: { session } } = await supabase.auth.getSession()

      if (cancelled) return

      if (!session) {
        setProfileLoaded(true)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('preferred_language')
        .eq('id', session.user.id)
        .single<{ preferred_language?: string | null }>()

      if (cancelled) return

      if (isLocale(profile?.preferred_language)) {
        setLocaleState(profile.preferred_language)
        setStoredLocale(profile.preferred_language)
      } else {
        await supabase
          .from('profiles')
          .update({ preferred_language: guestLocale })
          .eq('id', session.user.id)
      }

      setProfileLoaded(true)
    }

    loadLocalePreference()

    function handleStorage(event: StorageEvent) {
      if (event.key === LOCALE_STORAGE_KEY) {
        setLocaleState(getStoredLocale())
      }
    }

    function handleLocaleChange() {
      setLocaleState(getStoredLocale())
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener('mirebook:locale-changed', handleLocaleChange)

    return () => {
      cancelled = true
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('mirebook:locale-changed', handleLocaleChange)
    }
  }, [])

  const api = useMemo(() => {
    async function setLocale(nextLocale: Locale) {
      setStoredLocale(nextLocale)
      setLocaleState(nextLocale)

      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        await supabase
          .from('profiles')
          .update({ preferred_language: nextLocale })
          .eq('id', session.user.id)
      }
    }

    function toggleLocale() {
      setLocale(locale === 'en' ? 'sq' : 'en')
    }

    function t(key: string, fallback?: string) {
      return translate(locale, key, fallback)
    }

    return {
      locale,
      profileLoaded,
      setLocale,
      toggleLocale,
      t
    }
  }, [locale, profileLoaded])

  return api
}