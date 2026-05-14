import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'

type Role = 'customer' | 'business' | null

type AccountMode = 'customer' | 'business'

export default function AuthNav() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<Role>(null)
  const [availableModes, setAvailableModes] = useState<AccountMode[]>([])
  const [notificationCount, setNotificationCount] = useState(0)

  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setRole(null)
        setAvailableModes([])
        setNotificationCount(0)
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      const { data: ownedBusinesses } = await supabase
        .from('businesses')
        .select('id')
        .eq('user_id', session.user.id)
        .limit(1)

      const ownsBusiness = !!ownedBusinesses && ownedBusinesses.length > 0
      const modes: AccountMode[] = ownsBusiness || profile?.role === 'business'
        ? ['business', 'customer']
        : ['customer']

      setAvailableModes(modes)

      if (profile?.role === 'business' || ownsBusiness) {
        setRole('business')
      } else {
        setRole('customer')
      }

      if (profile?.role === 'business' || ownsBusiness) {
        const businessIds = (ownedBusinesses || []).map((business) => business.id)

        if (businessIds.length > 0) {
          const { count: pendingBookingsCount } = await supabase
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .in('business_id', businessIds)
            .eq('status', 'pending')

          const { data: pendingRequests } = await supabase
            .from('booking_requests')
            .select('booking_id')
            .in('business_id', businessIds)
            .eq('status', 'pending')

          const uniquePendingReschedules = new Set((pendingRequests || []).map((request) => request.booking_id)).size
          setNotificationCount((pendingBookingsCount || 0) + uniquePendingReschedules)
        } else {
          setNotificationCount(0)
        }
      } else {
        const { count: pendingBookingsCount } = await supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('customer_user_id', session.user.id)
          .eq('status', 'pending')

        const { data: pendingRequests } = await supabase
          .from('booking_requests')
          .select('booking_id')
          .eq('customer_user_id', session.user.id)
          .eq('status', 'pending')

        const uniquePendingReschedules = new Set((pendingRequests || []).map((request) => request.booking_id)).size
        setNotificationCount((pendingBookingsCount || 0) + uniquePendingReschedules)
      }

      setLoading(false)
    }

    loadUser()
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    setRole(null)
    setAvailableModes([])
    setNotificationCount(0)
    router.replace('/')
  }

  function switchMode(nextMode: AccountMode) {
    setRole(nextMode)

    if (nextMode === 'business') {
      router.push('/dashboard')
      return
    }

    router.push('/explore')
  }

  function notificationLabel() {
    if (notificationCount <= 0) return 'Notifications'
    return `Needs action (${notificationCount})`
  }

  const logoHref =
    role === 'business'
      ? '/dashboard'
      : role === 'customer'
        ? '/explore'
        : '/'

  return (
    <nav className="nav-simple">
      <div className="nav-simple-inner">
        <Link href={logoHref} className="logo">
          Mirë<span>book</span>
        </Link>

        <div className="auth-nav-links">
          {loading && (
            <span className="muted small">Checking account...</span>
          )}

          {!loading && !role && (
            <>
              <Link href="/explore" className="muted">
                Explore Mirëbook
              </Link>

              <Link href="/login" className="muted">
                Login
              </Link>

              <Link href="/register" className="btn btn-accent">
                Join Mirëbook
              </Link>
            </>
          )}

          {!loading && role === 'customer' && (
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
                {notificationLabel()}
              </Link>

              {availableModes.length > 1 && (
                <div className="auth-mode-switcher" aria-label="Account mode switcher">
                  <button
                    type="button"
                    onClick={() => switchMode('customer')}
                    className="auth-mode-active"
                  >
                    Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('business')}
                    className=""
                  >
                    Business
                  </button>
                </div>
              )}

              <Link href="/account" className="muted">
                Account
              </Link>

              <button onClick={logout} className="btn btn-ghost">
                Log out
              </button>
            </>
          )}

          {!loading && role === 'business' && (
            <>
              <Link href="/dashboard" className="muted">
                Dashboard
              </Link>

              <Link href="/dashboard/analytics" className="muted">
                Analytics
              </Link>

              <Link href="/dashboard/bookings" className="muted">
                Bookings
              </Link>

              <Link href="/dashboard/businesses" className="muted">
                Business profile
              </Link>

              <Link
                href="/dashboard/notifications"
                className={notificationCount > 0 ? 'btn btn-accent' : 'muted'}
              >
                {notificationLabel()}
              </Link>

              <Link href="/explore" className="muted">
                Marketplace preview
              </Link>

              {availableModes.length > 1 && (
                <div className="auth-mode-switcher" aria-label="Account mode switcher">
                  <button
                    type="button"
                    onClick={() => switchMode('customer')}
                    className=""
                  >
                    Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('business')}
                    className="auth-mode-active"
                  >
                    Business
                  </button>
                </div>
              )}

              <Link href="/account" className="muted">
                Account
              </Link>

              <button onClick={logout} className="btn btn-ghost">
                Log out
              </button>
            </>
          )}
        </div>
      </div>
      <style jsx>{`
        .auth-nav-links {
          display: flex;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .auth-mode-switcher {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.2rem;
          border: 1px solid var(--border);
          border-radius: 999px;
          background: var(--surface-2);
        }

        .auth-mode-switcher button {
          border: 0;
          background: transparent;
          color: var(--text-muted);
          border-radius: 999px;
          padding: 0.35rem 0.65rem;
          cursor: pointer;
          font: inherit;
          font-size: 0.85rem;
        }

        .auth-mode-switcher button.auth-mode-active {
          background: var(--accent-dim);
          color: var(--accent);
        }

        @media (max-width: 760px) {
          .auth-nav-links {
            width: 100%;
            justify-content: flex-start;
            gap: 0.7rem;
          }
        }
      `}</style>
    </nav>
  )
}