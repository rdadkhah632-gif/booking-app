export type Locale = 'en' | 'sq'

export const DEFAULT_LOCALE: Locale = 'en'

export const LOCALE_STORAGE_KEY = 'mirebook_locale'

type TranslationTree = Record<string, string>

export const translations: Record<Locale, TranslationTree> = {
  en: {
    'language.english': 'English',
    'language.albanian': 'Albanian',
    'language.short.en': 'EN',
    'language.short.sq': 'SQ',

    'nav.explore': 'Explore',
    'nav.support': 'Support',
    'nav.customerSupport': 'Customer support',
    'nav.businessSupport': 'Business support',
    'nav.login': 'Login',
    'nav.register': 'Create account',
    'nav.myBookings': 'My bookings',
    'nav.notifications': 'Notifications',
    'nav.account': 'Account',
    'nav.logout': 'Log out',

    'common.loadingAccount': 'Checking account...',
    'common.marketplace': 'Marketplace',
    'common.retry': 'Retry',
    'common.back': 'Back',
    'common.continue': 'Continue',

    'explore.hero.kicker': 'Mirëbook marketplace',
    'explore.hero.title': 'Find and book local services',
    'explore.hero.subtitle': 'Browse bookable Mirëbook businesses with active services, staff and working hours. Choose a service, pick an available time, and send a booking request or instant confirmation depending on the business settings.',
    'explore.badge.availability': 'Availability-based booking',
    'explore.badge.noCheckout': 'No customer checkout yet',
    'explore.filters.title': 'Search bookable businesses',
    'explore.filters.subtitle': 'Search businesses that are currently bookable on Mirëbook. Only published businesses with active services, active staff and working hours appear here.',
    'explore.search.placeholder': 'Business, service, city...',
    'explore.category.placeholder': 'Barber, nails, salon...',
    'explore.city.placeholder': 'Tirana, Coventry, Milan...',
    'explore.results.title': 'Bookable businesses',
    'explore.empty.title': 'No businesses are live yet',
    'explore.empty.body': 'Businesses appear here when they are published and have active services, active staff and working hours configured. Customers can browse and request appointments without a Mirëbook checkout step.',

    'support.title': 'What do you need help with?',
    'support.subtitle': 'Choose the support route that matches your account type. Customer, business and staff issues are handled separately so the help flow stays focused.',
    'support.customer.title': 'Booking support',
    'support.customer.body': 'Get help with booking requests, confirmations, cancellations, reschedules, notifications and account issues as a customer.',
    'support.business.title': 'Business support',
    'support.business.body': 'Get help with business setup, publishing, services, staff, working hours, booking approval, trials and subscription access.',
    'support.staff.title': 'Staff support',
    'support.staff.body': 'Get help with staff account linking, schedule access, availability problems or being connected to the wrong business.'
  },

  sq: {
    'language.english': 'Anglisht',
    'language.albanian': 'Shqip',
    'language.short.en': 'EN',
    'language.short.sq': 'SQ',

    'nav.explore': 'Eksploro',
    'nav.support': 'Ndihmë',
    'nav.customerSupport': 'Ndihmë për klientë',
    'nav.businessSupport': 'Ndihmë për biznes',
    'nav.login': 'Hyr',
    'nav.register': 'Krijo llogari',
    'nav.myBookings': 'Rezervimet e mia',
    'nav.notifications': 'Njoftime',
    'nav.account': 'Llogaria',
    'nav.logout': 'Dil',

    'common.loadingAccount': 'Po kontrollohet llogaria...',
    'common.marketplace': 'Tregu',
    'common.retry': 'Provo përsëri',
    'common.back': 'Kthehu',
    'common.continue': 'Vazhdo',

    'explore.hero.kicker': 'Tregu Mirëbook',
    'explore.hero.title': 'Gjej dhe rezervo shërbime lokale',
    'explore.hero.subtitle': 'Shfleto biznese në Mirëbook që kanë shërbime aktive, staf dhe orare pune. Zgjidh një shërbim, një orar të lirë dhe dërgo kërkesë rezervimi ose merr konfirmim të menjëhershëm sipas cilësimeve të biznesit.',
    'explore.badge.availability': 'Rezervim sipas disponueshmërisë',
    'explore.badge.noCheckout': 'Pa pagesë nga klienti tani për tani',
    'explore.filters.title': 'Kërko biznese të rezervueshme',
    'explore.filters.subtitle': 'Kërko biznese që janë aktualisht të rezervueshme në Mirëbook. Shfaqen vetëm bizneset e publikuara me shërbime aktive, staf aktiv dhe orare pune.',
    'explore.search.placeholder': 'Biznes, shërbim, qytet...',
    'explore.category.placeholder': 'Berber, thonj, sallon...',
    'explore.city.placeholder': 'Tiranë, Coventry, Milano...',
    'explore.results.title': 'Biznese të rezervueshme',
    'explore.empty.title': 'Nuk ka ende biznese aktive',
    'explore.empty.body': 'Bizneset shfaqen këtu pasi publikohen dhe kanë shërbime aktive, staf aktiv dhe orare pune. Klientët mund të shfletojnë dhe të kërkojnë takime pa pagesë në Mirëbook.',

    'support.title': 'Për çfarë keni nevojë për ndihmë?',
    'support.subtitle': 'Zgjidhni llojin e ndihmës sipas llogarisë tuaj. Çështjet e klientëve, bizneseve dhe stafit trajtohen veçmas që ndihma të jetë më e qartë.',
    'support.customer.title': 'Ndihmë për rezervime',
    'support.customer.body': 'Merrni ndihmë për kërkesa rezervimi, konfirmime, anulime, ndryshime orari, njoftime dhe probleme të llogarisë si klient.',
    'support.business.title': 'Ndihmë për biznes',
    'support.business.body': 'Merrni ndihmë për konfigurimin e biznesit, publikimin, shërbimet, stafin, oraret, miratimin e rezervimeve, provat falas dhe aksesin në abonim.',
    'support.staff.title': 'Ndihmë për staf',
    'support.staff.body': 'Merrni ndihmë për lidhjen e llogarisë së stafit, aksesin në orar, disponueshmërinë ose lidhjen me biznesin e gabuar.'
  }
}

export function isLocale(value: string | null | undefined): value is Locale {
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
  window.dispatchEvent(new CustomEvent('mirebook:locale-changed', { detail: locale }))
}

export function translate(locale: Locale, key: string, fallback?: string) {
  return translations[locale]?.[key] || translations[DEFAULT_LOCALE]?.[key] || fallback || key
}