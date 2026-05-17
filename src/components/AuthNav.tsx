import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'

type Role = 'customer' | 'business' | 'staff' | null

type AccountMode = 'customer' | 'business' | 'staff'

export default function AuthNav() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<Role>(null)
  const [availableModes, setAvailableModes] = useState<AccountMode[]>([])
  const [notificationCount, setNotificationCount] = useState(0)
  const [staffProfileId, setStaffProfileId] = useState<string | null>(null)
  const [primaryBusinessId, setPrimaryBusinessId] = useState<string | null>(null)

  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setRole(null)
        setAvailableModes([])
        setNotificationCount(0)
        setStaffProfileId(null)
        setPrimaryBusinessId(null)
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
        .select('id, published')
        .eq('user_id', session.user.id)
        .limit(1)

      const { data: linkedStaff } = await supabase
        .from('staff_members')
        .select('id')
        .eq('user_id', session.user.id)
        .limit(1)

      const ownsBusiness = !!ownedBusinesses && ownedBusinesses.length > 0
      const primaryBusiness = ownedBusinesses?.[0] || null
      const hasStaffProfile = !!linkedStaff && linkedStaff.length > 0
      const modes: AccountMode[] = []

      if (ownsBusiness || profile?.role === 'business') modes.push('business')
      if (hasStaffProfile) modes.push('staff')
      modes.push('customer')

      setAvailableModes(modes)
      setStaffProfileId(hasStaffProfile ? linkedStaff[0].id : null)
      setPrimaryBusinessId(primaryBusiness?.id || null)

      if (hasStaffProfile && router.pathname.startsWith('/staff')) {
        setRole('staff')
      } else if (profile?.role === 'business' || ownsBusiness || router.pathname.startsWith('/dashboard')) {
        setRole('business')
      } else {
        setRole('customer')
      }

      if ((profile?.role === 'business' || ownsBusiness) && !router.pathname.startsWith('/staff')) {
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
  }, [router.pathname])

  async function logout() {
    await supabase.auth.signOut()
    setRole(null)
    setAvailableModes([])
    setNotificationCount(0)
    setStaffProfileId(null)
    setPrimaryBusinessId(null)
    router.replace('/')
  }

  function switchMode(nextMode: AccountMode) {
    setRole(nextMode)

    if (nextMode === 'business') {
      router.push('/dashboard')
      return
    }

    if (nextMode === 'staff') {
      router.push('/staff')
      return
    }

    router.push('/explore')
  }

  function notificationLabel() {
    if (role === 'business') {
      if (notificationCount <= 0) return 'Needs action'
      return `Needs action (${notificationCount})`
    }

    if (role === 'staff') {
      return 'Staff updates'
    }

    if (notificationCount <= 0) return 'Notifications'
    return `Notifications (${notificationCount})`
  }

  const logoHref =
    role === 'business'
      ? '/dashboard'
      : role === 'staff'
        ? '/staff'
        : role === 'customer'
          ? '/explore'
          : '/'

  const publicBusinessHref = primaryBusinessId ? `/explore/${primaryBusinessId}` : '/dashboard/businesses'

  function modeButton(mode: AccountMode, label: string) {
    return (
      <button
        type="button"
        onClick={() => switchMode(mode)}
        className={role === mode ? 'auth-mode-active' : ''}
      >
        {label}
      </button>
    )
  }

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

              <Link href="/support" className="muted nav-wide-only">
                Support
              </Link>

              <Link href="/login" className="muted">
                Login
              </Link>

              <Link href="/register" className="btn btn-accent">
                Create account
              </Link>
            </>
          )}

          {!loading && role === 'customer' && (
            <>
              <Link href="/explore" className="muted">
                Explore
              </Link>

              <Link href="/support" className="muted nav-wide-only">
                Support
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
                  {availableModes.includes('customer') && modeButton('customer', 'Customer')}
                  {availableModes.includes('business') && modeButton('business', 'Business')}
                  {availableModes.includes('staff') && modeButton('staff', 'Staff')}
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

              <Link href="/dashboard/bookings" className="muted">
                Bookings
              </Link>

              <Link
                href="/dashboard/notifications"
                className={notificationCount > 0 ? 'btn btn-accent' : 'muted'}
              >
                {notificationLabel()}
              </Link>

              <Link href="/dashboard/businesses" className="muted">
                Setup hub
              </Link>

              <Link href="/dashboard/settings" className="muted nav-wide-only">
                Settings
              </Link>

              <Link href="/dashboard/billing" className="muted nav-wide-only">
                Billing
              </Link>

              <Link href={publicBusinessHref} className="muted nav-wide-only">
                View public page
              </Link>

              {availableModes.length > 1 && (
                <div className="auth-mode-switcher" aria-label="Account mode switcher">
                  {availableModes.includes('customer') && modeButton('customer', 'Customer')}
                  {availableModes.includes('business') && modeButton('business', 'Business')}
                  {availableModes.includes('staff') && modeButton('staff', 'Staff')}
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

          {!loading && role === 'staff' && (
            <>
              <Link href="/staff" className="muted">
                Staff schedule
              </Link>

              <Link href="/staff/availability" className="muted">
                Availability
              </Link>

              <Link href="/notifications" className="muted nav-wide-only">
                Updates
              </Link>

              {availableModes.length > 1 && (
                <div className="auth-mode-switcher" aria-label="Account mode switcher">
                  {availableModes.includes('customer') && modeButton('customer', 'Customer')}
                  {availableModes.includes('business') && modeButton('business', 'Business')}
                  {availableModes.includes('staff') && modeButton('staff', 'Staff')}
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

        .auth-nav-links :global(a),
        .auth-nav-links button {
          flex-shrink: 0;
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

          .nav-wide-only {
            display: none;
          }

          .auth-mode-switcher {
            order: 10;
            width: 100%;
            justify-content: space-between;
          }

          .auth-mode-switcher button {
            flex: 1;
          }
        }
      `}</style>
    </nav>
  )
}