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
        <h3 style={{ color: 'var(--danger)' }}>{t('explore.empty.errorTitle')}</h3>
        <p className="muted small" style={{ marginTop: '0.5rem' }}>
          {t('explore.empty.errorBody')}
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
              {t('explore.empty.retryMarketplace')}
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
          <Link href="/support/customer" className="btn btn-accent">
            {t('nav.customerSupport')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h3>{t('explore.empty.noResultsTitle')}</h3>
      <p className="muted" style={{ marginTop: '0.5rem' }}>
        {t('explore.empty.noResultsBody')}
      </p>
      <div className="explore-empty-actions">
        {onClearFilters && (
          <button onClick={onClearFilters} className="btn btn-accent">
            {t('explore.filters.clear')}
          </button>
        )}
      </div>
    </div>
  )
}
