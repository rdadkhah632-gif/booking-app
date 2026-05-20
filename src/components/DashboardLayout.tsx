import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import { useI18n } from '@/lib/useI18n'

type Props = {
  children: React.ReactNode
  title?: string
  subtitle?: string
}

export default function DashboardLayout({ children, title, subtitle }: Props) {
  const router = useRouter()
  const { t } = useI18n()
  const [pendingCount, setPendingCount] = useState(0)
  const [primaryBusinessId, setPrimaryBusinessId] = useState<string | null>(null)

  useEffect(() => {
    async function loadPendingNotifications() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) return

      const { data: businesses } = await supabase
        .from('businesses')
        .select('id')
        .eq('user_id', session.user.id)

      const businessIds = (businesses || []).map((business) => business.id)
      setPrimaryBusinessId(businessIds[0] || null)

      if (businessIds.length === 0) {
        setPendingCount(0)
        setPrimaryBusinessId(null)
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

  const mainLinks = [
    { href: '/dashboard', label: t('dashboardLayout.nav.home', 'Home') },
    { href: '/dashboard/bookings', label: t('support.business.bookings', 'Bookings') },
    { href: '/dashboard/businesses', label: t('dashboardLayout.nav.setup', 'Setup') },
    { href: '/dashboard/settings', label: t('dashboardSettings.pageTitle', 'Settings') }
  ]

  const publicBusinessHref = useMemo(() => {
    return primaryBusinessId ? `/explore/${primaryBusinessId}` : '/dashboard/businesses'
  }, [primaryBusinessId])

  function isActiveLink(href: string) {
    return router.pathname === href || router.pathname.startsWith(`${href}/`)
  }

  return (
    <main className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Link href="/dashboard" className="logo">
            Mirë<span>book</span>
          </Link>
          <p className="small muted" style={{ marginTop: '0.35rem' }}>
            {t('dashboardLayout.controlCentre', 'Business control centre')}
          </p>
        </div>

        <nav className="sidebar-nav">
          {mainLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`sidebar-link ${isActiveLink(link.href) ? 'active' : ''}`}
            >
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>
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
            {pendingCount > 0 && (
              <p className="small muted" style={{ marginTop: '0.45rem' }}>
                {`${pendingCount} ${t('dashboardLayout.pendingItems', 'Mirëbook item')}${pendingCount === 1 ? '' : 's'} ${t('dashboardLayout.needAttention', 'need your attention.')}`}
              </p>
            )}
          </div>

          {pendingCount > 0 && (
            <div className="dashboard-header-actions">
              <Link
                href="/dashboard/notifications"
                className="btn btn-accent"
                style={{
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <span aria-hidden="true">🔔</span>
                <span>{t('account.needsAction', 'Needs action')}</span>
                <span
                  style={{
                    minWidth: 22,
                    height: 22,
                    borderRadius: 999,
                    background: 'var(--bg)',
                    color: 'var(--accent)',
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
              </Link>
            </div>
          )}
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

        }
      `}</style>
    </main>
  )
}