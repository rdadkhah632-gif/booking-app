import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import AuthNav from '@/components/AuthNav'
import { supabase } from '@/lib/supabaseClient'
import { useI18n } from '@/lib/useI18n'

type StaffMember = {
  id: string
  business_id: string
  user_id?: string | null
  name: string
  role_title?: string | null
  email?: string | null
  phone?: string | null
  image_url?: string | null
  invite_status?: string | null
  permission_role?: string | null
  active: boolean
  businesses?: {
    name: string
    city?: string | null
    category?: string | null
  } | {
    name: string
    city?: string | null
    category?: string | null
  }[] | null
}

type StaffAvailability = {
  id?: string
  staff_member_id: string
  business_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_closed: boolean
}

type Booking = {
  id: string
  customer_name: string
  start_at: string
  end_at?: string | null
  duration_minutes: number
  status: string
  services?: {
    name: string
  } | {
    name: string
  }[] | null
}

const DAY_LABELS = [
  { day: 0, label: 'Sunday', short: 'Sun' },
  { day: 1, label: 'Monday', short: 'Mon' },
  { day: 2, label: 'Tuesday', short: 'Tue' },
  { day: 3, label: 'Wednesday', short: 'Wed' },
  { day: 4, label: 'Thursday', short: 'Thu' },
  { day: 5, label: 'Friday', short: 'Fri' },
  { day: 6, label: 'Saturday', short: 'Sat' }
]

function defaultAvailabilityRow(staff: StaffMember, day: number): StaffAvailability {
  const isWeekend = day === 0

  return {
    staff_member_id: staff.id,
    business_id: staff.business_id,
    day_of_week: day,
    start_time: '09:00',
    end_time: '17:00',
    is_closed: isWeekend
  }
}

function businessName(staff: StaffMember | null, fallback = 'Your business') {
  if (!staff?.businesses) return fallback
  return Array.isArray(staff.businesses)
    ? staff.businesses[0]?.name || fallback
    : staff.businesses.name || fallback
}

function serviceName(booking: Booking, fallback = 'Service') {
  if (!booking.services) return fallback
  return Array.isArray(booking.services)
    ? booking.services[0]?.name || fallback
    : booking.services.name || fallback
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000)
}

