import { createContext, useContext, useEffect, useMemo, useState } from 'react'
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

type I18nContextValue = {
  locale: Locale
  profileLoaded: boolean
  setLocale: (nextLocale: Locale) => Promise<void>
  toggleLocale: () => void
  t: (key: string, fallback?: string) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
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

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      setProfileLoaded(false)
      loadLocalePreference()
    })

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
      authListener.subscription.unsubscribe()
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('mirebook:locale-changed', handleLocaleChange)
    }
  }, [])

  const value = useMemo<I18nContextValue>(() => {
    async function setLocale(nextLocale: Locale) {
      setStoredLocale(nextLocale)
      setLocaleState(nextLocale)

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('mirebook:locale-changed'))
      }

      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        const { error } = await supabase
          .from('profiles')
          .update({ preferred_language: nextLocale })
          .eq('id', session.user.id)

        if (error) {
          console.error('Could not save language preference', error)
        }
      }
    }

    function toggleLocale() {
      void setLocale(locale === 'en' ? 'sq' : 'en')
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

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)

  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider')
  }

  return context
}