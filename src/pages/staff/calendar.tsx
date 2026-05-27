import AuthNav from '@/components/AuthNav'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useI18n } from '@/lib/useI18n'

type StaffProfile = {
  id: string
  business_id: string
  name: string
}

type Booking = {
  id: string
  customer_name: string
  customer_email?: string | null
  customer_phone?: string | null
  start_at: string
  end_at?: string | null
  duration_minutes: number
  status: string
  services?: { name: string } | { name: string }[] | null
}

function formatDateInputValue(date: Date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function serviceName(booking: Booking, fallback: string) {
  if (!booking.services) return fallback
  return Array.isArray(booking.services)
    ? booking.services[0]?.name || fallback
    : booking.services.name || fallback
}

function statusColor(status: string) {
  if (status === 'pending') return 'var(--accent)'
  if (status === 'confirmed') return 'var(--success)'
  if (status === 'completed') return 'var(--success)'
  if (status === 'cancelled') return 'var(--warning)'
  return 'var(--text-muted)'
}

export default function StaffCalendarPage() {
  const { t } = useI18n()

  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [selectedDate, setSelectedDate] = useState(formatDateInputValue(new Date()))
  const [monthCursor, setMonthCursor] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadCalendar()
  }, [])

  async function loadCalendar() {
    setLoading(true)
    setError(null)

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      window.location.href = '/login?redirectTo=/staff/calendar'
      return
    }

    const { data: staffData, error: staffError } = await supabase
      .from('staff_members')
      .select('id, business_id, name')
      .eq('user_id', session.user.id)
      .limit(1)
      .maybeSingle()

    if (staffError || !staffData) {
      setError(staffError?.message || t('staff.noProfile.kicker', 'No staff profile linked'))
      setLoading(false)
      return
    }

    setStaffProfile(staffData)

    const from = startOfMonth(addDays(monthCursor, -7)).toISOString()
    const to = endOfMonth(addDays(monthCursor, 35)).toISOString()

    const { data: bookingData, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        customer_name,
        customer_email,
        customer_phone,
        start_at,
        end_at,
        duration_minutes,
        status,
        services (
          name
        )
      `)
      .eq('staff_member_id', staffData.id)
      .gte('start_at', from)
      .lte('start_at', to)
      .order('start_at', { ascending: true })

    if (bookingError) {
      setError(bookingError.message)
      setLoading(false)
      return
    }

    setBookings((bookingData || []) as unknown as Booking[])
    setLoading(false)
  }

  useEffect(() => {
    if (!staffProfile) return
    loadCalendar()
  }, [monthCursor])

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(monthCursor)
    const firstDayOffset = monthStart.getDay()
    const gridStart = addDays(monthStart, -firstDayOffset)

    return Array.from({ length: 42 }, (_, index) => {
      const date = addDays(gridStart, index)
      const dateString = formatDateInputValue(date)
      const dayBookings = bookings.filter((booking) => {
        return formatDateInputValue(new Date(booking.start_at)) === dateString
      })

      return {
        date,
        dateString,
        isCurrentMonth: date.getMonth() === monthCursor.getMonth(),
        isToday: dateString === formatDateInputValue(new Date()),
        bookings: dayBookings
      }
    })
  }, [bookings, monthCursor])

  const selectedBookings = useMemo(() => {
    return bookings.filter((booking) => {
      return formatDateInputValue(new Date(booking.start_at)) === selectedDate
    })
  }, [bookings, selectedDate])

  const monthTitle = monthCursor.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric'
  })

  function statusLabel(status: string) {
    if (status === 'pending') return t('staff.status.pending', 'Pending approval')
    if (status === 'confirmed') return t('staff.status.confirmed', 'Confirmed')
    if (status === 'completed') return t('staff.status.completed', 'Completed')
    if (status === 'cancelled') return t('staff.status.cancelled', 'Cancelled')
    return status
  }

  return (
    <main>
      <AuthNav />

      <section className="page-shell">
        <div className="page-header-row" style={{ marginBottom: '1.5rem' }}>
          <div>
            <p className="small muted">{t('staffCalendar.kicker', 'Staff calendar')}</p>
            <h1 className="page-title">{t('staffCalendar.title', 'Calendar view')}</h1>
            <p className="page-sub" style={{ marginTop: '0.5rem' }}>
              {t('staffCalendar.body', 'Look ahead across your assigned bookings and plan your working days.')}
            </p>
          </div>

          <div className="page-header-actions">
            <Link href="/staff" className="btn btn-ghost">
              {t('staff.schedule.title', 'My schedule')}
            </Link>
            <Link href="/staff/availability" className="btn btn-accent">
              {t('staff.actions.updateAvailability', 'Update availability')}
            </Link>
          </div>
        </div>

        {loading && (
          <div className="card">
            <p className="muted">{t('staffCalendar.loading', 'Loading staff calendar...')}</p>
          </div>
        )}

        {error && (
          <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)' }}>
            <p style={{ color: 'var(--danger)' }}>{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="card staff-calendar-toolbar">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}
              >
                {t('staffCalendar.previousMonth', 'Previous')}
              </button>

              <div>
                <p className="small muted">{t('staffCalendar.month', 'Month')}</p>
                <strong>{monthTitle}</strong>
              </div>

              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}
              >
                {t('staffCalendar.nextMonth', 'Next')}
              </button>
            </div>

            <div className="staff-calendar-grid">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="staff-calendar-day-name">
                  {day}
                </div>
              ))}

              {calendarDays.map((day) => (
                <button
                  key={day.dateString}
                  type="button"
                  className={[
                    'staff-calendar-day',
                    day.isCurrentMonth ? '' : 'staff-calendar-muted',
                    day.isToday ? 'staff-calendar-today' : '',
                    selectedDate === day.dateString ? 'staff-calendar-selected' : ''
                  ].join(' ')}
                  onClick={() => setSelectedDate(day.dateString)}
                >
                  <strong>{day.date.getDate()}</strong>
                  {day.bookings.length > 0 && (
                    <span>
                      {day.bookings.length} {day.bookings.length === 1 ? t('staffCalendar.bookingSingle', 'booking') : t('staffCalendar.bookingPlural', 'bookings')}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="card staff-selected-day">
              <div>
                <p className="small muted">{t('staffCalendar.selectedDay', 'Selected day')}</p>
                <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                  {new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </h2>
              </div>

              {selectedBookings.length === 0 ? (
                <p className="muted" style={{ marginTop: '1rem' }}>
                  {t('staffCalendar.emptyDay', 'No assigned bookings for this date.')}
                </p>
              ) : (
                <div className="staff-selected-bookings">
                  {selectedBookings.map((booking) => {
                    const start = new Date(booking.start_at)
                    const end = booking.end_at
                      ? new Date(booking.end_at)
                      : new Date(start.getTime() + booking.duration_minutes * 60000)

                    return (
                      <div key={booking.id} className="card staff-calendar-booking">
                        <div>
                          <strong>{booking.customer_name || t('common.customer', 'Customer')}</strong>
                          <p className="small muted" style={{ marginTop: '0.25rem' }}>
                            {serviceName(booking, t('common.service', 'Service'))} · {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="small" style={{ color: statusColor(booking.status), marginTop: '0.25rem' }}>
                            {statusLabel(booking.status)}
                          </p>
                        </div>

                        <div className="staff-calendar-booking-actions">
                          {booking.customer_email && (
                            <a href={`mailto:${booking.customer_email}`} className="btn btn-ghost">
                              {t('staff.booking.emailCustomer', 'Email customer')}
                            </a>
                          )}
                          {!booking.customer_email && booking.customer_phone && (
                            <a href={`tel:${booking.customer_phone}`} className="btn btn-ghost">
                              {t('staff.booking.callCustomer', 'Call customer')}
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <style jsx>{`
        .staff-calendar-toolbar {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          margin-bottom: 1rem;
        }

        .staff-calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }

        .staff-calendar-day-name {
          color: var(--text-muted);
          font-size: 0.8rem;
          text-align: center;
          padding: 0.35rem;
        }

        .staff-calendar-day {
          min-height: 5.75rem;
          border: 1px solid var(--border);
          border-radius: 1rem;
          background: var(--surface);
          color: var(--text);
          text-align: left;
          padding: 0.75rem;
          display: grid;
          align-content: start;
          gap: 0.35rem;
          cursor: pointer;
        }

        .staff-calendar-day span {
          color: var(--accent);
          font-size: 0.78rem;
        }

        .staff-calendar-muted {
          opacity: 0.45;
        }

        .staff-calendar-today {
          border-color: rgba(255,107,53,0.45);
        }

        .staff-calendar-selected {
          background: rgba(255,107,53,0.1);
          border-color: rgba(255,107,53,0.65);
        }

        .staff-selected-bookings {
          display: grid;
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .staff-calendar-booking {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          background: var(--surface-2);
        }

        .staff-calendar-booking-actions {
          display: flex;
          gap: 0.6rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        @media (max-width: 760px) {
          .staff-calendar-toolbar,
          .staff-calendar-booking {
            display: grid;
          }

          .staff-calendar-grid {
            gap: 0.35rem;
          }

          .staff-calendar-day {
            min-height: 4.6rem;
            padding: 0.55rem;
            border-radius: 0.75rem;
          }

          .staff-calendar-day span {
            font-size: 0.68rem;
          }

          .staff-calendar-booking-actions,
          .staff-calendar-booking-actions :global(.btn),
          .staff-calendar-booking-actions a {
            width: 100%;
          }
        }
      `}</style>
    </main>
  )
}