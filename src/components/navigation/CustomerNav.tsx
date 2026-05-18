import Link from 'next/link'
import LanguageToggle from './LanguageToggle'
import { NavProps, notificationLabel } from './navTypes'

export default function CustomerNav({ notificationCount, onLogout }: NavProps) {
  return (
    <>
      <Link href="/explore" className="muted">
        Explore
      </Link>

      <Link href="/my-bookings" className="muted">
        My bookings
      </Link>

      <Link
        href="/notifications"
        className={notificationCount > 0 ? 'btn btn-accent' : 'muted'}
      >
        {notificationLabel('customer', notificationCount)}
      </Link>

      <Link href="/support/customer" className="muted nav-wide-only">
        Support
      </Link>

      <LanguageToggle />

      <Link href="/account" className="muted">
        Account
      </Link>

      <button onClick={onLogout} className="btn btn-ghost">
        Log out
      </button>
    </>
  )
}