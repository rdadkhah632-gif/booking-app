import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AuthNav from '@/components/AuthNav'
type Business = {
  id: string
  name: string
  description?: string | null
  category?: string | null
  city?: string | null
  country?: string | null
  phone?: string | null
  address?: string | null
  services?: { id: string; active: boolean }[] | null
}

export default function Explore() {
  const router = useRouter()

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!router.isReady) return

    const queryParam = typeof router.query.query === 'string' ? router.query.query : ''
    const cityParam = typeof router.query.city === 'string' ? router.query.city : ''
    const categoryParam = typeof router.query.category === 'string' ? router.query.category : ''

    setSearch(queryParam)
    setCity(cityParam)
    setCategory(categoryParam)
  }, [router.isReady, router.query.query, router.query.city, router.query.category])

  useEffect(() => {
    async function loadBusinesses() {
      setLoading(true)
      setError(null)

      try {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Supabase request timed out after 8 seconds')), 8000)
        )

        const query = supabase
          .from('businesses')
          .select(`
            id,
            name,
            description,
            category,
            city,
            country,
            phone,
            address,
            published,
            created_at,
            services (
              id,
              active
            )
          `)
          .eq('published', true)
          .order('created_at', { ascending: false })

        const { data, error } = await Promise.race([query, timeout])

        if (error) {
          setError(error.message)
          setBusinesses([])
          setLoading(false)
          return
        }

        const bookableBusinesses = (data || [])
          .map((business: any) => ({
            ...business,
            services: business.services || []
          }))
          .filter((business: Business) =>
            (business.services || []).some((service) => service.active)
          )

        setBusinesses(bookableBusinesses)
        setLoading(false)
      } catch (err: any) {
        setError(err.message || 'Something went wrong while loading businesses.')
        setBusinesses([])
        setLoading(false)
      }
    }

    loadBusinesses()
  }, [])

  const cities = useMemo(() => {
    const unique = new Set(
      businesses
        .map((b) => b.city?.trim())
        .filter(Boolean) as string[]
    )

    return Array.from(unique)
  }, [businesses])

  const categories = useMemo(() => {
    const unique = new Set(
      businesses
        .map((b) => b.category?.trim())
        .filter(Boolean) as string[]
    )

    return Array.from(unique)
  }, [businesses])

  const filteredBusinesses = useMemo(() => {
    return businesses.filter((business) => {
      const searchText = `${business.name || ''} ${business.description || ''} ${business.category || ''} ${business.city || ''} ${business.country || ''} ${business.address || ''}`.toLowerCase()

      const matchesSearch = searchText.includes(search.toLowerCase())
      const matchesCity = city
        ? (business.city || '').toLowerCase().includes(city.toLowerCase())
        : true
      const matchesCategory = category
        ? (business.category || '').toLowerCase().includes(category.toLowerCase())
        : true

      return matchesSearch && matchesCity && matchesCategory
    })
  }, [businesses, search, city, category])

  function applyFiltersToUrl() {
    router.push({
      pathname: '/explore',
      query: {
        ...(search.trim() ? { query: search.trim() } : {}),
        ...(city.trim() ? { city: city.trim() } : {}),
        ...(category.trim() ? { category: category.trim() } : {})
      }
    })
  }

  function clearFilters() {
    setSearch('')
    setCity('')
    setCategory('')
    router.push('/explore')
  }

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ padding: '32px 24px' }}>
        <div style={{ marginBottom: '28px' }}>
          <p className="small muted" style={{ marginBottom: '0.5rem' }}>
            Search local services
          </p>

          <h1 className="page-title">
            Find your next appointment.
          </h1>

          <p className="page-sub" style={{ marginTop: '0.75rem', maxWidth: 680 }}>
            Browse bookable businesses, compare local services and choose a real available slot with the staff member you want.
          </p>
        </div>

        {error && (
          <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'rgba(255,77,109,0.35)' }}>
            <h3 style={{ color: 'var(--danger)' }}>Could not load businesses</h3>
            <p className="muted small" style={{ marginTop: '0.5rem' }}>
              Supabase returned this error:
            </p>
            <pre style={{
              whiteSpace: 'pre-wrap',
              marginTop: '0.75rem',
              color: 'var(--danger)'
            }}>
              {error}
            </pre>
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr',
          gap: 28,
          alignItems: 'start'
        }}>
          <aside className="card" style={{
            position: 'sticky',
            top: 96
          }}>
            <h3 style={{ marginBottom: '0.35rem' }}>
              Find a service
            </h3>
            <p className="small muted" style={{ marginBottom: '1rem' }}>
              Filter by service type, business name or location.
            </p>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label className="small muted">
                  Search
                </label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Barber, dentist, salon..."
                  style={{ width: '100%', marginTop: '0.4rem' }}
                />
              </div>

              <div>
                <label className="small muted">
                  Category
                </label>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Barber, Dentist..."
                  list="category-options"
                  style={{ width: '100%', marginTop: '0.4rem' }}
                />

                <datalist id="category-options">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="small muted">
                  City
                </label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Coventry, Tirana..."
                  list="city-options"
                  style={{ width: '100%', marginTop: '0.4rem' }}
                />

                <datalist id="city-options">
                  {cities.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <button className="btn btn-accent" onClick={applyFiltersToUrl}>
                Search
              </button>

              <button className="btn btn-ghost" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          </aside>

          <section>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '1rem'
            }}>
              <div>
                <p className="small muted">Marketplace</p>
                <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.15rem' }}>
                  {loading
                    ? 'Loading businesses...'
                    : `${filteredBusinesses.length} bookable business${filteredBusinesses.length === 1 ? '' : 'es'}`}
                </h2>
              </div>
            </div>

            {loading && (
              <div className="card">
                <p className="muted">Loading businesses from Supabase...</p>
              </div>
            )}

            {!loading && !error && businesses.length === 0 && (
              <div className="card">
                <h3>No bookable businesses yet</h3>
                <p className="muted" style={{ marginTop: '0.5rem' }}>
                  Published businesses will appear here once they have at least one active service available to book.
                </p>
              </div>
            )}

            {!loading && !error && businesses.length > 0 && filteredBusinesses.length === 0 && (
              <div className="card">
                <h3>No businesses match your filters</h3>
                <p className="muted">
                  Try changing your search, category or city filter, or clear filters to view all bookable businesses.
                </p>
              </div>
            )}

            <div style={{ display: 'grid', gap: '1rem' }}>
              {!loading && !error && filteredBusinesses.map((business) => (
                <div
                  key={business.id}
                  className="card"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '86px 1fr auto',
                    gap: '1rem',
                    alignItems: 'center'
                  }}
                >
                  <div style={{
                    width: 86,
                    height: 86,
                    borderRadius: 18,
                    background: 'var(--accent-dim)',
                    border: '1px solid rgba(255,107,53,0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2rem'
                  }}>
                    {business.category?.toLowerCase().includes('dent') ? '🦷' :
                      business.category?.toLowerCase().includes('barber') ? '💈' :
                      business.category?.toLowerCase().includes('salon') ? '✂️' :
                      '✨'}
                  </div>

                  <div>
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
                    </div>

                    <p className="muted small" style={{ marginBottom: '0.55rem', maxWidth: 620 }}>
                      {business.description || 'Book available services with this business.'}
                    </p>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.55rem' }}>
                      <span
                        className="small"
                        style={{
                          background: 'rgba(45,212,191,0.12)',
                          color: 'var(--success)',
                          padding: '0.2rem 0.55rem',
                          borderRadius: 999
                        }}
                      >
                        Accepting bookings
                      </span>

                      <span
                        className="small"
                        style={{
                          background: 'var(--surface-2)',
                          color: 'var(--text-muted)',
                          padding: '0.2rem 0.55rem',
                          borderRadius: 999,
                          border: '1px solid var(--border)'
                        }}
                      >
                        {(business.services || []).filter((service) => service.active).length} active service{(business.services || []).filter((service) => service.active).length === 1 ? '' : 's'}
                      </span>
                    </div>

                    <p className="small muted">
                      {[business.address, business.city, business.country]
                        .filter(Boolean)
                        .join(', ') || 'Location not added yet'}
                    </p>
                  </div>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    alignItems: 'flex-end'
                  }}>
                    <Link href={`/explore/${business.id}`} className="btn btn-accent">
                      View & book
                    </Link>

                    {business.phone && (
                      <span className="small muted">
                        {business.phone}
                      </span>
                    )}

                    <span className="small muted">
                      Real-time slots
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}