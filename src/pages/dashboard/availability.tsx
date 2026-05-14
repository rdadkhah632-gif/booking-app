import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/DashboardLayout'

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type Business = {
  id: string
  name: string
  published?: boolean | null
}

type AvailabilityRow = {
  id?: string
  business_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_closed: boolean
}

export default function Availability() {
  const router = useRouter()
  const { businessId } = router.query

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [business, setBusiness] = useState<Business | null>(null)
  const [rows, setRows] = useState<AvailabilityRow[]>([])

  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function defaultRows(currentBusinessId: string): AvailabilityRow[] {
    return days.map((_, i) => ({
      business_id: currentBusinessId,
      day_of_week: i,
      start_time: '09:00',
      end_time: '17:00',
      is_closed: i === 0
    }))
  }

  async function getBusinessContext(sessionUserId: string) {
    const { data: ownedBusinesses, error: businessesError } = await supabase
      .from('businesses')
      .select('id, name, published')
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
    setSuccess(null)
    setPageLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login')
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
        const existingByDay = new Map<number, AvailabilityRow>()
        existing.forEach((row: AvailabilityRow) => existingByDay.set(row.day_of_week, row))

        setRows(
          days.map((_, i) =>
            existingByDay.get(i) || {
              business_id: selectedBusiness.id,
              day_of_week: i,
              start_time: '09:00',
              end_time: '17:00',
              is_closed: i === 0
            }
          )
        )
      } else {
        setRows(defaultRows(selectedBusiness.id))
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

  const availabilityStats = useMemo(() => {
    const openRows = rows.filter((row) => !row.is_closed)
    const closedRows = rows.filter((row) => row.is_closed)
    const invalidRows = openRows.filter((row) => row.start_time >= row.end_time)
const totalHours = openRows.reduce((total, row) => {
  if (row.start_time >= row.end_time) return total

  const start = new Date(`2026-01-01T${row.start_time}`)
  const end = new Date(`2026-01-01T${row.end_time}`)

  return total + ((end.getTime() - start.getTime()) / 3600000)
}, 0)

    return {
      openDays: openRows.length,
      closedDays: closedRows.length,
      invalidDays: invalidRows.length,
totalHours,
ready: openRows.length > 0 && invalidRows.length === 0
    }
  }, [rows])

  function updateRow(index: number, field: keyof AvailabilityRow, value: string | boolean) {
    setRows((prev) => prev.map((row, i) => i === index ? { ...row, [field]: value } : row))
  }

  function applyWeekdayPreset() {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        start_time: row.day_of_week === 0 || row.day_of_week === 6 ? row.start_time : '09:00',
        end_time: row.day_of_week === 0 || row.day_of_week === 6 ? row.end_time : '17:00',
        is_closed: row.day_of_week === 0 || row.day_of_week === 6
      }))
    )
  }

