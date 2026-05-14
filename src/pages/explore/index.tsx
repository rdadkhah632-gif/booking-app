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
  const [sortBy, setSortBy] = useState<'newest' | 'name' | 'city' | 'services'>('newest')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!router.isReady) return

    const queryParam = typeof router.query.query === 'string' ? router.query.query : ''
    const cityParam = typeof router.query.city === 'string' ? router.query.city : ''
    const categoryParam = typeof router.query.category === 'string' ? router.query.category : ''
    const sortParam = typeof router.query.sort === 'string' ? router.query.sort : 'newest'

    setSearch(queryParam)
    setCity(cityParam)
    setCategory(categoryParam)
    setSortBy(['newest', 'name', 'city', 'services'].includes(sortParam) ? sortParam as 'newest' | 'name' | 'city' | 'services' : 'newest')
  }, [router.isReady, router.query.query, router.query.city, router.query.category, router.query.sort])

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
    if (categoryText.includes('nail')) return '💅'
    if (categoryText.includes('tattoo')) return '🖊️'
    if (categoryText.includes('pet')) return '🐾'
    if (categoryText.includes('beauty')) return '✨'
    return '✨'
  }

  function bookingModeLabel(business: Business) {
    return business.auto_accept_bookings === false ? 'Approval required' : 'Instant confirmation'
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
    const filtered = businesses.filter((business) => {
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

    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'city') return (a.city || '').localeCompare(b.city || '') || a.name.localeCompare(b.name)
      if (sortBy === 'services') return getBusinessStats(b).activeServices - getBusinessStats(a).activeServices
      return 0
    })
  }, [businesses, search, city, category, sortBy])

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
        ...(category.trim() ? { category: category.trim() } : {}),
        ...(sortBy !== 'newest' ? { sort: sortBy } : {})
      }
    })
  }

  function clearFilters() {
    setSearch('')
    setCity('')
    setCategory('')
    setSortBy('newest')
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
              Mirëbook marketplace
            </p>

            <h1 className="page-title">
              Find real appointments near you.
            </h1>

            <p className="page-sub" style={{ marginTop: '0.75rem', maxWidth: 760 }}>
              Browse published Mirëbook businesses across Albania, the UK and future international markets. Compare local services, choose a real available time with Any available staff or a specific staff member, and book without a customer checkout step.
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
                Smart calendar availability
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
                No Mirëbook customer payment required
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

        <div className="explore-layout-grid">
          <aside className="card explore-filter-panel">
            <h3 style={{ marginBottom: '0.35rem' }}>
              Find a service
            </h3>
            <p className="small muted" style={{ marginBottom: '1rem' }}>
              Filter by service type, business name or location. Mirëbook only shows published businesses with active services, active staff and working hours.
            </p>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label className="small muted">Search</label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Barber, nails, dentist, salon..."
                  style={{ width: '100%', marginTop: '0.4rem' }}
                />
              </div>

              <div>
                <label className="small muted">Category</label>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Barber, Nails, Dentist..."
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
                  placeholder="Tirana, Coventry, London..."
                  list="city-options"
                  style={{ width: '100%', marginTop: '0.4rem' }}
                />

                <datalist id="city-options">
                  {cities.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="small muted">Sort</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'newest' | 'name' | 'city' | 'services')}
                  style={{ width: '100%', marginTop: '0.4rem' }}
                >
                  <option value="newest">Newest first</option>
                  <option value="name">Business name</option>
                  <option value="city">City</option>
                  <option value="services">Most services</option>
                </select>
              </div>

              <button className="btn btn-accent" onClick={applyFiltersToUrl}>
                Search Mirëbook
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
                <p className="small muted">Mirëbook marketplace</p>
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
              <Link href="/register" className="btn btn-ghost">
                List your business
              </Link>

              <Link href="/support" className="btn btn-ghost">
                Support
              </Link>
            </div>

            {loading && (
              <div className="card">
                <p className="muted">Loading bookable Mirëbook businesses...</p>
              </div>
            )}

            {!loading && !error && businesses.length === 0 && (
              <div className="card">
                <h3>No bookable businesses yet</h3>
                <p className="muted" style={{ marginTop: '0.5rem' }}>
                  Businesses appear here when they are published and have active services, active staff and working hours configured. Customers can browse and book through Mirëbook without paying Mirëbook at checkout.
                </p>
                <div className="explore-empty-actions">
                  <Link href="/register" className="btn btn-accent">
                    Add the first business
                  </Link>

                  <Link href="/support" className="btn btn-ghost">
                    Learn how Mirëbook works
                  </Link>
                </div>
              </div>
            )}

            {!loading && !error && businesses.length > 0 && filteredBusinesses.length === 0 && (
              <div className="card">
                <h3>No businesses match your filters</h3>
                <p className="muted" style={{ marginTop: '0.5rem' }}>
                  Try changing your search, category or city filter, or clear filters to view all bookable businesses. Mirëbook is being prepared for Albania, the UK and wider international markets.
                </p>
                <div className="explore-empty-actions">
                  <button onClick={clearFilters} className="btn btn-accent">
                    Clear filters
                  </button>

                  <Link href="/register" className="btn btn-ghost">
                    List your business
                  </Link>
                </div>
              </div>
            )}

            <div className="explore-results-grid">
              {!loading && !error && filteredBusinesses.map((business) => {
                const stats = getBusinessStats(business)
                const serviceText = `${stats.activeServices} service${stats.activeServices === 1 ? '' : 's'}`
                const staffText = `${stats.activeStaff} staff`

                return (
                  <div
                    key={business.id}
                    className="card explore-business-card"
                  >
                    <div
                      className="explore-business-image"
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

                    <div className="explore-business-content">
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
                        {business.description || 'Book available services through Mirëbook. Customers do not pay Mirëbook to make appointments.'}
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
                          Bookable on Mirëbook
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
                          Customer booking only
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
                          {stats.openDays} open day{stats.openDays === 1 ? '' : 's'}
                        </span>
                      </div>

                      <p className="small muted">
                        {[business.address, business.city, business.country]
                          .filter(Boolean)
                          .join(', ') || 'Location not added yet'}
                      </p>
                    </div>

                    <div className="explore-business-actions">
                      <Link href={`/explore/${business.id}`} className="btn btn-accent">
                        View times and book
                      </Link>

                      {business.phone && (
                        <span className="small muted">
                          {business.phone}
                        </span>
                      )}

                      <span className="small muted">
                        {bookingModeLabel(business)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </section>
      <section className="container explore-trust-section">
        <div className="grid-3">
          <div className="card">
            <p className="small muted">For customers</p>
            <h3 style={{ marginTop: '0.25rem' }}>Book without checkout friction</h3>
            <p className="muted" style={{ marginTop: '0.5rem' }}>
              Mirëbook helps customers request or confirm appointments. Appointment payment is not part of the current customer flow.
            </p>
          </div>

          <div className="card">
            <p className="small muted">For businesses</p>
            <h3 style={{ marginTop: '0.25rem' }}>Subscription billing is separate</h3>
            <p className="muted" style={{ marginTop: '0.5rem' }}>
              Businesses can prepare subscription billing inside the dashboard while customer booking remains focused on appointments.
            </p>
            <Link href="/dashboard/billing" className="btn btn-ghost" style={{ marginTop: '1rem' }}>
              Billing groundwork
            </Link>
          </div>

          <div className="card">
            <p className="small muted">Support and trust</p>
            <h3 style={{ marginTop: '0.25rem' }}>Clear launch foundations</h3>
            <p className="muted" style={{ marginTop: '0.5rem' }}>
              Support, privacy and terms pages are in place for early testing and should be reviewed before public launch.
            </p>
            <div className="explore-trust-actions">
              <Link href="/support" className="btn btn-ghost">Support</Link>
              <Link href="/privacy" className="btn btn-ghost">Privacy</Link>
              <Link href="/terms" className="btn btn-ghost">Terms</Link>
            </div>
          </div>
        </div>
      </section>
      <style jsx>{`
        .explore-layout-grid {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 28px;
          align-items: start;
        }

        .explore-filter-panel {
          position: sticky;
          top: 96px;
        }

        .explore-results-grid {
          display: grid;
          gap: 1rem;
        }

        .explore-business-card {
          display: grid;
          grid-template-columns: 160px 1fr auto;
          gap: 1rem;
          align-items: stretch;
          overflow: hidden;
          padding: 0;
        }

        .explore-business-image {
          border-right: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
        }

        .explore-business-content {
          padding: 1rem 0;
        }

        .explore-business-actions {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          align-items: flex-end;
          justify-content: center;
          padding: 1rem;
        }

        .explore-empty-actions,
        .explore-trust-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-top: 1rem;
        }

        .explore-trust-section {
          padding-bottom: 70px;
        }

        @media (max-width: 980px) {
          .explore-layout-grid {
            grid-template-columns: 1fr;
          }

          .explore-filter-panel {
            position: static;
          }
        }

        @media (max-width: 760px) {
          .explore-business-card {
            grid-template-columns: 1fr;
          }

          .explore-business-image {
            min-height: 180px !important;
            border-right: 0;
            border-bottom: 1px solid var(--border);
          }

          .explore-business-content {
            padding: 1rem;
          }

          .explore-business-actions {
            align-items: stretch;
            padding: 0 1rem 1rem;
          }

          .explore-business-actions :global(.btn) {
            width: 100%;
            justify-content: center;
          }

          .explore-empty-actions,
          .explore-trust-actions {
            display: grid;
          }

          .explore-empty-actions :global(.btn),
          .explore-empty-actions button,
          .explore-empty-actions a,
          .explore-trust-actions :global(.btn),
          .explore-trust-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  )
}