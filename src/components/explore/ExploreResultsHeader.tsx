import Link from 'next/link'

type Props = {
  loading: boolean
  filteredCount: number
  hasFilters: boolean
  onClearFilters: () => void
}

export default function ExploreResultsHeader({ loading, filteredCount, hasFilters, onClearFilters }: Props) {
  return (
    <div className="explore-results-header">
      <div>
        <p className="small muted">Mirëbook marketplace</p>
        <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.15rem' }}>
          {loading
            ? 'Loading businesses...'
            : `${filteredCount} bookable business${filteredCount === 1 ? '' : 'es'}`}
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
        Customer support
      </Link>
    </div>
  )
}