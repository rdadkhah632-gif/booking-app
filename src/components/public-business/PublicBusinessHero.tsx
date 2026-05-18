import Link from 'next/link'
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

          <span className="small public-business-pill-muted">
            Availability-based slots
          </span>

          <span className="small public-business-pill-muted">
            No customer checkout yet
          </span>
        </div>

        <h1 className="page-title">{business.name}</h1>

        <p className="page-sub" style={{ marginTop: '0.75rem' }}>
          {business.description || 'Book available appointments through Mirëbook. Customers can request or confirm appointments without a Mirëbook checkout step.'}
        </p>

        <div className="public-business-meta-grid">
          <p className="small muted">
            Location: {locationLabel()}
          </p>

          {business.phone && (
            <p className="small muted">
              Phone: {business.phone}
            </p>
          )}

          <p className="small muted">
            Booking mode: {bookingModeText()} · {bookingModeDescription()}
          </p>
        </div>

        <div className="booking-action-row compact">
          <Link href="/explore" className="btn btn-ghost">
            Back to marketplace
          </Link>

          <Link href="/support/customer" className="btn btn-ghost">
            Customer support
          </Link>
        </div>
      </div>
    </div>
  )
}