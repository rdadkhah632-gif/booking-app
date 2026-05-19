import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'
import { Business } from './dashboardAvailabilityTypes'

type Props = {
  businesses: Business[]
}

export default function AvailabilityBusinessPicker({ businesses }: Props) {
  const { t } = useI18n()

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(255,107,53,0.12), rgba(45,212,191,0.08))' }}>
        <p className="small muted">{t('dashboardAvailability.businessPicker.kicker', 'Multiple businesses found')}</p>

        <h3 style={{ marginTop: '0.25rem' }}>
          {t('dashboardAvailability.businessPicker.title', 'Choose a business to manage hours')}
        </h3>

        <p className="muted" style={{ marginTop: '0.35rem' }}>
          {t(
            'dashboardAvailability.businessPicker.body',
            'Select one business to configure its business-wide fallback hours. Staff-specific availability can still override these hours.'
          )}
        </p>
      </div>

      {businesses.map((business) => (
        <Link
          key={business.id}
          href={`/dashboard/availability?businessId=${business.id}`}
          className="card availability-business-picker-card"
        >
          <div>
            <strong>{business.name}</strong>

            <p className="small muted" style={{ marginTop: '0.25rem' }}>
              {business.published
                ? t('support.business.status.published', 'Published')
                : t('support.business.status.draft', 'Hidden / draft')}
            </p>

            <p className="small muted" style={{ marginTop: '0.35rem' }}>
              {t('dashboardAvailability.businessPicker.manageBody', 'Manage working hours for this business.')}
            </p>
          </div>

          <span className="btn btn-accent">
            {t('dashboardAvailability.businessPicker.manageCta', 'Manage hours')}
          </span>
        </Link>
      ))}

      <style jsx>{`
        .availability-business-picker-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          color: var(--text);
          text-decoration: none;
        }

        @media (max-width: 640px) {
          .availability-business-picker-card {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>
    </div>
  )
}