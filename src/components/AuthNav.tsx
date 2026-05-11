import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'

type Role = 'customer' | 'business' | null

export default function AuthNav() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<Role>(null)
  const [notificationCount, setNotificationCount] = useState(0)

  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setRole(null)
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
    setNotificationCount(0)
    router.replace('/')
  }

  const logoHref =
    role === 'business'
      ? '/dashboard'
      : role === 'customer'
        ? '/explore'
        : '/'

  function notificationLabel() {
    if (notificationCount <= 0) return 'Notifications'
    return `Notifications (${notificationCount})`
  }

  return (
    <nav className="nav-simple">
      <div className="nav-simple-inner">
        <Link href={logoHref} className="logo">
          Slot<span>ly</span>
        </Link>

        <div style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          {loading && (
            <span className="muted small">Checking account...</span>
          )}

          {!loading && !role && (
            <>
              <Link href="/explore" className="muted">
                Explore
              </Link>

              <Link href="/login" className="muted">
                Login
              </Link>

              <Link href="/register" className="btn btn-accent">
                Join
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
                Marketplace
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
    </nav>
  )
}