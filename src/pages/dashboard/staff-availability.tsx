import { useEffect, useState } from 'react'
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
  businesses?: {
    id: string
    name: string
    user_id: string
  } | null
}

export default function StaffAvailabilityPage() {
  const router = useRouter()
  const { staffId } = router.query

  const [staff, setStaff] = useState<StaffMember | null>(null)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadPage() {
    setLoading(true)
    setError(null)

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
      setRows(existing)
    } else {
      setRows(days.map((_, i) => ({
        staff_member_id: staffId,
        day_of_week: i,
        start_time: '09:00',
        end_time: '17:00',
        is_closed: i === 0
      })))
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!router.isReady) return
    loadPage()
  }, [router.isReady, staffId])

  function updateRow(index: number, field: string, value: any) {
    setRows((prev) =>
      prev.map((row, i) => i === index ? { ...row, [field]: value } : row)
    )
  }

  async function saveAvailability() {
    if (!staff || !staffId || Array.isArray(staffId)) return

    setSaving(true)
    setError(null)

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

    alert('Staff working hours saved')
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

      {error && (
        <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)', marginBottom: '1rem' }}>
          <p style={{ color: 'var(--danger)' }}>{error}</p>
        </div>
      )}

      {!loading && staff && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <p className="small muted">Staff member</p>
            <h3>{staff.name}</h3>
            <p className="small muted">
              {staff.role_title || 'Staff member'} · {staff.businesses?.name || 'Business'}
            </p>

            <Link
              href={`/dashboard/staff?businessId=${staff.business_id}`}
              className="btn btn-ghost"
              style={{ marginTop: '1rem' }}
            >
              Back to staff
            </Link>
          </div>

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
            disabled={saving}
            className="btn btn-accent"
            style={{ marginTop: '1.25rem' }}
          >
            {saving ? 'Saving...' : 'Save staff working hours'}
          </button>
        </>
      )}
    </DashboardLayout>
  )
}