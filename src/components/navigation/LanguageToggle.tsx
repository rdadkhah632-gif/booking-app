import { useI18n } from '@/lib/useI18n'

export default function LanguageToggle() {
  const { locale, toggleLocale, t } = useI18n()

  return (
    <button
      type="button"
      className="language-pill nav-wide-only"
      onClick={toggleLocale}
      title={locale === 'en' ? 'Switch to Albanian' : 'Kalo në anglisht'}
      aria-label={locale === 'en' ? 'Switch language to Albanian' : 'Ndrysho gjuhën në anglisht'}
    >
      {locale === 'en' ? t('language.short.en') : t('language.short.sq')}
    </button>
  )
}