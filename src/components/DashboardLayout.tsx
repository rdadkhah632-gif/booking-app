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

      const uniquePendingBookings = new Set(
        (pendingRequests || []).map((request) => request.booking_id)
      )

      setPendingCount((pendingBookingsCount || 0) + uniquePendingBookings.size)
    }

    loadPendingNotifications()
  }, [router.pathname])

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  const links = [
    { href: '/dashboard', label: 'Overview' },
    { href: '/dashboard/bookings', label: 'Bookings' },
    { href: '/dashboard/notifications', label: pendingCount > 0 ? `Needs action (${pendingCount})` : 'Needs action', highlight: pendingCount > 0 },
    { href: '/dashboard/analytics', label: 'Analytics' },
    { href: '/dashboard/businesses', label: 'Setup hub' },
    { href: '/dashboard/settings', label: 'Business settings' },
    { href: '/dashboard/billing', label: 'Billing' },
    { href: '/account', label: 'Account' }
  ]

  return (
    <main className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Link href="/dashboard" className="logo">
            Mirë<span>book</span>
          </Link>
          <p className="small muted" style={{ marginTop: '0.35rem' }}>
            Business control centre
          </p>
        </div>

        <nav className="sidebar-nav">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`sidebar-link ${router.pathname === link.href || router.pathname.startsWith(`${link.href}/`) ? 'active' : ''} ${link.highlight ? 'active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}
            >
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', padding: '1rem 0.5rem' }}>
          <p className="small muted" style={{ marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>
            Public side
          </p>

          <Link href="/explore" className="sidebar-link">
            Marketplace
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
        <div className="dashboard-page-header">
          <div>
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
            <p className="small muted" style={{ marginTop: '0.45rem' }}>
              {pendingCount > 0
                ? `${pendingCount} Mirëbook item${pendingCount === 1 ? '' : 's'} need your attention.`
                : 'No customer actions need review right now.'}
            </p>
          </div>

          <div className="dashboard-header-actions">
            <Link href="/dashboard/businesses" className="btn btn-ghost dashboard-header-secondary">
              Setup hub
            </Link>

            <Link href="/dashboard/settings" className="btn btn-ghost dashboard-header-secondary">
              Settings
            </Link>

            <Link
              href="/dashboard/notifications"
              className={pendingCount > 0 ? 'btn btn-accent' : 'btn btn-ghost'}
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <span aria-hidden="true">🔔</span>
              <span>{pendingCount > 0 ? 'Needs action' : 'No actions'}</span>

              {pendingCount > 0 && (
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
                    fontWeight: 700,
                    marginLeft: '0.15rem'
                  }}
                >
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {children}
      </section>
      <style jsx>{`
        .dashboard-page-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }

        .dashboard-header-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          align-items: center;
          justify-content: flex-end;
        }

        .dashboard-header-secondary {
          flex-shrink: 0;
        }

        @media (max-width: 720px) {
          .dashboard-page-header {
            display: grid;
          }

          .dashboard-header-actions {
            width: 100%;
            justify-content: stretch;
          }

          .dashboard-header-actions :global(.btn) {
            width: 100%;
            justify-content: center;
          }

          .dashboard-header-secondary {
            display: none;
          }
        }
      `}</style>
    </main>
  )
}