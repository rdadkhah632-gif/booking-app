import Link from 'next/link'
import LanguageToggle from './LanguageToggle'
import { useI18n } from '@/lib/useI18n'

export default function PublicNav() {
  const { t } = useI18n()
  return (
    <>
      <Link href="/explore" className="muted">
        {t('nav.explore')}
      </Link>

      <Link href="/support" className="muted nav-wide-only">
        {t('nav.support')}
      </Link>

      <LanguageToggle />

      <Link href="/login" className="muted">
        {t('nav.login')}
      </Link>

      <Link href="/register" className="btn btn-accent">
        {t('nav.register')}
      </Link>
    </>
  )
}