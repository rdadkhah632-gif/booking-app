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
  image_url?: string | null
  auto_accept_bookings?: boolean | null
  services?: { id: string; active: boolean }[] | null
  staff_members?: { id: string; active: boolean }[] | null
  availability?: { id: string; is_closed?: boolean | null }[] | null
}

type BusinessCardStats = {
  activeServices: number
  activeStaff: number
  openDays: number
  bookable: boolean
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
          image_url,
          auto_accept_bookings,
          published,
          created_at,
          services (
            id,
            active
          ),
          staff_members (
            id,
            active
          ),
          availability (
            id,
            is_closed
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

      const normalisedBusinesses = (data || [])
        .map((business: any) => ({
          ...business,
          services: business.services || [],
          staff_members: business.staff_members || [],
          availability: business.availability || []
        }))
        .filter((business: Business) => {
          const stats = getBusinessStats(business)
          return stats.bookable
        })

      setBusinesses(normalisedBusinesses)
      setLoading(false)
    } catch (err: any) {
      setError(err.message || 'Something went wrong while loading businesses.')
      setBusinesses([])
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBusinesses()
  }, [])

  function getBusinessStats(business: Business): BusinessCardStats {
    const activeServices = (business.services || []).filter((service) => service.active).length
    const activeStaff = (business.staff_members || []).filter((staff) => staff.active).length
    const openDays = (business.availability || []).filter((row) => row.is_closed !== true).length

    return {
      activeServices,
      activeStaff,
      openDays,
      bookable: activeServices > 0 && activeStaff > 0 && openDays > 0
    }
  }

  function businessIcon(business: Business) {
    const categoryText = business.category?.toLowerCase() || ''

    if (categoryText.includes('dent')) return '🦷'
    if (categoryText.includes('barber')) return '💈'
    if (categoryText.includes('salon')) return '✂️'
    if (categoryText.includes('restaurant')) return '🍽️'
    if (categoryText.includes('clinic')) return '🏥'
    if (categoryText.includes('spa')) return '🧖'
    return '✨'
  }

  const cities = useMemo(() => {
    const unique = new Set(
      businesses
        .map((b) => b.city?.trim())
        .filter(Boolean) as string[]
    )

    return Array.from(unique).sort((a, b) => a.localeCompare(b))
  }, [businesses])

  const categories = useMemo(() => {
    const unique = new Set(
      businesses
        .map((b) => b.category?.trim())
        .filter(Boolean) as string[]
    )

    return Array.from(unique).sort((a, b) => a.localeCompare(b))
  }, [businesses])

  const filteredBusinesses = useMemo(() => {
    return businesses.filter((business) => {
      const searchText = `${business.name || ''} ${business.description || ''} ${business.category || ''} ${business.city || ''} ${business.country || ''} ${business.address || ''}`.toLowerCase()

      const matchesSearch = search.trim()
        ? searchText.includes(search.toLowerCase())
        : true

      const matchesCity = city.trim()
        ? (business.city || '').toLowerCase().includes(city.toLowerCase())
        : true

      const matchesCategory = category.trim()
        ? (business.category || '').toLowerCase().includes(category.toLowerCase())
        : true

      return matchesSearch && matchesCity && matchesCategory
    })
  }, [businesses, search, city, category])

  const marketplaceStats = useMemo(() => {
    return {
      businesses: businesses.length,
      cities: cities.length,
      categories: categories.length,
      visible: filteredBusinesses.length
    }
  }, [businesses.length, cities.length, categories.length, filteredBusinesses.length])

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

      <section className="container" style={{ padding: '32px 24px 70px' }}>
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
              Slotly marketplace
            </p>

            <h1 className="page-title">
              Find your next appointment.
            </h1>

            <p className="page-sub" style={{ marginTop: '0.75rem', maxWidth: 760 }}>
              Browse real bookable businesses, compare local services and choose an available time with the staff member you want.
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
                Real-time availability
              </span>
            </div>
          </div>
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
          gridTemplateColumns: '280px 1fr',
          gap: 28,
          alignItems: 'start'
        }}>
          <aside className="card" style={{ position: 'sticky', top: 96 }}>
            <h3 style={{ marginBottom: '0.35rem' }}>
              Find a service
            </h3>
            <p className="small muted" style={{ marginBottom: '1rem' }}>
              Filter by service type, business name or location.
            </p>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label className="small muted">Search</label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Barber, dentist, salon..."
                  style={{ width: '100%', marginTop: '0.4rem' }}
                />
              </div>

              <div>
                <label className="small muted">Category</label>
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
                <label className="small muted">City</label>
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
                Search marketplace
              </button>

              <button className="btn btn-ghost" onClick={clearFilters}>
                Clear filters
              </button>

              <button className="btn btn-ghost" onClick={loadBusinesses} disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh results'}
              </button>
            </div>
          </aside>

          <section>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '1rem',
              flexWrap: 'wrap'
            }}>
              <div>
                <p className="small muted">Marketplace</p>
                <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.15rem' }}>
                  {loading
                    ? 'Loading businesses...'
                    : `${filteredBusinesses.length} bookable business${filteredBusinesses.length === 1 ? '' : 'es'}`}
                </h2>
              </div>

              {(search || city || category) && (
                <button onClick={clearFilters} className="btn btn-ghost">
                  Clear current filters
                </button>
              )}
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
                  Businesses appear here when they are published and have active services, active staff and working hours configured.
                </p>
              </div>
            )}

            {!loading && !error && businesses.length > 0 && filteredBusinesses.length === 0 && (
              <div className="card">
                <h3>No businesses match your filters</h3>
                <p className="muted" style={{ marginTop: '0.5rem' }}>
                  Try changing your search, category or city filter, or clear filters to view all bookable businesses.
                </p>
              </div>
            )}

            <div style={{ display: 'grid', gap: '1rem' }}>
              {!loading && !error && filteredBusinesses.map((business) => {
                const stats = getBusinessStats(business)
                const serviceText = `${stats.activeServices} service${stats.activeServices === 1 ? '' : 's'}`
                const staffText = `${stats.activeStaff} staff`

                return (
                  <div
                    key={business.id}
                    className="card"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '160px 1fr auto',
                      gap: '1rem',
                      alignItems: 'stretch',
                      overflow: 'hidden',
                      padding: 0
                    }}
                  >
                    <div
                      style={{
                        minHeight: 150,
                        background: business.image_url
                          ? `linear-gradient(rgba(11,18,32,0.05), rgba(11,18,32,0.65)), url(${business.image_url})`
                          : 'var(--accent-dim)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        borderRight: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2rem'
                      }}
                    >
                      {!business.image_url && businessIcon(business)}
                    </div>

                    <div style={{ padding: '1rem 0' }}>
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

                        <span
                          className="small"
                          style={{
                            background: business.auto_accept_bookings === false ? 'rgba(255,107,53,0.12)' : 'rgba(45,212,191,0.12)',
                            color: business.auto_accept_bookings === false ? 'var(--accent)' : 'var(--success)',
                            padding: '0.2rem 0.55rem',
                            borderRadius: 999
                          }}
                        >
                          {business.auto_accept_bookings === false ? 'Approval required' : 'Instant confirmation'}
                        </span>
                      </div>

                      <p className="muted small" style={{ marginBottom: '0.65rem', marginTop: '0.35rem', maxWidth: 680 }}>
                        {business.description || 'Book available services with this business.'}
                      </p>

                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
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
                          {serviceText}
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
                          {staffText}
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
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      padding: '1rem'
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
                )
              })}
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}