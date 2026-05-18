import Link from 'next/link'
import { Business, BusinessCardStats } from './exploreTypes'

type Props = {
  business: Business
  stats: BusinessCardStats
  businessIcon: (business: Business) => string
  bookingModeLabel: (business: Business) => string
  locationLabel: (business: Business) => string
  imageBackground: (business: Business) => string
}

export default function ExploreBusinessCard({
  business,
  stats,
  businessIcon,
  bookingModeLabel,
  locationLabel,
  imageBackground
}: Props) {
  const serviceText = `${stats.activeServices} service${stats.activeServices === 1 ? '' : 's'}`
  const staffText = `${stats.activeStaff} staff`

  return (
    <div className="card explore-business-card">
      <div
        className="explore-business-image"
        style={{
          minHeight: 150,
          background: imageBackground(business),
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem'
        }}
      >
        {!business.image_url && businessIcon(business)}
      </div>

      <div className="explore-business-content">
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <h3 style={{ marginBottom: '0.25rem' }}>
            {business.name}
          </h3>

          {business.category && (
            <span
              className="small"
              style={{
                background: 'var(--accent-dim)',
                color: 'var(--accent)',
                padding: '0.2rem 0.55rem',
                borderRadius: 999
              }}
            >
              {business.category}
            </span>
          )}

          <span
            className="small"
            style={{
              background: business.auto_accept_bookings === false ? 'rgba(255,107,53,0.12)' : 'rgba(45,212,191,0.12)',
              color: business.auto_accept_bookings === false ? 'var(--accent)' : 'var(--success)',
              padding: '0.2rem 0.55rem',
              borderRadius: 999
            }}
          >
            {business.auto_accept_bookings === false ? 'Approval required' : 'Instant confirmation'}
          </span>
        </div>

        <p className="muted small" style={{ marginBottom: '0.65rem', marginTop: '0.35rem', maxWidth: 680 }}>
          {business.description || 'Book available services through Mirëbook. Customers can request or confirm appointments without a Mirëbook checkout step.'}
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
          <span
            className="small"
            style={{
              background: 'rgba(45,212,191,0.12)',
              color: 'var(--success)',
              padding: '0.2rem 0.55rem',
              borderRadius: 999
            }}
          >
            Bookable on Mirëbook
          </span>

          <span className="small explore-muted-pill">Appointment booking</span>
          <span className="small explore-muted-pill">{serviceText}</span>
          <span className="small explore-muted-pill">{staffText}</span>
          <span className="small explore-muted-pill">
            {stats.openDays} open day{stats.openDays === 1 ? '' : 's'}
          </span>
        </div>

        <p className="small muted">
          {locationLabel(business)}
        </p>
      </div>

      <div className="explore-business-actions">
        <Link href={`/explore/${business.id}`} className="btn btn-accent">
          View times and book
        </Link>

        <Link href={`/book/${business.id}`} className="btn btn-ghost">
          Book now
        </Link>

        {business.phone && (
          <span className="small muted">
            {business.phone}
          </span>
        )}

        <span className="small muted">
          {bookingModeLabel(business)}
        </span>
      </div>
    </div>
  )
}