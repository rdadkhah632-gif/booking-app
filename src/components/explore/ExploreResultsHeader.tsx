import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'

type Props = {
  loading: boolean
  filteredCount: number
  hasFilters: boolean
  onClearFilters: () => void
}

export default function ExploreResultsHeader({ loading, filteredCount, hasFilters, onClearFilters }: Props) {
  const { t } = useI18n()
  return (
    <div className="explore-results-header">
      <div>
        <p className="small muted">{t('explore.hero.kicker')}</p>
        <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.15rem' }}>
          {loading
            ? 'Loading businesses...'
            : `${filteredCount} ${t('explore.results.title').toLowerCase()}`}
        </h2>
      </div>

      {hasFilters && (
        <button onClick={onClearFilters} className="btn btn-ghost">
          Clear current filters
        </button>
      )}

      <Link href="/register" className="btn btn-ghost">
        List your business
      </Link>

      <Link href="/support/customer" className="btn btn-ghost">
        {t('nav.customerSupport')}
      </Link>
    </div>
  )
}