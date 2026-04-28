import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'

type Business = {
  id: string
  name: string
  description?: string | null
  category?: string | null
  city?: string | null
  country?: string | null
  phone?: string | null
  address?: string | null
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
          .select('id, name, description, category, city, country, phone, address, published, created_at')
          .eq('published', true)
          .order('created_at', { ascending: false })

        const { data, error } = await Promise.race([query, timeout])

        if (error) {
          setError(error.message)
          setBusinesses([])
          setLoading(false)
          return
        }

        setBusinesses(data || [])
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
      <nav className="nav-simple">
        <div className="nav-simple-inner">
          <Link href="/" className="logo">
            Slot<span>ly</span>
          </Link>

          <div style={{
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <Link href="/my-bookings" className="muted">
              My bookings
            </Link>
            <Link href="/login" className="muted">
              Login
            </Link>
            <Link href="/register" className="btn btn-accent">
              Join
            </Link>
          </div>
        </div>
      </nav>

      <section className="container" style={{ padding: '32px 24px' }}>
        <div style={{ marginBottom: '28px' }}>
          <p className="small muted" style={{ marginBottom: '0.5rem' }}>
            Search local services
          </p>

          <h1 className="page-title">
            Find your next appointment.
          </h1>

          <p className="page-sub" style={{ marginTop: '0.75rem', maxWidth: 620 }}>
            Browse published businesses, compare services and book available slots instantly.
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
            <h3 style={{ marginBottom: '1rem' }}>
              Filters
            </h3>

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
              <p className="muted">
                {loading
                  ? 'Loading businesses...'
                  : `${filteredBusinesses.length} business${filteredBusinesses.length === 1 ? '' : 'es'} found`}
              </p>
            </div>

            {loading && (
              <div className="card">
                <p className="muted">Loading businesses from Supabase...</p>
              </div>
            )}

            {!loading && !error && businesses.length === 0 && (
              <div className="card">
                <h3>No published businesses yet</h3>
                <p className="muted" style={{ marginTop: '0.5rem' }}>
                  This means your site is connected, but there are no businesses with published set to true.
                </p>
                <p className="muted small" style={{ marginTop: '0.75rem' }}>
                  Log in as a business, go to Business Profile, and click Publish Business.
                </p>
              </div>
            )}

            {!loading && !error && businesses.length > 0 && filteredBusinesses.length === 0 && (
              <div className="card">
                <h3>No businesses match your filters</h3>
                <p className="muted">
                  Try changing your search, category or city filter.
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
                    gridTemplateColumns: '80px 1fr auto',
                    gap: '1rem',
                    alignItems: 'center'
                  }}
                >
                  <div style={{
                    width: 80,
                    height: 80,
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

                    <p className="muted small" style={{ marginBottom: '0.4rem' }}>
                      {business.description || 'Service business'}
                    </p>

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
                      View & Book
                    </Link>

                    {business.phone && (
                      <span className="small muted">
                        {business.phone}
                      </span>
                    )}
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