function applyExtendedPreset() {
  setRows((prev) =>
    prev.map((row) => ({
      ...row,
      start_time: row.day_of_week === 0 ? row.start_time : '09:00',
      end_time: row.day_of_week === 0 ? row.end_time : '19:00',
      is_closed: row.day_of_week === 0
    }))
  )
}
  function closeAllDays() {
    const confirmed = confirm('Close every day for this business? Customers may not see any available booking days unless staff-specific hours still allow bookings.')
    if (!confirmed) return

    setRows((prev) => prev.map((row) => ({ ...row, is_closed: true })))
  }

  async function saveAvailability() {
    if (!business) return

    const invalidRow = rows.find((row) => !row.is_closed && row.start_time >= row.end_time)

    if (invalidRow) {
      setError(`${days[invalidRow.day_of_week]} has an invalid time range. Start time must be before end time.`)
      return
    }

    if (availabilityStats.openDays === 0) {
      const confirmed = confirm('This business has no open days. Customers may not be able to book unless staff-specific availability is configured. Save anyway?')
      if (!confirmed) return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    const { error: deleteError } = await supabase
      .from('availability')
      .delete()
      .eq('business_id', business.id)

    if (deleteError) {
      setError(deleteError.message)
      setLoading(false)
      return
    }

    const cleanRows = rows.map((row) => ({
      business_id: business.id,
      day_of_week: row.day_of_week,
      start_time: row.start_time,
      end_time: row.end_time,
      is_closed: row.is_closed
    }))

    const { error } = await supabase.from('availability').insert(cleanRows)

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess('Business-wide working hours saved. Mirëbook will use these as a fallback when staff-specific hours are not set.')
    await init()
  }

  return (
    <DashboardLayout
      title="Business working hours"
subtitle={business ? `Set Mirëbook business-wide fallback hours for ${business.name}` : 'Choose which business working hours to manage.'}
    >
      {pageLoading && (
        <div className="card">
          <p className="muted">Loading Mirëbook working hours...</p>
        </div>
      )}

      {success && (
        <div className="card" style={{ borderColor: 'rgba(45,212,191,0.35)', background: 'rgba(45,212,191,0.06)', marginBottom: '1rem' }}>
          <p style={{ color: 'var(--success)' }}>{success}</p>
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
            Create a business profile first, then set Mirëbook working hours.
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
              Select one of the business cards below. Mirëbook will show working hours for that specific business.
            </p>
          </div>

          {businesses.map((b) => (
            <Link
              key={b.id}
              href={`/dashboard/availability?businessId=${b.id}`}
              className="card"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}
            >
              <div>
                <strong>{b.name}</strong>
                <p className="small muted" style={{ marginTop: '0.25rem' }}>
                  {b.published ? 'Published' : 'Hidden / draft'}
                </p>
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
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <p className="small muted">Mirëbook business-wide availability</p>
                <h3>{business.name}</h3>
                <p className="small muted" style={{ marginTop: '0.35rem' }}>
                  These are your general business opening hours. Staff-specific hours override these where set, and Mirëbook uses both to decide which dates and times customers can actually book.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Link href={`/dashboard/businesses`} className="btn btn-ghost">
                  Setup hub
                </Link>

                <Link href={`/dashboard/staff?businessId=${business.id}`} className="btn btn-ghost">
                  Staff setup
                </Link>
              </div>
            </div>
          </div>

          <div className="grid-3" style={{ marginBottom: '1.25rem' }}>
            <div className="card">
              <p className="small muted">Open days</p>
              <h3>{availabilityStats.openDays}</h3>
              <p className="muted small">Business days marked as open</p>
            </div>

            <div className="card">
              <p className="small muted">Closed days</p>
              <h3>{availabilityStats.closedDays}</h3>
              <p className="muted small">Business days marked as closed</p>
            </div>
<div className="card">
  <p className="small muted">Weekly hours</p>
  <h3>{availabilityStats.totalHours.toFixed(1)}</h3>
  <p className="muted small">Estimated business-wide open hours</p>
</div>
            <div className="card" style={{ borderColor: availabilityStats.invalidDays > 0 ? 'rgba(255,77,109,0.35)' : 'var(--border)' }}>
              <p className="small muted">Invalid days</p>
              <h3>{availabilityStats.invalidDays}</h3>
              <p className="muted small">Open days where start time is not before end time</p>
            </div>

            <div className="card" style={{ borderColor: availabilityStats.ready ? 'rgba(45,212,191,0.25)' : 'rgba(255,190,11,0.35)' }}>
              <p className="small muted">Status</p>
              <h3>{availabilityStats.ready ? 'Ready' : 'Needs work'}</h3>
              <p className="muted small">At least one valid open day helps Mirëbook generate customer booking dates</p>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <p className="small muted">Quick presets</p>
                <h3>Set common business hours</h3>
                <p className="small muted" style={{ marginTop: '0.35rem' }}>
                  Presets update the table below. You still need to click Save working hours before customers see the change.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={applyWeekdayPreset} className="btn btn-ghost">
                  Mon-Fri 9-5
                </button>

                <button type="button" onClick={applyWeekdayPreset} className="btn btn-ghost">
                  Mon-Fri 9-5
                </button>
<button type="button" onClick={applyExtendedPreset} className="btn btn-ghost">
  Mon-Sat 9-7
</button>
                <button type="button" onClick={closeAllDays} className="btn btn-danger">
                  Close all days
                </button>
              </div>
            </div>
          </div>

          <div className="availability-day-list">
            {rows.map((row, index) => {
              const invalid = !row.is_closed && row.start_time >= row.end_time

              return (
                <div
                  key={row.day_of_week}
                  className="card availability-day-row"
style={{
  borderColor: invalid ? 'rgba(255,77,109,0.35)' : row.is_closed ? 'rgba(255,190,11,0.20)' : 'var(--border)',
  opacity: row.is_closed ? 0.76 : 1
}}
                >
                  <div>
                    <strong>{days[row.day_of_week]}</strong>
                    <p className="small" style={{ color: invalid ? 'var(--danger)' : row.is_closed ? 'var(--warning)' : 'var(--success)', marginTop: '0.25rem' }}>
                      {invalid ? 'Invalid time range' : row.is_closed ? 'Closed' : 'Open'}
                    </p>
                  </div>

                  <label className="small muted" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={row.is_closed}
                      onChange={(e) => updateRow(index, 'is_closed', e.target.checked)}
                    />
                    Closed
                  </label>

                  <label className="small muted">
                    Start
                    <input
                      type="time"
                      value={row.start_time}
                      disabled={row.is_closed}
                      onChange={(e) => updateRow(index, 'start_time', e.target.value)}
                      style={{ marginTop: '0.25rem' }}
                    />
                  </label>

                  <label className="small muted">
                    End
                    <input
                      type="time"
                      value={row.end_time}
                      disabled={row.is_closed}
                      onChange={(e) => updateRow(index, 'end_time', e.target.value)}
                      style={{ marginTop: '0.25rem' }}
                    />
                  </label>
                </div>
              )
            })}
          </div>

          <div className="availability-save-actions">
            <button
              onClick={saveAvailability}
              disabled={loading}
              className="btn btn-accent"
            >
              {loading ? 'Saving...' : 'Save working hours'}
            </button>

            <Link href={`/dashboard/businesses`} className="btn btn-ghost">
              Back to setup hub
            </Link>
          </div>
        </>
      )}
<style jsx>{`
  .availability-day-list {
    display: grid;
    gap: 0.75rem;
  }

  .availability-day-row {
    display: grid;
    grid-template-columns: 1.2fr 1fr 1fr 1fr;
    gap: 0.75rem;
    align-items: center;
  }

  .availability-save-actions {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
    margin-top: 1.25rem;
  }

  @media (max-width: 760px) {
    .availability-day-row {
      grid-template-columns: 1fr;
    }

    .availability-save-actions,
    .availability-save-actions :global(.btn),
    .availability-save-actions button,
    .availability-save-actions a {
      width: 100%;
      justify-content: center;
    }
  }
`}</style>
    </DashboardLayout>
  )
}