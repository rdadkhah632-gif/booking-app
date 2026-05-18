import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'

type Role = 'customer' | 'business' | 'staff' | 'admin' | null

type BusinessRow = {
  id: string
  published?: boolean | null
}

type StaffRow = {
  id: string
}

type ProfileRow = {
  role?: 'customer' | 'business' | 'staff' | string | null
  is_admin?: boolean | null
}

function isAdminRoute(pathname: string) {
  return pathname.startsWith('/admin')
}

function isBusinessRoute(pathname: string) {
  return pathname.startsWith('/dashboard')
}

function isStaffRoute(pathname: string) {
  return pathname.startsWith('/staff')
}

export default function AuthNav() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<Role>(null)
  const [notificationCount, setNotificationCount] = useState(0)
  const [primaryBusinessId, setPrimaryBusinessId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadUser() {
      setLoading(true)

      const { data: { session } } = await supabase.auth.getSession()

      if (cancelled) return

      if (!session) {
        setRole(null)
        setNotificationCount(0)
        setPrimaryBusinessId(null)
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_admin')
        .eq('id', session.user.id)
        .single<ProfileRow>()

      const { data: ownedBusinesses } = await supabase
        .from('businesses')
        .select('id, published')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(10)
        .returns<BusinessRow[]>()

      const { data: linkedStaff } = await supabase
        .from('staff_members')
        .select('id')
        .eq('user_id', session.user.id)
        .limit(1)
        .returns<StaffRow[]>()

      if (cancelled) return

      const ownsBusiness = !!ownedBusinesses && ownedBusinesses.length > 0
      const primaryBusiness = ownedBusinesses?.[0] || null
      const hasStaffProfile = !!linkedStaff && linkedStaff.length > 0
      const adminUser = !!profile?.is_admin

      setPrimaryBusinessId(primaryBusiness?.id || null)

      if (adminUser) {
        setRole('admin')
      } else if (profile?.role === 'business' || ownsBusiness) {
        setRole('business')
      } else if (hasStaffProfile) {
        setRole('staff')
      } else {
        setRole('customer')
      }

      await loadNotificationCounts({
        userId: session.user.id,
        activePath: router.pathname,
        adminUser,
        ownsBusiness,
        businessIds: (ownedBusinesses || []).map((business) => business.id)
      })

      if (!cancelled) setLoading(false)
    }

    loadUser()

    return () => {
      cancelled = true
    }
  }, [router.pathname])

  async function loadNotificationCounts(params: {
    userId: string
    activePath: string
    adminUser: boolean
    ownsBusiness: boolean
    businessIds: string[]
  }) {
    if (params.adminUser && isAdminRoute(params.activePath)) {
      const { count: unreadAdminCount } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('audience', 'admin')
        .is('read_at', null)

      setNotificationCount(unreadAdminCount || 0)
      return
    }

    if ((params.ownsBusiness || isBusinessRoute(params.activePath)) && !isStaffRoute(params.activePath) && params.businessIds.length > 0) {
      const { count: pendingBookingsCount } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .in('business_id', params.businessIds)
        .eq('status', 'pending')

      const { data: pendingRequests } = await supabase
        .from('booking_requests')
        .select('booking_id')
        .in('business_id', params.businessIds)
        .eq('status', 'pending')

      const { count: unreadBusinessNotifications } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', params.userId)
        .eq('audience', 'business')
        .is('read_at', null)

      const uniquePendingReschedules = new Set((pendingRequests || []).map((request) => request.booking_id)).size
      setNotificationCount((pendingBookingsCount || 0) + uniquePendingReschedules + (unreadBusinessNotifications || 0))
      return
    }

    const { count: pendingBookingsCount } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('customer_user_id', params.userId)
      .eq('status', 'pending')

    const { data: pendingRequests } = await supabase
      .from('booking_requests')
      .select('booking_id')
      .eq('customer_user_id', params.userId)
      .eq('status', 'pending')

    const { count: unreadCustomerNotifications } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', params.userId)
      .in('audience', ['general', 'customer'])
      .is('read_at', null)

    const uniquePendingReschedules = new Set((pendingRequests || []).map((request) => request.booking_id)).size
    setNotificationCount((pendingBookingsCount || 0) + uniquePendingReschedules + (unreadCustomerNotifications || 0))
  }

  async function logout() {
    await supabase.auth.signOut()
    setRole(null)
    setNotificationCount(0)
    setPrimaryBusinessId(null)
    router.replace('/')
  }

  function notificationLabel() {
    if (role === 'admin') {
      if (notificationCount <= 0) return 'Operator notices'
      return `Operator notices (${notificationCount})`
    }

    if (role === 'business') {
      if (notificationCount <= 0) return 'Needs action'
      return `Needs action (${notificationCount})`
    }

    if (role === 'staff') {
      return 'Updates'
    }

    if (notificationCount <= 0) return 'Notifications'
    return `Notifications (${notificationCount})`
  }

  const logoHref = useMemo(() => {
    if (role === 'admin') return '/admin'
    if (role === 'business') return '/dashboard'
    if (role === 'staff') return '/staff'
    if (role === 'customer') return '/explore'
    return '/'
  }, [role])

  const publicBusinessHref = primaryBusinessId ? `/explore/${primaryBusinessId}` : '/dashboard/businesses'

  function languagePlaceholder() {
    return (
      <span className="language-pill nav-wide-only" title="Language toggle planned for the public launch pass">
        EN
      </span>
    )
  }

  return (
    <nav className={role === 'admin' ? 'nav-simple nav-operator' : 'nav-simple'}>
      <div className="nav-simple-inner">
        <Link href={logoHref} className="logo">
          Mirë<span>book</span>
          {role === 'admin' && <em>Operator</em>}
        </Link>

        <div className="auth-nav-links">
          {loading && (
            <span className="muted small">Checking account...</span>
          )}

          {!loading && !role && (
            <>
              <Link href="/explore" className="muted">
                Explore
              </Link>

              <Link href="/support" className="muted nav-wide-only">
                Support
              </Link>

              {languagePlaceholder()}

              <Link href="/login" className="muted">
                Login
              </Link>

              <Link href="/register" className="btn btn-accent">
                Create account
              </Link>
            </>
          )}

          {!loading && role === 'admin' && (
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
                {notificationLabel()}
              </Link>

              <Link href="/support" className="muted nav-wide-only">
                Support
              </Link>

              <Link href="/account" className="muted">
                Account
              </Link>

              <button onClick={logout} className="btn btn-ghost">
                Log out
              </button>
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

              <Link href="/support" className="muted nav-wide-only">
                Support
              </Link>

              {languagePlaceholder()}

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
                Schedule
              </Link>

              <Link href="/staff/availability" className="muted">
                Availability
              </Link>

              <Link href="/notifications" className="muted nav-wide-only">
                {notificationLabel()}
              </Link>

              <Link href="/support" className="muted nav-wide-only">
                Support
              </Link>

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

        .logo {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
        }

        .logo em {
          font-style: normal;
          font-size: 0.7rem;
          line-height: 1;
          padding: 0.22rem 0.45rem;
          border-radius: 999px;
          color: var(--accent);
          background: var(--accent-dim);
          border: 1px solid rgba(255,107,53,0.24);
        }

        .nav-operator {
          border-bottom-color: rgba(255,107,53,0.24);
          background: linear-gradient(180deg, rgba(255,107,53,0.07), rgba(11,18,32,0));
        }

        .language-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 2.2rem;
          height: 2rem;
          padding: 0 0.6rem;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text-muted);
          font-size: 0.8rem;
          font-weight: 700;
        }

        @media (max-width: 860px) {
          .auth-nav-links {
            width: 100%;
            justify-content: flex-start;
            gap: 0.7rem;
          }

          .nav-wide-only {
            display: none;
          }
        }

        @media (max-width: 540px) {
          .auth-nav-links :global(a),
          .auth-nav-links button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </nav>
  )
}