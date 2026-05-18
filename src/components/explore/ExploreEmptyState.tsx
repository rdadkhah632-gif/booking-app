import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'

type Props = {
  type: 'error' | 'no-businesses' | 'no-results'
  error?: string | null
  onRetry?: () => void
  onClearFilters?: () => void
}

export default function ExploreEmptyState({ type, error, onRetry, onClearFilters }: Props) {
  const { t } = useI18n()

  if (type === 'error') {
    return (
      <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'rgba(255,77,109,0.35)' }}>
        <h3 style={{ color: 'var(--danger)' }}>Could not load marketplace results</h3>
        <p className="muted small" style={{ marginTop: '0.5rem' }}>
          Refresh the marketplace or contact customer support if this keeps happening.
        </p>
        {error && (
          <pre style={{
            whiteSpace: 'pre-wrap',
            marginTop: '0.75rem',
            color: 'var(--danger)'
          }}>
            {error}
          </pre>
        )}
        <div className="explore-empty-actions">
          {onRetry && (
            <button type="button" onClick={onRetry} className="btn btn-accent">
              Retry marketplace
            </button>
          )}

          <Link href="/support/customer" className="btn btn-ghost">
            {t('nav.customerSupport')}
          </Link>
        </div>
      </div>
    )
  }

  if (type === 'no-businesses') {
    return (
      <div className="card">
        <h3>{t('explore.empty.title')}</h3>
        <p className="muted" style={{ marginTop: '0.5rem' }}>
          {t('explore.empty.body')}
        </p>
        <div className="explore-empty-actions">
          <Link href="/register" className="btn btn-accent">
            Add the first business
          </Link>

          <Link href="/support/customer" className="btn btn-ghost">
            {t('nav.customerSupport')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h3>No businesses match your filters</h3>
      <p className="muted" style={{ marginTop: '0.5rem' }}>
        Try changing your search, category or city filter, or clear filters to view all currently bookable businesses.
      </p>
      <div className="explore-empty-actions">
        {onClearFilters && (
          <button onClick={onClearFilters} className="btn btn-accent">
            Clear filters
          </button>
        )}

        <Link href="/register" className="btn btn-ghost">
          List your business
        </Link>
      </div>
    </div>
  )
}