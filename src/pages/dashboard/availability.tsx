import { useEffect, useState } from 'react'
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

  const [business, setBusiness] = useState<Business | null>(null)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function init() {
    setError(null)
    setPageLoading(true)

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

    if (!businessId || Array.isArray(businessId)) {
      setBusiness(null)
      setRows([])
      setPageLoading(false)
      return
    }

    const { data: businessData, error: businessError } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('id', businessId)
      .eq('user_id', session.user.id)
      .single()

    if (businessError || !businessData) {
      setError(businessError?.message || 'Business not found.')
      setBusiness(null)
      setRows([])
      setPageLoading(false)
      return
    }

    setBusiness(businessData)

    const { data: existing, error: availabilityError } = await supabase
      .from('availability')
      .select('*')
      .eq('business_id', businessData.id)
      .order('day_of_week')

    if (availabilityError) {
      setError(availabilityError.message)
      setPageLoading(false)
      return
    }

    if (existing && existing.length > 0) {
      setRows(existing)
    } else {
      setRows(days.map((_, i) => ({
        business_id: businessData.id,
        day_of_week: i,
        start_time: '09:00',
        end_time: '17:00',
        is_closed: i === 0
      })))
    }

    setPageLoading(false)
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

    await supabase.from('availability').delete().eq('business_id', business.id)

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
  }

  return (
    <DashboardLayout
      title="Working hours"
      subtitle={business ? `Editing availability for ${business.name}` : 'Choose a business from Business Profile first.'}
    >
      {!businessId && (
        <div className="card">
          <h3>No business selected</h3>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            Go to Business Profile and choose Working hours under the business you want to edit.
          </p>
          <button
            className="btn btn-accent"
            style={{ marginTop: '1rem' }}
            onClick={() => router.push('/dashboard/businesses')}
          >
            Go to Business Profile
          </button>
        </div>
      )}

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