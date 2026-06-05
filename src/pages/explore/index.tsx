import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AuthNav from '@/components/AuthNav'
import ExploreHero from '@/components/explore/ExploreHero'
import ExploreFilters from '@/components/explore/ExploreFilters'
import ExploreResultsHeader from '@/components/explore/ExploreResultsHeader'
import ExploreBusinessCard from '@/components/explore/ExploreBusinessCard'
import ExploreEmptyState from '@/components/explore/ExploreEmptyState'
import ExploreTrustSection from '@/components/explore/ExploreTrustSection'
import { Business, BusinessCardStats, SortOption } from '@/components/explore/exploreTypes'

export default function Explore() {
  const router = useRouter()

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [category, setCategory] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('newest')
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
    setSortBy(['newest', 'name', 'city', 'services'].includes(sortParam) ? sortParam as SortOption : 'newest')
  }, [router.isReady, router.query.query, router.query.city, router.query.category, router.query.sort])

  async function loadBusinesses() {
    setLoading(true)
    setError(null)

    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Mirëbook could not load marketplace results. Please refresh and try again.')), 8000)
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
            active,
            staff_services (
              staff_member_id
            )
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
          return business.published === true && stats.bookable
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
    const activeStaffIds = new Set((business.staff_members || []).filter((staff) => staff.active).map((staff) => staff.id))
    const activeServices = (business.services || []).filter((service) => service.active).length
    const assignedServices = (business.services || []).filter((service) =>
      service.active &&
      (service.staff_services || []).some((assignment) => activeStaffIds.has(assignment.staff_member_id))
    ).length
    const activeStaff = activeStaffIds.size
    const openDays = (business.availability || []).filter((row) => row.is_closed !== true).length
    const missing: string[] = []

    if (activeServices === 0) missing.push('active services')
    if (activeStaff === 0) missing.push('active staff')
    if (assignedServices === 0) missing.push('staff-service assignments')
    if (openDays === 0) missing.push('working hours')

    return {
      activeServices,
      activeStaff,
      openDays,
      assignedServices,
      missing,
      bookable: assignedServices > 0 && activeStaff > 0 && openDays > 0
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

  function locationLabel(business: Business) {
    return [business.address, business.city, business.country]
      .filter(Boolean)
      .join(', ') || 'Location details coming soon'
  }

  function imageBackground(business: Business) {
    if (!business.image_url) return 'var(--accent-dim)'

    return `linear-gradient(rgba(11,18,32,0.05), rgba(11,18,32,0.68)), url("${business.image_url}")`
  }

  const cities = useMemo(() => {
    const unique = new Set(
      businesses
        .map((business) => business.city?.trim())
        .filter(Boolean) as string[]
    )

    return Array.from(unique).sort((a, b) => a.localeCompare(b))
  }, [businesses])

  const categories = useMemo(() => {
    const unique = new Set(
      businesses
        .map((business) => business.category?.trim())
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
        <ExploreHero marketplaceStats={marketplaceStats} />

        {error && (
          <ExploreEmptyState type="error" error={error} onRetry={loadBusinesses} />
        )}

        <div className="explore-layout-grid">
          <ExploreFilters
            search={search}
            city={city}
            category={category}
            sortBy={sortBy}
            cities={cities}
            categories={categories}
            loading={loading}
            onSearchChange={setSearch}
            onCityChange={setCity}
            onCategoryChange={setCategory}
            onSortChange={setSortBy}
            onApplyFilters={applyFiltersToUrl}
            onClearFilters={clearFilters}
            onRefresh={loadBusinesses}
          />

          <section>
            <ExploreResultsHeader
              loading={loading}
              filteredCount={filteredBusinesses.length}
              hasFilters={Boolean(search || city || category)}
              onClearFilters={clearFilters}
            />

            {loading && (
              <div className="card">
                <p className="muted">Loading bookable Mirëbook businesses...</p>
              </div>
            )}

            {!loading && !error && businesses.length === 0 && (
              <ExploreEmptyState type="no-businesses" />
            )}

            {!loading && !error && businesses.length > 0 && filteredBusinesses.length === 0 && (
              <ExploreEmptyState type="no-results" onClearFilters={clearFilters} />
            )}

            <div className="explore-results-grid">
              {!loading && !error && filteredBusinesses.map((business) => (
                <ExploreBusinessCard
                  key={business.id}
                  business={business}
                  stats={getBusinessStats(business)}
                  businessIcon={businessIcon}
                  bookingModeLabel={bookingModeLabel}
                  locationLabel={locationLabel}
                  imageBackground={imageBackground}
                />
              ))}
            </div>
          </section>
        </div>
      </section>

      <ExploreTrustSection />

      <style jsx>{`
        .explore-layout-grid {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 28px;
          align-items: start;
        }

        :global(.explore-filter-panel) {
          position: sticky;
          top: 96px;
        }

        :global(.explore-results-header) {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }

        .explore-results-grid {
          display: grid;
          gap: 1rem;
        }

        :global(.explore-business-card) {
          display: grid;
          grid-template-columns: 160px 1fr auto;
          gap: 1rem;
          align-items: stretch;
          overflow: hidden;
          padding: 0;
          min-height: 170px;
        }

        :global(.explore-business-image) {
          border-right: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
        }

        :global(.explore-business-content) {
          padding: 1rem 0;
        }

        :global(.explore-business-actions) {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          align-items: flex-end;
          justify-content: center;
          padding: 1rem;
          min-width: 180px;
        }

        :global(.explore-muted-pill) {
          background: var(--surface-2);
          color: var(--text-muted);
          padding: 0.2rem 0.55rem;
          border-radius: 999px;
          border: 1px solid var(--border);
        }

        :global(.explore-empty-actions),
        :global(.explore-trust-actions) {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-top: 1rem;
        }

        :global(.explore-trust-section) {
          padding-bottom: 70px;
        }

        @media (max-width: 980px) {
          .explore-layout-grid {
            grid-template-columns: 1fr;
          }

          :global(.explore-filter-panel) {
            position: static;
          }
        }

        @media (max-width: 760px) {
          :global(.explore-business-card) {
            grid-template-columns: 1fr;
          }

          :global(.explore-business-image) {
            min-height: 180px !important;
            border-right: 0;
            border-bottom: 1px solid var(--border);
          }

          :global(.explore-business-content) {
            padding: 1rem;
          }

          :global(.explore-business-actions) {
            align-items: stretch;
            padding: 0 1rem 1rem;
            min-width: 0;
          }

          :global(.explore-business-actions .btn) {
            width: 100%;
            justify-content: center;
          }

          :global(.explore-empty-actions),
          :global(.explore-trust-actions) {
            display: grid;
          }

          :global(.explore-empty-actions .btn),
          :global(.explore-empty-actions button),
          :global(.explore-empty-actions a),
          :global(.explore-trust-actions .btn),
          :global(.explore-trust-actions a) {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  )
}