function formatTimeRange(booking: Booking) {
  const start = new Date(booking.start_at)
  const end = booking.end_at
    ? new Date(booking.end_at)
    : addMinutes(start, booking.duration_minutes)

  return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export default function StaffAvailabilityPage() {
  const router = useRouter()
  const { t } = useI18n()

  const [staffProfile, setStaffProfile] = useState<StaffMember | null>(null)
  const [availability, setAvailability] = useState<StaffAvailability[]>([])
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function loadPage() {
    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login?redirectTo=/staff/availability')
        return
      }

      const userEmail = session.user.email?.trim().toLowerCase() || ''

      let { data: linkedStaff, error: staffError } = await supabase
        .from('staff_members')
        .select(`
          id,
          business_id,
          user_id,
          name,
          role_title,
          email,
          phone,
          image_url,
          invite_status,
          permission_role,
          active,
          businesses (
            name,
            city,
            category
          )
        `)
        .eq('user_id', session.user.id)
        .limit(1)
        .maybeSingle()

      if (staffError) throw staffError

      if (!linkedStaff && userEmail) {
        const { data: inviteMatch, error: inviteError } = await supabase
          .from('staff_members')
          .select(`
            id,
            business_id,
            user_id,
            name,
            role_title,
            email,
            phone,
            image_url,
            invite_status,
            permission_role,
            active,
            businesses (
              name,
              city,
              category
            )
          `)
          .eq('email', userEmail)
          .is('user_id', null)
          .limit(1)
          .maybeSingle()

        if (inviteError) throw inviteError

        if (inviteMatch?.id) {
          const { error: linkError } = await supabase
            .from('staff_members')
            .update({
              user_id: session.user.id,
              invite_status: 'linked'
            })
            .eq('id', inviteMatch.id)

          if (linkError) throw linkError

          linkedStaff = {
            ...inviteMatch,
            user_id: session.user.id,
            invite_status: 'linked'
          }
        }
      }

      if (!linkedStaff) {
        setStaffProfile(null)
        setAvailability([])
        setUpcomingBookings([])
        setLoading(false)
        return
      }

      const normalisedStaff = linkedStaff as unknown as StaffMember
      setStaffProfile(normalisedStaff)

      const { data: availabilityData, error: availabilityError } = await supabase
        .from('staff_availability')
        .select('id, staff_member_id, business_id, day_of_week, start_time, end_time, is_closed')
        .eq('staff_member_id', normalisedStaff.id)
        .order('day_of_week', { ascending: true })

      if (availabilityError) throw availabilityError

      const existingRows = (availabilityData || []) as StaffAvailability[]
      const mergedRows = DAY_LABELS.map(({ day }) => {
        const existing = existingRows.find((row) => row.day_of_week === day)
        return existing || defaultAvailabilityRow(normalisedStaff, day)
      })

      setAvailability(mergedRows)

      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          id,
          customer_name,
          start_at,
          end_at,
          duration_minutes,
          status,
          services (
            name
          )
        `)
        .eq('staff_member_id', normalisedStaff.id)
        .in('status', ['pending', 'confirmed'])
        .gte('start_at', new Date().toISOString())
        .order('start_at', { ascending: true })
        .limit(8)

      if (bookingError) throw bookingError

      setUpcomingBookings((bookingData || []) as unknown as Booking[])
      setLoading(false)
    } catch (err: any) {
      setError(err.message || t('staffAvailability.error.load', 'Could not load staff availability.'))
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!router.isReady) return
    loadPage()
  }, [router.isReady])

  const openDays = useMemo(() => {
    return availability.filter((row) => !row.is_closed).length
  }, [availability])

  const closedDays = useMemo(() => {
    return availability.filter((row) => row.is_closed).length
  }, [availability])
  const totalWeeklyHours = useMemo(() => {
    return availability.reduce((total, row) => {
      if (row.is_closed) return total

      const start = new Date(`2026-01-01T${row.start_time}`)
      const end = new Date(`2026-01-01T${row.end_time}`)

      if (end <= start) return total

      return total + ((end.getTime() - start.getTime()) / 3600000)
    }, 0)
  }, [availability])

  function updateAvailabilityRow(day: number, field: keyof StaffAvailability, value: string | boolean) {
    setAvailability((current) =>
      current.map((row) =>
        row.day_of_week === day
          ? { ...row, [field]: value }
          : row
      )
    )
  }

  function applyWeekdayTemplate() {
    setAvailability((current) =>
      current.map((row) => {
        if (row.day_of_week >= 1 && row.day_of_week <= 5) {
          return {
            ...row,
            start_time: '09:00',
            end_time: '17:00',
            is_closed: false
          }
        }

        return {
          ...row,
          is_closed: true
        }
      })
    )
  }

  function applyExtendedTemplate() {
    setAvailability((current) =>
      current.map((row) => {
        if (row.day_of_week >= 1 && row.day_of_week <= 6) {
          return {
            ...row,
            start_time: '09:00',
            end_time: '19:00',
            is_closed: false
          }
        }

        return {
          ...row,
          is_closed: true
        }
      })
    )
  }

  async function saveAvailability() {
    if (!staffProfile) return

    const invalidRow = availability.find((row) => {
      if (row.is_closed) return false
      return !row.start_time || !row.end_time || row.end_time <= row.start_time
    })

    if (invalidRow) {
      setError(t('staffAvailability.error.invalidTime', 'Each open day needs a valid start and end time. End time must be after start time.'))
      setSuccess(null)
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    const rowsToSave = availability.map((row) => ({
      staff_member_id: staffProfile.id,
      business_id: staffProfile.business_id,
      day_of_week: row.day_of_week,
      start_time: row.start_time,
      end_time: row.end_time,
      is_closed: row.is_closed
    }))

    const { error } = await supabase
      .from('staff_availability')
      .upsert(rowsToSave, {
        onConflict: 'staff_member_id,day_of_week'
      })

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess(t('staffAvailability.success.saved', 'Availability saved. Mirëbook will use these staff hours when customers book with you.'))
    await loadPage()
  }

  if (loading) {
    return (
      <main>
        <AuthNav />
        <section className="container" style={{ paddingTop: 40 }}>
          <div className="card">
            <p className="muted">{t('staffAvailability.loading', 'Loading your Mirëbook availability...')}</p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
        {!staffProfile && (
          <div className="card">
            <p className="small" style={{ color: 'var(--warning)' }}>{t('staff.noProfile.kicker', 'No staff profile linked')}</p>
            <h1 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
              {t('staffAvailability.noProfile.title', 'Staff availability is not available yet')}
            </h1>
            <p className="muted" style={{ marginTop: '0.75rem' }}>
              {t('staffAvailability.noProfile.body', 'Ask the business owner to add your email in their Staff setup page, then log in again. Staff accounts can manage their own schedule and availability, but business profile, services and pricing stay with the business owner.')}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              <Link href="/staff" className="btn btn-accent">
                {t('staff.actions.backToDashboard', 'Back to staff dashboard')}
              </Link>
              <Link href="/account" className="btn btn-ghost">
                {t('account.title', 'Account settings')}
              </Link>
              <Link href="/support/staff" className="btn btn-ghost">
                {t('nav.staffSupport', 'Staff support')}
              </Link>
            </div>
          </div>
        )}

        {staffProfile && (
          <>
            <div className="staff-availability-hero card">
              <div>
                <p className="small" style={{ color: 'var(--accent)', marginBottom: '0.35rem' }}>
                  {t('staffAvailability.kicker', 'Staff availability')}
                </p>
                <h1 className="page-title">
                  {t('staffAvailability.title', 'Your working hours')}
                </h1>
                <p className="page-sub" style={{ marginTop: '0.5rem' }}>
                  {staffProfile.name} · {businessName(staffProfile, t('staff.fallback.business', 'Your business'))} · {t('staffAvailability.staffOnly', 'Staff-only availability')}
                </p>
              </div>

              <div className="staff-availability-actions">
                <Link href="/staff" className="btn btn-ghost">
                  {t('staff.actions.dashboard', 'Staff dashboard')}
                </Link>
                <Link href="/staff/calendar" className="btn btn-ghost">
                  {t('staffCalendar.title', 'Calendar view')}
                </Link>
                <button type="button" className="btn btn-accent" onClick={saveAvailability} disabled={saving}>
                  {saving ? t('common.saving', 'Saving...') : t('staffAvailability.actions.saveAvailability', 'Save availability')}
                </button>
              </div>
            </div>
            <div className="card staff-availability-note">
              <p className="small muted">{t('staff.workspace.kicker', 'Staff workspace')}</p>
              <h3>{t('staffAvailability.note.title', 'These hours only control your own bookable staff availability.')}</h3>
              <p className="muted small" style={{ marginTop: '0.45rem' }}>
                {t('staffAvailability.note.body', 'Customers can only book you when the business is published, the service is active, the service is assigned to you, and both business and staff availability allow the selected time. Existing bookings are not moved automatically when you change these hours.')}
              </p>
            </div>
            {error && (
              <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)', marginBottom: '1rem' }}>
                <p style={{ color: 'var(--danger)' }}>{error}</p>
              </div>
            )}

            {success && (
              <div className="card" style={{ borderColor: 'rgba(45,212,191,0.35)', background: 'rgba(45,212,191,0.06)', marginBottom: '1rem' }}>
                <p style={{ color: 'var(--success)' }}>{success}</p>
              </div>
            )}

            <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
              <div className="card">
                <p className="small muted">{t('staffAvailability.summary.openDays', 'Open days')}</p>
                <h3>{openDays}</h3>
                <p className="small muted">{t('staffAvailability.summary.openDaysBody', 'Days customers can book you if assigned services are active')}</p>
              </div>

              <div className="card">
                <p className="small muted">{t('staffAvailability.summary.closedDays', 'Closed days')}</p>
                <h3>{closedDays}</h3>
                <p className="small muted">{t('staffAvailability.summary.closedDaysBody', 'Days hidden from booking')}</p>
              </div>

              <div className="card">
                <p className="small muted">{t('staffAvailability.summary.weeklyHours', 'Weekly hours')}</p>
                <h3>{totalWeeklyHours.toFixed(1)}</h3>
                <p className="small muted">{t('staffAvailability.summary.weeklyHoursBody', 'Estimated weekly staff availability')}</p>
              </div>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="staff-template-header">
                <div>
                  <p className="small muted">{t('staffAvailability.templates.kicker', 'Quick templates')}</p>
                  <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                    {t('staffAvailability.templates.title', 'Start with a common schedule')}
                  </h2>
                  <p className="muted small" style={{ marginTop: '0.35rem' }}>
                    {t('staffAvailability.templates.body', 'Templates only update the form. Press Save availability to apply changes.')}
                  </p>
                </div>

                <div className="staff-template-actions">
                  <button type="button" className="btn btn-ghost" onClick={applyWeekdayTemplate}>
                    {t('staffAvailability.templates.weekday', 'Mon-Fri 9-5')}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={applyExtendedTemplate}>
                    {t('staffAvailability.templates.extended', 'Mon-Sat 9-7')}
                  </button>
                  <button type="button" className="btn btn-accent" onClick={saveAvailability} disabled={saving}>
                    {saving ? t('common.saving', 'Saving...') : t('common.saveChanges', 'Save changes')}
                  </button>
                </div>
              </div>
            </div>

            <div className="staff-availability-grid">
              {DAY_LABELS.map((day) => {
                const row = availability.find((item) => item.day_of_week === day.day) || defaultAvailabilityRow(staffProfile, day.day)

                return (
                  <div key={day.day} className="card staff-day-card">
                    <div className="staff-day-card-header">
                      <div>
                        <p className="small muted">{day.short}</p>
                        <h3>{day.label}</h3>
                      </div>

                      <label className="staff-toggle-row">
                        <input
                          type="checkbox"
                          checked={!row.is_closed}
                          onChange={(e) => updateAvailabilityRow(day.day, 'is_closed', !e.target.checked)}
                        />
                        <span>{row.is_closed ? t('staffAvailability.day.closed', 'Closed') : t('staffAvailability.day.open', 'Open')}</span>
                      </label>
                    </div>

                    {!row.is_closed ? (
                      <div className="staff-time-grid">
                        <label className="small muted">
                          {t('staffAvailability.day.start', 'Start')}
                          <input
                            type="time"
                            value={row.start_time}
                            onChange={(e) => updateAvailabilityRow(day.day, 'start_time', e.target.value)}
                            style={{ marginTop: '0.35rem' }}
                          />
                        </label>

                        <label className="small muted">
                          {t('staffAvailability.day.end', 'End')}
                          <input
                            type="time"
                            value={row.end_time}
                            onChange={(e) => updateAvailabilityRow(day.day, 'end_time', e.target.value)}
                            style={{ marginTop: '0.35rem' }}
                          />
                        </label>
                      </div>
                    ) : (
                      <p className="muted small" style={{ marginTop: '0.85rem' }}>
                        {t('staffAvailability.day.closedBody', 'Customers cannot book you on this day unless the business reschedules an existing appointment manually.')}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="card" style={{ marginTop: '1.5rem' }}>
              <div className="staff-template-header">
                <div>
                  <p className="small muted">{t('staffAvailability.upcoming.kicker', 'Upcoming assigned bookings')}</p>
                  <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                    {t('staffAvailability.upcoming.title', 'Check existing appointments before changing hours')}
                  </h2>
                  <p className="muted small" style={{ marginTop: '0.35rem' }}>
                    {t('staffAvailability.upcoming.body', 'Changing your availability affects new booking slots. Existing bookings stay in place unless the business reschedules them.')}
                  </p>
                </div>

                <div className="staff-template-actions">
                  <Link href="/staff" className="btn btn-ghost">
                    {t('staffAvailability.upcoming.viewSchedule', 'View schedule')}
                  </Link>
                  <Link href="/staff/calendar" className="btn btn-ghost">
                    {t('staffCalendar.title', 'Calendar view')}
                  </Link>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
                {upcomingBookings.length === 0 && (
                  <p className="muted">{t('staffAvailability.upcoming.empty', 'No upcoming assigned bookings found. If you expected appointments here, ask the business owner to check staff assignment for each service.')}</p>
                )}

                {upcomingBookings.map((booking) => (
                  <div key={booking.id} className="card" style={{ background: 'var(--surface-2)' }}>
                    <strong>{booking.customer_name}</strong>
                    <p className="small muted" style={{ marginTop: '0.25rem' }}>
                      {serviceName(booking, t('common.service', 'Service'))} · {new Date(booking.start_at).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} · {formatTimeRange(booking)}
                    </p>
                    <p className="small muted">{t('common.status', 'Status')}: {booking.status}</p>
                    {booking.status === 'pending' && (
                      <p className="small muted" style={{ marginTop: '0.25rem' }}>
                        {t('staffAvailability.upcoming.pendingBody', 'Pending bookings are shown for awareness. Business owners or managers approve them from the business dashboard.')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      <style jsx>{`
        .staff-availability-hero {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
          margin-bottom: 1.5rem;
        }

        .staff-availability-actions,
        .staff-template-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .staff-availability-note {
          margin-bottom: 1.5rem;
          border-color: rgba(255,107,53,0.22);
          background: rgba(255,107,53,0.06);
        }


        .staff-template-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .staff-availability-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 1rem;
        }

        .staff-day-card {
          display: grid;
          gap: 0.9rem;
        }

        .staff-day-card-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
        }

        .staff-toggle-row {
          display: inline-flex;
          gap: 0.45rem;
          align-items: center;
          color: var(--text-muted);
          font-size: 0.9rem;
        }

        .staff-time-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        @media (max-width: 620px) {
          .staff-availability-hero,
          .staff-template-header,
          .staff-day-card-header {
            display: grid;
          }

          .staff-availability-actions,
          .staff-template-actions {
            display: grid;
          }

          .staff-availability-actions,
          .staff-template-actions,
          .staff-availability-actions :global(.btn),
          .staff-template-actions :global(.btn) {
            width: 100%;
            justify-content: center;
          }

          .staff-time-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  )
}