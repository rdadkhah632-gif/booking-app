import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import DashboardLayout from '@/components/DashboardLayout'

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type StaffMember = {
  id: string
  name: string
  role_title?: string | null
  business_id: string
  active?: boolean
  businesses?: {
    id: string
    name: string
    user_id: string
  } | null
}

type StaffAvailabilityRow = {
  id?: string
  staff_member_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_closed: boolean
}

export default function StaffAvailabilityPage() {
  const router = useRouter()
  const { staffId } = router.query

  const [staff, setStaff] = useState<StaffMember | null>(null)
  const [rows, setRows] = useState<StaffAvailabilityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function defaultRows(currentStaffId: string): StaffAvailabilityRow[] {
    return days.map((_, i) => ({
      staff_member_id: currentStaffId,
      day_of_week: i,
      start_time: '09:00',
      end_time: '17:00',
      is_closed: i === 0
    }))
  }

  async function loadPage() {
    setLoading(true)
    setError(null)
    setSuccess(null)

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      router.replace('/login')
      return
    }

    if (!staffId || Array.isArray(staffId)) {
      setError('Missing staff member reference.')
      setLoading(false)
      return
    }

    const { data: staffData, error: staffError } = await supabase
      .from('staff_members')
      .select(`
        id,
        name,
        role_title,
        business_id,
        active,
        businesses (
          id,
          name,
          user_id
        )
      `)
      .eq('id', staffId)
      .single()

    if (staffError || !staffData) {
      setError(staffError?.message || 'Staff member not found.')
      setLoading(false)
      return
    }

    const linkedBusiness = Array.isArray(staffData.businesses)
      ? staffData.businesses[0]
      : staffData.businesses

    if (linkedBusiness?.user_id !== session.user.id) {
      setError('You do not have access to manage this staff member.')
      setLoading(false)
      return
    }

    setStaff({
      ...staffData,
      businesses: linkedBusiness
    })

    const { data: existing, error: availabilityError } = await supabase
      .from('staff_availability')
      .select('*')
      .eq('staff_member_id', staffId)
      .order('day_of_week')

    if (availabilityError) {
      setError(availabilityError.message)
      setLoading(false)
      return
    }

    if (existing && existing.length > 0) {
      const existingByDay = new Map<number, StaffAvailabilityRow>()
      existing.forEach((row: StaffAvailabilityRow) => existingByDay.set(row.day_of_week, row))

      setRows(
        days.map((_, i) =>
          existingByDay.get(i) || {
            staff_member_id: staffId,
            day_of_week: i,
            start_time: '09:00',
            end_time: '17:00',
            is_closed: i === 0
          }
        )
      )
    } else {
      setRows(defaultRows(staffId))
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!router.isReady) return
    loadPage()
  }, [router.isReady, staffId])

  const availabilityStats = useMemo(() => {
    const openRows = rows.filter((row) => !row.is_closed)
    const closedRows = rows.filter((row) => row.is_closed)
    const invalidRows = openRows.filter((row) => row.start_time >= row.end_time)

    return {
      openDays: openRows.length,
      closedDays: closedRows.length,
      invalidDays: invalidRows.length,
      ready: openRows.length > 0 && invalidRows.length === 0
    }
  }, [rows])

  function updateRow(index: number, field: keyof StaffAvailabilityRow, value: string | boolean) {
    setRows((prev) =>
      prev.map((row, i) => i === index ? { ...row, [field]: value } : row)
    )
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

  function applyEverydayPreset() {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        start_time: '09:00',
        end_time: '17:00',
        is_closed: false
      }))
    )
  }

  function closeAllDays() {
    const confirmed = confirm('Close every day for this staff member? Customers will not see this staff member as available until you reopen days.')
    if (!confirmed) return

    setRows((prev) => prev.map((row) => ({ ...row, is_closed: true })))
  }

  async function saveAvailability() {
    if (!staff || !staffId || Array.isArray(staffId)) return

    const invalidRow = rows.find((row) => !row.is_closed && row.start_time >= row.end_time)

    if (invalidRow) {
      setError(`${days[invalidRow.day_of_week]} has an invalid time range. Start time must be before end time.`)
      return
    }

    if (availabilityStats.openDays === 0) {
      const confirmed = confirm('This staff member has no open days. They will not appear as available for bookings. Save anyway?')
      if (!confirmed) return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    const { error: deleteError } = await supabase
      .from('staff_availability')
      .delete()
      .eq('staff_member_id', staffId)

    if (deleteError) {
      setError(deleteError.message)
      setSaving(false)
      return
    }

    const cleanRows = rows.map((row) => ({
      staff_member_id: staffId,
      day_of_week: row.day_of_week,
      start_time: row.start_time,
      end_time: row.end_time,
      is_closed: row.is_closed
    }))

    const { error } = await supabase
      .from('staff_availability')
      .insert(cleanRows)

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess('Staff working hours saved. Customer availability will use these hours straight away.')
    await loadPage()
  }

  return (
    <DashboardLayout
      title="Staff working hours"
      subtitle={staff ? `Set availability for ${staff.name}` : 'Set staff availability.'}
    >
      {loading && (
        <div className="card">
          <p className="muted">Loading staff availability...</p>
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

      {!loading && staff && (
        <>
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <p className="small muted">Staff member</p>
                <h3>{staff.name}</h3>
                <p className="small muted" style={{ marginTop: '0.25rem' }}>
                  {staff.role_title || 'Staff member'} · {staff.businesses?.name || 'Business'}
                </p>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                  <span
                    className="small"
                    style={{
                      background: staff.active ? 'rgba(45,212,191,0.12)' : 'rgba(255,190,11,0.12)',
                      color: staff.active ? 'var(--success)' : 'var(--warning)',
                      padding: '0.2rem 0.55rem',
                      borderRadius: 999
                    }}
                  >
                    {staff.active ? 'Active staff member' : 'Hidden staff member'}
                  </span>

                  <span
                    className="small"
                    style={{
                      background: availabilityStats.ready ? 'rgba(45,212,191,0.12)' : 'rgba(255,190,11,0.12)',
                      color: availabilityStats.ready ? 'var(--success)' : 'var(--warning)',
                      padding: '0.2rem 0.55rem',
                      borderRadius: 999
                    }}
                  >
                    {availabilityStats.ready ? 'Hours ready' : 'Hours need attention'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Link href={`/dashboard/staff?businessId=${staff.business_id}`} className="btn btn-ghost">
                  Back to staff
                </Link>

                <Link href={`/dashboard/bookings?businessId=${staff.business_id}`} className="btn btn-ghost">
                  View bookings
                </Link>
              </div>
            </div>
          </div>

          <div className="grid-2" style={{ marginBottom: '1.25rem' }}>
            <div className="card">
              <p className="small muted">Open days</p>
              <h3>{availabilityStats.openDays}</h3>
              <p className="muted small">Days customers can book this staff member</p>
            </div>

            <div className="card">
              <p className="small muted">Closed days</p>
              <h3>{availabilityStats.closedDays}</h3>
              <p className="muted small">Days hidden from booking</p>
            </div>

            <div className="card" style={{ borderColor: availabilityStats.invalidDays > 0 ? 'rgba(255,77,109,0.35)' : 'var(--border)' }}>
              <p className="small muted">Invalid days</p>
              <h3>{availabilityStats.invalidDays}</h3>
              <p className="muted small">Open days where start time is not before end time</p>
            </div>

            <div className="card" style={{ borderColor: availabilityStats.ready ? 'rgba(45,212,191,0.25)' : 'rgba(255,190,11,0.35)' }}>
              <p className="small muted">Status</p>
              <h3>{availabilityStats.ready ? 'Ready' : 'Needs work'}</h3>
              <p className="muted small">Staff needs at least one valid open day to be bookable</p>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <p className="small muted">Quick presets</p>
                <h3>Set common working patterns</h3>
                <p className="small muted" style={{ marginTop: '0.35rem' }}>
                  These buttons update the table below. You still need to click Save staff working hours.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={applyWeekdayPreset} className="btn btn-ghost">
                  Mon-Fri 9-5
                </button>

                <button type="button" onClick={applyEverydayPreset} className="btn btn-ghost">
                  Every day 9-5
                </button>

                <button type="button" onClick={closeAllDays} className="btn btn-danger">
                  Close all days
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {rows.map((row, index) => {
              const invalid = !row.is_closed && row.start_time >= row.end_time

              return (
                <div
                  key={row.day_of_week}
                  className="card"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 1fr 1fr 1fr',
                    gap: '0.75rem',
                    alignItems: 'center',
                    borderColor: invalid ? 'rgba(255,77,109,0.35)' : row.is_closed ? 'rgba(255,190,11,0.20)' : 'var(--border)',
                    opacity: row.is_closed ? 0.76 : 1
                  }}
                >
                  <div>
                    <strong>{days[row.day_of_week]}</strong>
                    <p className="small" style={{ color: invalid ? 'var(--danger)' : row.is_closed ? 'var(--warning)' : 'var(--success)', marginTop: '0.25rem' }}>
                      {invalid ? 'Invalid time range' : row.is_closed ? 'Closed / day off' : 'Open for bookings'}
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

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '1.25rem' }}>
            <button
              onClick={saveAvailability}
              disabled={saving}
              className="btn btn-accent"
            >
              {saving ? 'Saving...' : 'Save staff working hours'}
            </button>

            <Link href={`/dashboard/staff?businessId=${staff.business_id}`} className="btn btn-ghost">
              Back to staff
            </Link>
          </div>
        </>
      )}
    </DashboardLayout>
  )
}