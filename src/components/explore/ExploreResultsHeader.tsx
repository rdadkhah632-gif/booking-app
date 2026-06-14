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
            ? t('explore.results.loading')
            : `${filteredCount} ${t('explore.results.title').toLowerCase()}`}
        </h2>
      </div>

      {hasFilters && (
        <button onClick={onClearFilters} className="btn btn-ghost">
          {t('explore.results.clearCurrent')}
        </button>
      )}

    </div>
  )
}
