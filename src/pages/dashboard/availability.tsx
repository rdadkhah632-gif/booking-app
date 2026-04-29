import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/DashboardLayout'

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type Business = {
  id: string
  name: string
}

export default function Availability() {
  const router = useRouter()
  const { businessId } = router.query

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [business, setBusiness] = useState<Business | null>(null)
  const [rows, setRows] = useState<any[]>([])

  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function getBusinessContext(sessionUserId: string) {
    const { data: ownedBusinesses, error: businessesError } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('user_id', sessionUserId)
      .order('created_at', { ascending: false })

    if (businessesError) throw businessesError

    const owned = ownedBusinesses || []
    setBusinesses(owned)

    if (owned.length === 0) return null

    if (businessId && !Array.isArray(businessId)) {
      const selected = owned.find((b) => b.id === businessId)

      if (!selected) {
        throw new Error('You do not have access to this business.')
      }

      return selected
    }

    if (owned.length === 1) return owned[0]

    return null
  }

  async function init() {
    setError(null)
    setPageLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (!profile || profile.role !== 'business') {
        router.replace('/explore')
        return
      }

      const selectedBusiness = await getBusinessContext(session.user.id)

      if (!selectedBusiness) {
        setBusiness(null)
        setRows([])
        setPageLoading(false)
        return
      }

      setBusiness(selectedBusiness)

      const { data: existing, error: availabilityError } = await supabase
        .from('availability')
        .select('*')
        .eq('business_id', selectedBusiness.id)
        .order('day_of_week')

      if (availabilityError) throw availabilityError

      if (existing && existing.length > 0) {
        setRows(existing)
      } else {
        setRows(days.map((_, i) => ({
          business_id: selectedBusiness.id,
          day_of_week: i,
          start_time: '09:00',
          end_time: '17:00',
          is_closed: i === 0
        })))
      }

      setPageLoading(false)
    } catch (err: any) {
      setError(err.message || 'Could not load working hours.')
      setPageLoading(false)
    }
  }

  useEffect(() => {
    if (!router.isReady) return
    init()
  }, [router.isReady, businessId])

  function updateRow(index: number, field: string, value: any) {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  async function saveAvailability() {
    if (!business) return

    setLoading(true)
    setError(null)

    const { error: deleteError } = await supabase
      .from('availability')
      .delete()
      .eq('business_id', business.id)

    if (deleteError) {
      setError(deleteError.message)
      setLoading(false)
      return
    }

    const cleanRows = rows.map(r => ({
      business_id: business.id,
      day_of_week: r.day_of_week,
      start_time: r.start_time,
      end_time: r.end_time,
      is_closed: r.is_closed
    }))

    const { error } = await supabase.from('availability').insert(cleanRows)

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    alert('Working hours saved')
    await init()
  }

  return (
    <DashboardLayout
      title="Working hours"
      subtitle={business ? `Editing availability for ${business.name}` : 'Choose which business working hours to manage.'}
    >
      {pageLoading && (
        <div className="card">
          <p className="muted">Loading working hours...</p>
        </div>
      )}

      {error && (
        <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)', marginBottom: '1rem' }}>
          <p style={{ color: 'var(--danger)' }}>{error}</p>
        </div>
      )}

      {!pageLoading && businesses.length === 0 && (
        <div className="card">
          <h3>No business found</h3>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            Create a business profile first, then set working hours.
          </p>
          <Link href="/dashboard/businesses" className="btn btn-accent" style={{ marginTop: '1rem' }}>
            Create business
          </Link>
        </div>
      )}

      {!pageLoading && !business && businesses.length > 1 && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ padding: '0.25rem 0 0.5rem' }}>
            <p className="small muted" style={{ marginBottom: '0.35rem' }}>
              Multiple businesses found
            </p>
            <h3 style={{ marginBottom: '0.35rem' }}>
              Choose a business to continue
            </h3>
            <p className="muted">
              Select one of the business cards below. The next page will show working hours for that specific business.
            </p>
          </div>

          {businesses.map((b) => (
            <Link
              key={b.id}
              href={`/dashboard/availability?businessId=${b.id}`}
              className="card"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem'
              }}
            >
              <div>
                <strong>{b.name}</strong>
                <p className="small muted" style={{ marginTop: '0.35rem' }}>
                  Manage working hours for this business.
                </p>
              </div>

              <span className="btn btn-accent">
                Manage hours
              </span>
            </Link>
          ))}
        </div>
      )}

      {!pageLoading && business && (
        <>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {rows.map((row, index) => (
              <div
                key={row.day_of_week}
                className="card"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr 1fr',
                  gap: '0.75rem',
                  alignItems: 'center'
                }}
              >
                <strong>{days[row.day_of_week]}</strong>

                <label className="small muted">
                  <input
                    type="checkbox"
                    checked={row.is_closed}
                    onChange={(e) => updateRow(index, 'is_closed', e.target.checked)}
                    style={{ marginRight: '0.5rem' }}
                  />
                  Closed
                </label>

                <input
                  type="time"
                  value={row.start_time}
                  disabled={row.is_closed}
                  onChange={(e) => updateRow(index, 'start_time', e.target.value)}
                />

                <input
                  type="time"
                  value={row.end_time}
                  disabled={row.is_closed}
                  onChange={(e) => updateRow(index, 'end_time', e.target.value)}
                />
              </div>
            ))}
          </div>

          <button
            onClick={saveAvailability}
            disabled={loading}
            className="btn btn-accent"
            style={{ marginTop: '1.25rem' }}
          >
            {loading ? 'Saving...' : 'Save working hours'}
          </button>
        </>
      )}
    </DashboardLayout>
  )
}