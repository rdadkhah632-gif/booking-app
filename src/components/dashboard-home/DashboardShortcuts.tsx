import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'

export default function DashboardShortcuts() {
  const { t } = useI18n()

  const shortcuts = [
    {
      href: '/dashboard/bookings',
      title: t('dashboardHome.shortcuts.bookings.title', 'Bookings'),
      body: t('dashboardHome.shortcuts.bookings.body', 'Review customer appointments, pending approvals and completed bookings.')
    },
    {
      href: '/dashboard/businesses',
      title: t('dashboardHome.shortcuts.setup.title', 'Setup hub'),
      body: t('dashboardHome.shortcuts.setup.body', 'Manage business profiles, publish status, photos and core setup.')
    },
    {
      href: '/dashboard/services',
      title: t('dashboardHome.shortcuts.services.title', 'Services'),
      body: t('dashboardHome.shortcuts.services.body', 'Edit service names, durations, prices, images and active status.')
    },
    {
      href: '/dashboard/staff',
      title: t('dashboardHome.shortcuts.staff.title', 'Staff'),
      body: t('dashboardHome.shortcuts.staff.body', 'Manage staff profiles, assignments, schedules and availability.')
    },
    {
      href: '/dashboard/settings',
      title: t('dashboardHome.shortcuts.settings.title', 'Business settings'),
      body: t('dashboardHome.shortcuts.settings.body', 'Control booking approval, notice rules, buffers, policies and region settings.')
    },
    {
      href: '/dashboard/billing',
      title: t('dashboardHome.shortcuts.billing.title', 'Billing'),
      body: t('dashboardHome.shortcuts.billing.body', 'Review trial, subscription and billing setup for Mirëbook.')
    }
  ]

  return (
    <div className="card">
      <p className="small muted">{t('dashboardHome.shortcuts.kicker', 'Business tools')}</p>

      <h3 style={{ marginTop: '0.25rem' }}>
        {t('dashboardHome.shortcuts.title', 'Manage your business')}
      </h3>

      <div className="dashboard-shortcut-grid">
        {shortcuts.map((shortcut) => (
          <Link key={shortcut.href} href={shortcut.href} className="dashboard-shortcut-card">
            <strong>{shortcut.title}</strong>
            <p className="small muted">{shortcut.body}</p>
          </Link>
        ))}
      </div>

      <style jsx>{`
        .dashboard-shortcut-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .dashboard-shortcut-card {
          display: grid;
          gap: 0.35rem;
          padding: 0.9rem;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text);
          text-decoration: none;
        }

        .dashboard-shortcut-card:hover {
          border-color: rgba(255,107,53,0.35);
        }
      `}</style>
    </div>
  )
}