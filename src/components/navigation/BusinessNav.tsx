import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'
import LanguageToggle from './LanguageToggle'
import { NavProps, notificationLabel } from './navTypes'

export default function BusinessNav({ notificationCount, primaryBusinessId, onLogout }: NavProps) {
  const { t } = useI18n()

  return (
    <>
      <Link href="/dashboard" className="muted">
        {t('account.dashboard')}
      </Link>

      <Link href="/dashboard/bookings" className="muted">
        {t('support.business.bookings')}
      </Link>

      <Link
        href="/dashboard/notifications"
        className={notificationCount > 0 ? 'btn btn-accent' : 'muted'}
      >
        {notificationLabel('business', notificationCount)}
      </Link>

      <Link href="/dashboard/businesses" className="muted">
        {t('account.setup')}
      </Link>

      <Link href="/dashboard/services" className="muted nav-wide-only">
        {t('support.business.services')}
      </Link>

      <Link href="/dashboard/staff" className="muted nav-wide-only">
        {t('support.business.staff')}
      </Link>

      <Link href="/dashboard/settings" className="muted nav-wide-only">
        {t('nav.settings')}
      </Link>

      <Link href="/support/business" className="muted nav-wide-only">
        {t('nav.businessSupport')}
      </Link>

      <LanguageToggle />

      <Link href="/account" className="muted">
        {t('nav.account')}
      </Link>

      <button onClick={onLogout} className="btn btn-ghost">
        {t('nav.logout')}
      </button>
    </>
  )
}