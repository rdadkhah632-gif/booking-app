import Link from 'next/link'
import LanguageToggle from './LanguageToggle'
import { useI18n } from '@/lib/useI18n'
import { useRouter } from 'next/router'
import { getBusinessAppUrl, getCustomerAppUrl } from '@/lib/appUrls'

export default function PublicNav() {
  const { t } = useI18n()
  const router = useRouter()
  const isBusinessEntry = router.pathname === '/business'
  const businessHomeUrl = getBusinessAppUrl()
  const businessLoginUrl = getBusinessAppUrl('/login?product=business')
  const businessRegisterUrl = getBusinessAppUrl(
    '/register?accountType=business',
  )
  const customerHomeUrl = getCustomerAppUrl()

  return (
    <>
      {isBusinessEntry ? (
        <>
          <Link href={customerHomeUrl} className="muted public-customer-link">
            {t('nav.customerProduct', 'Customer Mirëbook')}
          </Link>
          <Link href="/support/business" className="muted nav-wide-only">
            {t('nav.businessSupport', 'Business support')}
          </Link>
        </>
      ) : (
        <>
          <Link
            href="/explore"
            className="muted public-explore-link nav-mobile-optional"
          >
            {t('nav.explore')}
          </Link>
          <Link href={businessHomeUrl} className="muted public-business-link">
            {t('nav.forBusinesses', 'For businesses')}
          </Link>
          <Link href="/support/customer" className="muted nav-wide-only">
            {t('nav.customerSupport', 'Customer support')}
          </Link>
        </>
      )}

      <LanguageToggle />

      <Link
        href={isBusinessEntry ? businessLoginUrl : '/login'}
        className="muted"
      >
        {isBusinessEntry
          ? t('nav.businessLogin', 'Business login')
          : t('nav.login')}
      </Link>

      <Link
        href={
          isBusinessEntry ? businessRegisterUrl : '/register'
        }
        className="btn btn-accent public-register-link"
      >
        {isBusinessEntry
          ? t('nav.startBusiness', 'Start business setup')
          : t('nav.register')}
      </Link>
    </>
  )
}
