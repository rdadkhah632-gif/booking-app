import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import PublicNav from './PublicNav'
import CustomerNav from './CustomerNav'
import BusinessNav from './BusinessNav'
import StaffNav from './StaffNav'
import AdminNav from './AdminNav'
import { Role } from './navTypes'

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

  const logoHref = useMemo(() => {
    if (role === 'admin') return '/admin'
    if (role === 'business') return '/dashboard'
    if (role === 'staff') return '/staff'
    if (role === 'customer') return '/explore'
    return '/'
  }, [role])

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

          {!loading && !role && <PublicNav />}

          {!loading && role === 'admin' && (
            <AdminNav
              notificationCount={notificationCount}
              primaryBusinessId={primaryBusinessId}
              onLogout={logout}
            />
          )}

          {!loading && role === 'customer' && (
            <CustomerNav
              notificationCount={notificationCount}
              primaryBusinessId={primaryBusinessId}
              onLogout={logout}
            />
          )}

          {!loading && role === 'business' && (
            <BusinessNav
              notificationCount={notificationCount}
              primaryBusinessId={primaryBusinessId}
              onLogout={logout}
            />
          )}

          {!loading && role === 'staff' && (
            <StaffNav
              notificationCount={notificationCount}
              primaryBusinessId={primaryBusinessId}
              onLogout={logout}
            />
          )}
        </div>
      </div>

      <style jsx>{`
        .auth-nav-links {
          display: flex;
          gap: 1rem;
          align-items: center;
          flex-wrap: nowrap;
          justify-content: flex-end;
          min-width: 0;
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

        :global(.language-pill) {
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
            gap: 0.55rem;
            overflow-x: auto;
            overflow-y: hidden;
            padding-bottom: 0.25rem;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }

          .auth-nav-links::-webkit-scrollbar {
            display: none;
          }

          :global(.nav-wide-only) {
            display: none;
          }
        }

        @media (max-width: 540px) {
          .auth-nav-links :global(a),
          .auth-nav-links button {
            width: auto;
            max-width: none;
            justify-content: center;
            white-space: nowrap;
          }

          :global(.language-toggle),
          :global(.account-mode-pill) {
            width: auto;
            flex: 0 0 auto;
          }
        }
      `}</style>
    </nav>
  )
}