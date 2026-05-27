import Link from 'next/link'
import { NavProps, notificationLabel } from './navTypes'

export default function StaffNav({ notificationCount, onLogout }: NavProps) {
  return (
    <>
      <Link href="/staff" className="muted">
        My schedule
      </Link>

      <Link href="/staff/calendar" className="muted">
        Calendar
      </Link>

      <Link href="/staff/availability" className="muted">
        My availability
      </Link>

      <Link href="/staff/notifications" className="muted nav-wide-only" aria-label="Staff notifications">
        🔔{notificationCount > 0 ? ` ${notificationCount}` : ''}
      </Link>

      <Link href="/support/staff" className="muted nav-wide-only">
        Support
      </Link>

      <Link href="/account" className="muted">
        My account
      </Link>

      <button onClick={onLogout} className="btn btn-ghost">
        Log out
      </button>
    </>
  )
}