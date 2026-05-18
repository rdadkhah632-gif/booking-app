import Link from 'next/link'
import { NavProps, notificationLabel } from './navTypes'

export default function BusinessNav({ notificationCount, primaryBusinessId, onLogout }: NavProps) {
  const publicBusinessHref = primaryBusinessId ? `/explore/${primaryBusinessId}` : '/dashboard/businesses'

  return (
    <>
      <Link href="/dashboard" className="muted">
        Dashboard
      </Link>

      <Link href="/dashboard/bookings" className="muted">
        Bookings
      </Link>

      <Link
        href="/dashboard/notifications"
        className={notificationCount > 0 ? 'btn btn-accent' : 'muted'}
      >
        {notificationLabel('business', notificationCount)}
      </Link>

      <Link href="/dashboard/businesses" className="muted">
        Setup
      </Link>

      <Link href="/dashboard/services" className="muted nav-wide-only">
        Services
      </Link>

      <Link href="/dashboard/staff" className="muted nav-wide-only">
        Staff
      </Link>

      <Link href="/dashboard/settings" className="muted nav-wide-only">
        Settings
      </Link>

      <Link href={publicBusinessHref} className="muted nav-wide-only">
        Public page
      </Link>

      <Link href="/support/business" className="muted nav-wide-only">
        Support
      </Link>

      <Link href="/account" className="muted">
        Account
      </Link>

      <button onClick={onLogout} className="btn btn-ghost">
        Log out
      </button>
    </>
  )
}