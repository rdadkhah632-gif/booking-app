import { SortOption } from './exploreTypes'

type Props = {
  search: string
  city: string
  category: string
  sortBy: SortOption
  cities: string[]
  categories: string[]
  loading: boolean
  onSearchChange: (value: string) => void
  onCityChange: (value: string) => void
  onCategoryChange: (value: string) => void
  onSortChange: (value: SortOption) => void
  onApplyFilters: () => void
  onClearFilters: () => void
  onRefresh: () => void
}

export default function ExploreFilters({
  search,
  city,
  category,
  sortBy,
  cities,
  categories,
  loading,
  onSearchChange,
  onCityChange,
  onCategoryChange,
  onSortChange,
  onApplyFilters,
  onClearFilters,
  onRefresh
}: Props) {
  return (
    <aside className="card explore-filter-panel">
      <h3 style={{ marginBottom: '0.35rem' }}>
        Find a service
      </h3>
      <p className="small muted" style={{ marginBottom: '1rem' }}>
        Search businesses that are currently bookable on Mirëbook. Only published businesses with active services, active staff and working hours appear here.
      </p>

      <div style={{ display: 'grid', gap: '1rem' }}>
        <div>
          <label className="small muted">Search</label>
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Business, service, city..."
            style={{ width: '100%', marginTop: '0.4rem' }}
          />
        </div>

        <div>
          <label className="small muted">Category</label>
          <input
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            placeholder="Barber, nails, salon..."
            list="category-options"
            style={{ width: '100%', marginTop: '0.4rem' }}
          />

          <datalist id="category-options">
            {categories.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="small muted">City</label>
          <input
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            placeholder="Tirana, Coventry, Milan..."
            list="city-options"
            style={{ width: '100%', marginTop: '0.4rem' }}
          />

          <datalist id="city-options">
            {cities.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="small muted">Sort</label>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            style={{ width: '100%', marginTop: '0.4rem' }}
          >
            <option value="newest">Newest first</option>
            <option value="name">Business name</option>
            <option value="city">City</option>
            <option value="services">Most services</option>
          </select>
        </div>

        <button className="btn btn-accent" onClick={onApplyFilters}>
          Search Mirëbook
        </button>

        <button className="btn btn-ghost" onClick={onClearFilters}>
          Clear filters
        </button>

        <button className="btn btn-ghost" onClick={onRefresh} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh results'}
        </button>
      </div>
    </aside>
  )
}