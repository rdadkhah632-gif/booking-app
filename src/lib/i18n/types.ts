export type Locale = 'en' | 'sq'

export type TranslationTree = Record<string, string>

export const DEFAULT_LOCALE: Locale = 'en'
export const LOCALE_STORAGE_KEY = 'mirebook_locale'
export const LOCALE_COOKIE_NAME = 'mirebook_locale'
