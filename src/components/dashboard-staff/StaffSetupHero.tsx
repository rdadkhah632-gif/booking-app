import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'
import { Business } from './dashboardStaffTypes'

type Props = {
  business: Business
}

export default function StaffSetupHero({ business }: Props) {
  const { t } = useI18n()

  return (
    <div
      className="card"
      style={{
        marginBottom: '1.5rem',
        background: 'linear-gradient(135deg, rgba(255,107,53,0.12), rgba(45,212,191,0.07))',
        borderColor: 'rgba(255,107,53,0.22)'
      }}
    >
      <div className="staff-hero-row">
        <div style={{ flex: 1, minWidth: 260 }}>
          <p className="small" style={{ color: 'var(--accent)' }}>
            {t('dashboardStaff.hero.kicker', 'Staff setup')}
          </p>

          <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
            {t('dashboardStaff.hero.title', 'Make services bookable by assigning staff.')}
          </h2>

          <p className="muted" style={{ marginTop: '0.55rem' }}>
            {t(
              'dashboardStaff.hero.body',
              'Staff profiles control who can deliver services and when customers can book them. Add staff, connect their email if they need their own login, assign services and set availability.'
            )}
          </p>
        </div>

        <div className="staff-hero-actions">
          <Link href="/dashboard/businesses" className="btn btn-ghost">
            {t('dashboardSettings.backToSetup', 'Back to setup hub')}
          </Link>

          <Link href={`/dashboard/services?businessId=${business.id}`} className="btn btn-ghost">
            {t('support.business.services', 'Services')}
          </Link>

          <Link href={`/dashboard/availability?businessId=${business.id}`} className="btn btn-ghost">
            {t('dashboardBusinesses.workingHours', 'Working hours')}
          </Link>

          <Link href={`/explore/${business.id}`} className="btn btn-ghost">
            {t('dashboardServices.hero.previewPublic', 'Preview public page')}
          </Link>

          <Link href="/support/business" className="btn btn-ghost">
            {t('nav.businessSupport', 'Business support')}
          </Link>
        </div>
      </div>

      <style jsx>{`
        .staff-hero-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          align-items: flex-start;
        }

        .staff-hero-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        @media (max-width: 640px) {
          .staff-hero-actions,
          .staff-hero-actions :global(.btn),
          .staff-hero-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}