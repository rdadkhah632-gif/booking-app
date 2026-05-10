import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'

type Props = {
  children: React.ReactNode
  title?: string
  subtitle?: string
}

export default function DashboardLayout({ children, title, subtitle }: Props) {
  const router = useRouter()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    async function loadPendingNotifications() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) return

      const { data: businesses } = await supabase
        .from('businesses')
        .select('id')
        .eq('user_id', session.user.id)

      const businessIds = (businesses || []).map((business) => business.id)

      if (businessIds.length === 0) {
        setPendingCount(0)
        return
      }

      const { data: pendingRequests } = await supabase
        .from('booking_requests')
        .select('booking_id')
        .in('business_id', businessIds)
        .eq('status', 'pending')

      const uniquePendingBookings = new Set(
        (pendingRequests || []).map((request) => request.booking_id)
      )

      setPendingCount(uniquePendingBookings.size)
    }

    loadPendingNotifications()
  }, [router.pathname])

  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const links = [
    { href: '/dashboard', label: 'Overview' },
    { href: '/dashboard/businesses', label: 'Business profile' },
    { href: '/dashboard/services', label: 'Services' },
    { href: '/dashboard/staff', label: 'Staff' },
    { href: '/dashboard/availability', label: 'Working hours' },
    { href: '/dashboard/bookings', label: 'Bookings' },
    { href: '/dashboard/notifications', label: 'Notifications' },
    { href: '/account', label: 'Account settings' }
  ]

  return (
    <main className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Link href="/dashboard" className="logo">
            Slot<span>ly</span>
          </Link>
          <p className="small muted" style={{ marginTop: '0.35rem' }}>
            Business control panel
          </p>
        </div>

        <nav className="sidebar-nav">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`sidebar-link ${router.pathname === link.href ? 'active' : ''}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.75rem'
              }}
            >
              <span>{link.label}</span>

              {link.href === '/dashboard/notifications' && pendingCount > 0 && (
                <span
                  style={{
                    minWidth: 22,
                    height: 22,
                    borderRadius: 999,
                    background: 'var(--accent)',
                    color: 'var(--bg)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}
                >
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', padding: '1rem 0.5rem' }}>
          <p className="small muted" style={{ marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>
            Preview
          </p>

          <Link href="/explore" className="sidebar-link">
            Customer marketplace
          </Link>

          <button
            onClick={logout}
            className="sidebar-link"
            style={{
              width: '100%',
              textAlign: 'left',
              border: 'none',
              marginTop: '0.5rem',
              background: 'transparent',
              color: 'var(--text-muted)'
            }}
          >
            Log out
          </button>
        </div>
      </aside>

      <section className="dashboard-main">
        {(title || subtitle) && (
          <div style={{ marginBottom: '1.5rem' }}>
            {title && (
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '2rem',
                  marginBottom: '0.25rem'
                }}
              >
                {title}
              </h1>
            )}

            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
        )}

        {children}
      </section>
    </main>
  )
}