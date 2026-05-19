import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'
import { Business } from './dashboardServicesTypes'

type Props = {
  businesses: Business[]
}

export default function ServicesBusinessPicker({ businesses }: Props) {
  const { t } = useI18n()

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(255,107,53,0.12), rgba(45,212,191,0.08))' }}>
        <p className="small muted">{t('dashboardServices.businessPicker.kicker', 'Multiple businesses found')}</p>

        <h3 style={{ marginTop: '0.25rem' }}>
          {t('dashboardServices.businessPicker.title', 'Choose a business to continue')}
        </h3>

        <p className="muted" style={{ marginTop: '0.35rem' }}>
          {t(
            'dashboardServices.businessPicker.body',
            'Pick the business you want to configure. Mirëbook services are managed per business because prices, staff and availability can differ.'
          )}
        </p>
      </div>

      {businesses.map((business) => (
        <Link
          key={business.id}
          href={`/dashboard/services?businessId=${business.id}`}
          className="card services-business-picker-card"
        >
          <div>
            <strong>{business.name}</strong>

            <p className="small muted" style={{ marginTop: '0.25rem' }}>
              {business.published
                ? t('support.business.status.published', 'Published')
                : t('support.business.status.draft', 'Hidden / draft')}
            </p>

            <p className="small muted" style={{ marginTop: '0.35rem' }}>
              {t('dashboardServices.businessPicker.manageBody', 'Manage services for this business.')}
            </p>
          </div>

          <span className="btn btn-accent">
            {t('dashboardServices.businessPicker.manageCta', 'Manage services')}
          </span>
        </Link>
      ))}

      <style jsx>{`
        .services-business-picker-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          color: var(--text);
          text-decoration: none;
        }

        @media (max-width: 640px) {
          .services-business-picker-card {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>
    </div>
  )
}