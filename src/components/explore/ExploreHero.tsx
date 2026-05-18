import { MarketplaceStats } from './exploreTypes'

type Props = {
  marketplaceStats: MarketplaceStats
}

export default function ExploreHero({ marketplaceStats }: Props) {
  return (
    <div
      className="card"
      style={{
        marginBottom: '1.5rem',
        overflow: 'hidden',
        padding: 0
      }}
    >
      <div
        style={{
          padding: '2rem',
          background: 'linear-gradient(135deg, rgba(255,107,53,0.16), rgba(45,212,191,0.10))'
        }}
      >
        <p className="small" style={{ color: 'var(--accent)', marginBottom: '0.5rem' }}>
          Mirëbook marketplace
        </p>

        <h1 className="page-title">
          Find real appointments near you.
        </h1>

        <p className="page-sub" style={{ marginTop: '0.75rem', maxWidth: 760 }}>
          Browse bookable Mirëbook businesses with active services, staff and working hours. Choose a service, pick an available time, and send a booking request or instant confirmation depending on the business settings.
        </p>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '1.25rem' }}>
          <span
            className="small"
            style={{
              background: 'rgba(45,212,191,0.12)',
              color: 'var(--success)',
              padding: '0.25rem 0.65rem',
              borderRadius: 999
            }}
          >
            {marketplaceStats.businesses} bookable business{marketplaceStats.businesses === 1 ? '' : 'es'}
          </span>

          <span
            className="small"
            style={{
              background: 'var(--surface-2)',
              color: 'var(--text-muted)',
              padding: '0.25rem 0.65rem',
              borderRadius: 999,
              border: '1px solid var(--border)'
            }}
          >
            {marketplaceStats.cities} cit{marketplaceStats.cities === 1 ? 'y' : 'ies'}
          </span>

          <span
            className="small"
            style={{
              background: 'var(--surface-2)',
              color: 'var(--text-muted)',
              padding: '0.25rem 0.65rem',
              borderRadius: 999,
              border: '1px solid var(--border)'
            }}
          >
            Availability-based booking
          </span>

          <span
            className="small"
            style={{
              background: 'var(--surface-2)',
              color: 'var(--text-muted)',
              padding: '0.25rem 0.65rem',
              borderRadius: 999,
              border: '1px solid var(--border)'
            }}
          >
            No customer checkout yet
          </span>
        </div>
      </div>
    </div>
  )
}