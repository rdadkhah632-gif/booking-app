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
    { href: '/dashboard/bookings', label: t('dashboardLayout.nav.calendar', 'Calendar') },
    {
      href: '/dashboard/notifications',
      label: pendingCount > 0
        ? `${t('account.needsAction', 'Needs action')} (${pendingCount})`
        : t('account.needsAction', 'Needs action'),
      highlight: pendingCount > 0
    }
  ]

  const setupLinks = [
    { href: '/dashboard/businesses', label: t('dashboardLayout.nav.businessProfile', 'Business profile') },
    { href: '/dashboard/services', label: t('support.business.services', 'Services') },
    { href: '/dashboard/staff', label: t('support.business.staff', 'Staff') },
    { href: '/dashboard/settings', label: t('dashboardSettings.pageTitle', 'Settings') }
  ]

  const accountLinks = [
    { href: '/account', label: t('dashboardLayout.nav.accountSettings', 'Account') }
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
          <p className="sidebar-section-label">
            {t('dashboardLayout.sections.business', 'Business')}
          </p>

          {mainLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`sidebar-link ${isActiveLink(link.href) ? 'active' : ''} ${link.highlight ? 'active' : ''}`}
            >
              <span>{link.label}</span>
            </Link>
          ))}

          <p className="sidebar-section-label">
            {t('dashboardLayout.sections.setup', 'Setup')}
          </p>

          {setupLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`sidebar-link ${isActiveLink(link.href) ? 'active' : ''}`}
            >
              <span>{link.label}</span>
            </Link>
          ))}

          <p className="sidebar-section-label">
            {t('dashboardLayout.sections.account', 'Account')}
          </p>

          {accountLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`sidebar-link ${isActiveLink(link.href) ? 'active' : ''}`}
            >
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', padding: '1rem 0.5rem' }}>
          <button
            onClick={logout}
            className="sidebar-link"
            style={{
              width: '100%',
              textAlign: 'left',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)'
            }}
          >
            {t('auth.logout', 'Log out')}
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
                ? `${pendingCount} ${t('dashboardLayout.pendingItems', 'Mirëbook item')}${pendingCount === 1 ? '' : 's'} ${t('dashboardLayout.needAttention', 'need your attention.')}`
                : t('dashboardLayout.noActionsBody', 'No customer actions need review right now. Use Preview business page to check how customers see your business.')}
            </p>
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
        .sidebar-section-label {
          font-size: 0.74rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-muted);
          padding: 0.75rem 0.5rem 0.35rem;
        }
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