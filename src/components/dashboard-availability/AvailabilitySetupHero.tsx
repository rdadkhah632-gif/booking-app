import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'
import { Business } from './dashboardAvailabilityTypes'

type Props = {
  business: Business
}

export default function AvailabilitySetupHero({ business }: Props) {
  const { t } = useI18n()

  return (
    <div className="card" style={{ marginBottom: '1.25rem' }}>
      <div className="availability-hero-row">
        <div style={{ flex: 1, minWidth: 260 }}>
          <p className="small muted">
            {t('dashboardAvailability.hero.kicker', 'Mirëbook business-wide availability')}
          </p>

          <h3 style={{ marginTop: '0.25rem' }}>{business.name}</h3>

          <p className="small muted" style={{ marginTop: '0.35rem' }}>
            {t(
              'dashboardAvailability.hero.body',
              'These are your general business opening hours. Staff-specific hours override these where set, and Mirëbook uses both to decide which dates and times customers can actually book.'
            )}
          </p>
        </div>

        <div className="availability-hero-actions">
          <Link href="/dashboard/businesses" className="btn btn-ghost">
            {t('dashboardSettings.setupHub', 'Setup hub')}
          </Link>

          <Link href={`/dashboard/staff?businessId=${business.id}`} className="btn btn-ghost">
            {t('dashboardStaff.pageTitle', 'Staff setup')}
          </Link>

          <Link href={`/dashboard/services?businessId=${business.id}`} className="btn btn-ghost">
            {t('support.business.services', 'Services')}
          </Link>
        </div>
      </div>

      <style jsx>{`
        .availability-hero-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .availability-hero-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        @media (max-width: 640px) {
          .availability-hero-actions,
          .availability-hero-actions :global(.btn),
          .availability-hero-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}