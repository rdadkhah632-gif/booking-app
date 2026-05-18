import Link from 'next/link'
import { NavProps, notificationLabel } from './navTypes'

export default function StaffNav({ onLogout }: NavProps) {
  return (
    <>
      <Link href="/staff" className="muted">
        Schedule
      </Link>

      <Link href="/staff/availability" className="muted">
        Availability
      </Link>

      <Link href="/notifications" className="muted nav-wide-only">
        {notificationLabel('staff', 0)}
      </Link>

      <Link href="/support/staff" className="muted nav-wide-only">
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