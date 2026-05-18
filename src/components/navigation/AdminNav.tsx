import Link from 'next/link'
import { NavProps, notificationLabel } from './navTypes'

export default function AdminNav({ notificationCount, onLogout }: NavProps) {
  return (
    <>
      <Link href="/admin" className="btn btn-accent">
        Operator
      </Link>

      <Link href="/admin/businesses" className="muted">
        Businesses
      </Link>

      <Link href="/admin/users" className="muted">
        Users
      </Link>

      <Link href="/admin/notifications" className={notificationCount > 0 ? 'btn btn-accent' : 'muted'}>
        {notificationLabel('admin', notificationCount)}
      </Link>

      <Link href="/support" className="muted nav-wide-only">
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