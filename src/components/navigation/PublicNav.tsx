import Link from 'next/link'
import LanguageToggle from './LanguageToggle'
import { useI18n } from '@/lib/useI18n'
import { getBusinessAppUrl } from '@/lib/appUrls'

export default function PublicNav() {
  const { t } = useI18n()
  const businessHomeUrl = getBusinessAppUrl()

  return (
    <>
      <Link href="/explore" className="muted public-explore-link">
        {t('nav.explore')}
      </Link>

      <Link href={businessHomeUrl} className="muted public-business-link">
        {t('nav.forBusinesses', 'For businesses')}
      </Link>

      <Link href="/support" className="muted nav-wide-only">
        {t('nav.support')}
      </Link>

      <LanguageToggle />

      <Link href="/login" className="muted">
        {t('nav.login')}
      </Link>

      <Link href="/register" className="btn btn-accent public-register-link">
        {t('nav.register')}
      </Link>
    </>
  )
}
