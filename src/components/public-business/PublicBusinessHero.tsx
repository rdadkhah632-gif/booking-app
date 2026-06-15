import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'
import { Business } from './publicBusinessTypes'

type Props = {
  business: Business
  heroBackgroundImage: () => string | undefined
  locationLabel: () => string
  bookingModeText: () => string
  bookingModeDescription: () => string
}

export default function PublicBusinessHero({
  business,
  heroBackgroundImage,
  locationLabel,
  bookingModeText,
  bookingModeDescription
}: Props) {
  const { t } = useI18n()
  return (
    <div className="card public-business-hero">
      <div
        className="public-business-hero-image"
        style={{
          backgroundImage: heroBackgroundImage(),
          backgroundColor: 'var(--accent-dim)'
        }}
      />

      <div className="public-business-hero-content">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
          {business.category && (
            <span className="small public-business-pill-accent">
              {business.category}
            </span>
          )}

        </div>

        <h1 className="page-title">{business.name}</h1>

        <p className="page-sub" style={{ marginTop: '0.75rem' }}>
          {business.description || t('publicBusiness.hero.fallbackDescription')}
        </p>

        <div className="public-business-meta-grid">
          <p className="small muted">
            {t('publicBusiness.hero.location')}: {locationLabel()}
          </p>

          {business.phone && (
            <p className="small muted">
              {t('publicBusiness.hero.phone')}: {business.phone}
            </p>
          )}

          <p className="small muted">
            {bookingModeText()} · {bookingModeDescription()}
          </p>
        </div>

        <div className="booking-action-row compact">
          <Link href="/explore" className="btn btn-ghost">
            {t('publicBusiness.hero.backToMarketplace')}
          </Link>

          <Link href="/support/customer" className="btn btn-ghost">
            {t('nav.customerSupport')}
          </Link>
        </div>
      </div>
    </div>
  )
}
