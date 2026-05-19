import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'
import { Business } from './dashboardServicesTypes'

type Props = {
  business: Business
}

export default function ServicesSetupHero({ business }: Props) {
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
      <div className="services-hero-row">
        <div style={{ flex: 1, minWidth: 260 }}>
          <p className="small" style={{ color: 'var(--accent)' }}>
            {t('dashboardServices.hero.kicker', 'Setup sub-page')}
          </p>

          <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
            {t('dashboardServices.hero.title', 'Services customers can book on Mirëbook.')}
          </h2>

          <p className="muted" style={{ marginTop: '0.55rem' }}>
            {t(
              'dashboardServices.hero.body',
              'Add services with prices, durations, descriptions and optional images. Mirëbook only treats a service as properly bookable when it is visible and active staff are assigned to it.'
            )}
          </p>
        </div>

        <div className="services-hero-actions">
          <Link href="/dashboard/businesses" className="btn btn-ghost">
            {t('dashboardSettings.backToSetup', 'Back to setup hub')}
          </Link>

          <Link href={`/dashboard/staff?businessId=${business.id}`} className="btn btn-ghost">
            {t('dashboardServices.hero.assignStaff', 'Assign staff')}
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
        .services-hero-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          align-items: flex-start;
        }

        .services-hero-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        @media (max-width: 640px) {
          .services-hero-actions,
          .services-hero-actions :global(.btn),
          .services-hero-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}