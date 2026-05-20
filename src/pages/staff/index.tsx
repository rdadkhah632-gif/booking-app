import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import AuthNav from '@/components/AuthNav'
import { supabase } from '@/lib/supabaseClient'


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

type Service = {
  id: string
  name: string
  duration_minutes?: number | null
  price?: number | null
  active?: boolean | null
}

type StaffService = {
  staff_member_id: string
  service_id: string
  services?: Service | Service[] | null
}

type Booking = {
  id: string
  business_id: string
  service_id?: string | null
  staff_member_id?: string | null
  customer_user_id?: string | null
  customer_name: string
  customer_email?: string | null
  customer_phone?: string | null
  customer_notes?: string | null
  internal_notes?: string | null
  start_at: string
  end_at?: string | null
  duration_minutes: number
  status: string
  services?: {
    name: string
    price?: number | null
  } | {
    name: string
    price?: number | null
  }[] | null
  businesses?: {
    name: string
  } | {
    name: string
  }[] | null
}

type BookingRequest = {
  id: string
  booking_id: string
  business_id: string
  request_type: string
  requested_by: string
  status: string
  current_start_at?: string | null
  requested_start_at?: string | null
  message?: string | null
  bookings?: {
    customer_name: string
    services?: {
      name: string
    } | {
      name: string
    }[] | null
  } | {
    customer_name: string
    services?: {
      name: string
    } | {
      name: string
    }[] | null
  }[] | null
}

function startOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function endOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(23, 59, 59, 999)
  return copy
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function formatDateInputValue(date: Date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function statusLabel(status: string) {
  if (status === 'pending') return 'Pending approval'
  if (status === 'confirmed') return 'Confirmed'
  if (status === 'completed') return 'Completed'
  if (status === 'cancelled') return 'Cancelled'
  return status
}

function statusColor(status: string) {
  if (status === 'pending') return 'var(--accent)'
  if (status === 'confirmed') return 'var(--success)'
  if (status === 'completed') return 'var(--success)'
  if (status === 'cancelled') return 'var(--warning)'
  return 'var(--text-muted)'
}

function statusBackground(status: string) {
  if (status === 'pending') return 'rgba(255,107,53,0.12)'
  if (status === 'confirmed') return 'rgba(45,212,191,0.12)'
  if (status === 'completed') return 'rgba(45,212,191,0.12)'
  if (status === 'cancelled') return 'rgba(255,190,11,0.12)'
  return 'var(--surface-2)'
}

function firstServiceName(booking: Booking) {
  return Array.isArray(booking.services)
    ? booking.services[0]?.name
    : booking.services?.name
}

function firstBusinessName(booking: Booking) {
  return Array.isArray(booking.businesses)
    ? booking.businesses[0]?.name
    : booking.businesses?.name
}

function firstRequestBooking(request: BookingRequest) {
  return Array.isArray(request.bookings)
    ? request.bookings[0]
    : request.bookings
}

function firstRequestServiceName(request: BookingRequest) {
  const requestBooking = firstRequestBooking(request)
  const services = requestBooking?.services

  return Array.isArray(services)
    ? services[0]?.name
    : services?.name
}

export default function StaffDashboardPage() {
  const router = useRouter()

  const [staffProfile, setStaffProfile] = useState<StaffMember | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [requests, setRequests] = useState<BookingRequest[]>([])
  const [assignedServices, setAssignedServices] = useState<Service[]>([])
  const [selectedDate, setSelectedDate] = useState(formatDateInputValue(new Date()))
  const [statusFilter, setStatusFilter] = useState('active')
  const [loading, setLoading] = useState(true)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function loadStaffDashboard() {
    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login?redirectTo=/staff')
        return
      }

      const userEmail = session.user.email?.trim().toLowerCase() || ''

      let { data: linkedStaff, error: linkedStaffError } = await supabase
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

      if (linkedStaffError) throw linkedStaffError

      if (!linkedStaff && userEmail) {
        const { data: inviteMatch, error: inviteMatchError } = await supabase
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

        if (inviteMatchError) throw inviteMatchError

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
        setBookings([])
        setRequests([])
        setAssignedServices([])
        setLoading(false)
        return
      }

      setStaffProfile(linkedStaff as unknown as StaffMember)

      const { data: assignedServiceData, error: assignedServiceError } = await supabase
        .from('staff_services')
        .select(`
          staff_member_id,
          service_id,
          services (
            id,
            name,
            duration_minutes,
            price,
            active
          )
        `)
        .eq('staff_member_id', linkedStaff.id)

      if (assignedServiceError) throw assignedServiceError

      const normalisedAssignedServices = (assignedServiceData || [])
        .map((row: any) => Array.isArray(row.services) ? row.services[0] : row.services)
        .filter(Boolean)

      setAssignedServices(normalisedAssignedServices as Service[])

      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          id,
          business_id,
          service_id,
          staff_member_id,
          customer_user_id,
          customer_name,
          customer_email,
          customer_phone,
          customer_notes,
          internal_notes,
          start_at,
          end_at,
          duration_minutes,
          status,
          services (
            name,
            price
          ),
          businesses (
            name
          )
        `)
        .eq('staff_member_id', linkedStaff.id)
        .order('start_at', { ascending: true })

      if (bookingError) throw bookingError

      setBookings((bookingData || []) as unknown as Booking[])

      const bookingIds = (bookingData || []).map((booking: any) => booking.id)

      if (bookingIds.length > 0) {
        const { data: requestData, error: requestError } = await supabase
          .from('booking_requests')
          .select(`
            id,
            booking_id,
            business_id,
            request_type,
            requested_by,
            status,
            current_start_at,
            requested_start_at,
            message,
            bookings (
              customer_name,
              services (
                name
              )
            )
          `)
          .in('booking_id', bookingIds)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })

        if (requestError) throw requestError

        setRequests((requestData || []) as unknown as BookingRequest[])
      } else {
        setRequests([])
      }

      setLoading(false)
    } catch (err: any) {
      setError(err.message || 'Could not load your staff dashboard.')
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!router.isReady) return
    loadStaffDashboard()
  }, [router.isReady])

  const now = new Date()

  const todayBookings = useMemo(() => {
    const start = startOfDay(new Date())
    const end = endOfDay(new Date())

    return bookings.filter((booking) => {
      const startAt = new Date(booking.start_at)
      return startAt >= start && startAt <= end
    })
  }, [bookings])

  const upcomingBookings = useMemo(() => {
    return bookings.filter((booking) =>
      ['pending', 'confirmed'].includes(booking.status) &&
      new Date(booking.start_at) >= now
    )
  }, [bookings, now])

  const completedBookings = useMemo(() => {
    return bookings.filter((booking) => booking.status === 'completed')
  }, [bookings])

  const selectedDateBookings = useMemo(() => {
    const selected = new Date(`${selectedDate}T12:00:00`)
    const start = startOfDay(selected)
    const end = endOfDay(selected)

    return bookings.filter((booking) => {
      const startAt = new Date(booking.start_at)
      const matchesDate = startAt >= start && startAt <= end

      if (!matchesDate) return false

      if (statusFilter === 'active') {
        return booking.status === 'pending' || booking.status === 'confirmed'
      }

      if (statusFilter === 'history') {
        return booking.status === 'completed' || booking.status === 'cancelled'
      }

      if (statusFilter === 'all') return true

      return booking.status === statusFilter
    })
  }, [bookings, selectedDate, statusFilter])

  const nextSevenDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(new Date(), index)
      const dateString = formatDateInputValue(date)
      const start = startOfDay(date)
      const end = endOfDay(date)

      const count = bookings.filter((booking) => {
        const startAt = new Date(booking.start_at)
        return startAt >= start && startAt <= end && ['pending', 'confirmed'].includes(booking.status)
      }).length

      return {
        date,
        dateString,
        label: index === 0
          ? 'Today'
          : index === 1
            ? 'Tomorrow'
            : date.toLocaleDateString(undefined, { weekday: 'short' }),
        subLabel: date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        count
      }
    })
  }, [bookings])
  async function createCustomerNotification(params: {
    booking: Booking
    type: string
    title: string
    message: string
    actionUrl: string
  }) {
    if (!params.booking.customer_user_id) return

    await supabase.from('notifications').insert({
      user_id: params.booking.customer_user_id,
      business_id: params.booking.business_id,
      booking_id: params.booking.id,
      audience: 'customer',
      type: params.type,
      title: params.title,
      message: params.message,
      action_url: params.actionUrl
    })
  }

  function appointmentDateTime(booking: Booking) {
    return new Date(booking.start_at).toLocaleString()
  }
  async function markBookingComplete(booking: Booking) {
    const confirmed = confirm('Mark this appointment as completed?')
    if (!confirmed) return

    setActionLoadingId(booking.id)
    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'completed' })
      .eq('id', booking.id)
      .eq('staff_member_id', staffProfile?.id || '')

    setActionLoadingId(null)

    if (error) {
      setError(error.message)
      return
    }
    await createCustomerNotification({
      booking,
      type: 'booking_completed',
      title: 'Appointment completed',
      message: `Your appointment for ${firstServiceName(booking) || 'your appointment'} on ${appointmentDateTime(booking)} has been marked as completed by staff.`,
      actionUrl: '/my-bookings'
    })
    setSuccess('Appointment marked as completed.')
    await loadStaffDashboard()
  }

  function renderBookingCard(booking: Booking) {
    const start = new Date(booking.start_at)
    const end = booking.end_at
      ? new Date(booking.end_at)
      : new Date(start.getTime() + booking.duration_minutes * 60000)

    const isWorking = actionLoadingId === booking.id
    const canComplete = booking.status === 'confirmed' && start <= new Date()

    return (
      <div key={booking.id} className="card staff-booking-card">
        <div className="staff-booking-card-inner">
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <h3>{booking.customer_name || 'Customer'}</h3>
              <span
                className="small"
                style={{
                  background: statusBackground(booking.status),
                  color: statusColor(booking.status),
                  padding: '0.2rem 0.55rem',
                  borderRadius: 999
                }}
              >
                {statusLabel(booking.status)}
              </span>
            </div>

            <p className="muted small" style={{ marginTop: '0.35rem' }}>
              {firstServiceName(booking) || 'Service'} · {booking.duration_minutes} minutes
            </p>

            <p className="small muted" style={{ marginTop: '0.35rem' }}>
              {start.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} · {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>

            {(booking.customer_email || booking.customer_phone) && (
              <p className="small muted" style={{ marginTop: '0.35rem' }}>
                {[booking.customer_email, booking.customer_phone].filter(Boolean).join(' · ')}
              </p>
            )}
            {(booking.customer_notes || booking.internal_notes) && (
              <div className="staff-notes-box">
                {booking.customer_notes && (
                  <>
                    <p className="small muted">Customer note</p>
                    <p className="small">{booking.customer_notes}</p>
                  </>
                )}

                {booking.internal_notes && (
                  <>
                    <p className="small muted" style={{ marginTop: booking.customer_notes ? '0.65rem' : 0 }}>Internal note</p>
                    <p className="small">{booking.internal_notes}</p>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="staff-booking-actions">
            <Link href={`/dashboard/customers/by-email?email=${encodeURIComponent(booking.customer_email || '')}&businessId=${booking.business_id}`} className="btn btn-ghost">
              Customer
            </Link>

            {canComplete && (
              <button
                type="button"
                className="btn btn-accent"
                disabled={isWorking}
                onClick={() => markBookingComplete(booking)}
              >
                {isWorking ? 'Saving...' : 'Mark complete'}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <main>
        <AuthNav />
        <section className="container" style={{ paddingTop: 40, paddingBottom: 48 }}>
          <div className="card">
            <p className="muted">Loading your Mirëbook staff schedule...</p>
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
            <p className="small" style={{ color: 'var(--warning)' }}>No staff profile linked</p>
            <h1 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
              Ask the business owner to invite you
            </h1>
            <p className="muted" style={{ marginTop: '0.75rem' }}>
              This account is not linked to a staff profile yet. Ask the business owner to add your email in their Staff setup page, then log in again.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              <Link href="/support" className="btn btn-ghost">
                Staff support
              </Link>
              <Link href="/account" className="btn btn-accent">
                Account settings
              </Link>
            </div>
          </div>
        )}

        {staffProfile && (
          <>
            <div className="staff-hero-card card">
            <div className="card staff-assigned-services-card">
              <div>
                <p className="small muted">Assigned services</p>
                <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                  What you can be booked for
                </h2>
                <p className="muted small" style={{ marginTop: '0.35rem' }}>
                  These services are controlled by the business owner. Your availability affects when customers can book you for them.
                </p>
              </div>

              {assignedServices.length === 0 ? (
                <div className="card" style={{ background: 'var(--surface-2)', marginTop: '1rem' }}>
                  <p className="small muted">
                    No services are assigned to your staff profile yet. Ask the business owner to assign services before customers can book you.
                  </p>
                </div>
              ) : (
                <div className="staff-assigned-services-grid">
                  {assignedServices.map((service) => (
                    <div key={service.id} className="staff-assigned-service-pill">
                      <strong>{service.name}</strong>
                      <span>
                        {service.duration_minutes ? `${service.duration_minutes} min` : 'Duration not set'}
                        {service.price ? ` · £${Number(service.price).toFixed(2)}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
              <div className="staff-profile-row">
                <div className="staff-avatar">
                  {staffProfile.image_url ? (
                    <img src={staffProfile.image_url} alt={staffProfile.name} />
                  ) : (
                    <span>
                      {staffProfile.name
                        .split(' ')
                        .map((part) => part[0])
                        .filter(Boolean)
                        .join('')
                        .slice(0, 2)
                        .toUpperCase() || 'MB'}
                    </span>
                  )}
                </div>

                <div>
                  <p className="small" style={{ color: 'var(--accent)', marginBottom: '0.35rem' }}>
                    Staff workspace
                  </p>
                  <h1 className="page-title">
                    Hi {staffProfile.name}
                  </h1>
                  <p className="page-sub" style={{ marginTop: '0.5rem' }}>
                    {(Array.isArray(staffProfile.businesses) ? staffProfile.businesses[0]?.name : staffProfile.businesses?.name) || 'Your business'} · {staffProfile.role_title || staffProfile.permission_role || 'Staff member'} · Staff-only workspace
                  </p>
                </div>
              </div>

              <div className="staff-hero-actions">
                <Link href="/staff/availability" className="btn btn-accent">
                  Update availability
                </Link>
                <Link href="/notifications" className="btn btn-ghost">
                  Updates
                </Link>
                <Link href="/account" className="btn btn-ghost">
                  Account
                </Link>
              </div>
            </div>

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

            <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
              <button type="button" className="card staff-summary-button" onClick={() => {
                setSelectedDate(formatDateInputValue(new Date()))
                setStatusFilter('active')
              }}>
                <p className="small muted">Today</p>
                <h3>{todayBookings.length}</h3>
                <p className="small muted">Assigned appointments today</p>
              </button>

              <button type="button" className="card staff-summary-button" onClick={() => setStatusFilter('active')}>
                <p className="small muted">Upcoming</p>
                <h3>{upcomingBookings.length}</h3>
                <p className="small muted">Pending and confirmed future bookings</p>
              </button>

              <button type="button" className="card staff-summary-button" onClick={() => setStatusFilter('history')}>
                <p className="small muted">Completed</p>
                <h3>{completedBookings.length}</h3>
                <p className="small muted">Appointments you have completed</p>
              </button>
            </div>

            {requests.length > 0 && (
              <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'rgba(255,107,53,0.35)' }}>
                <p className="small" style={{ color: 'var(--accent)' }}>Customer actions</p>
                <h3 style={{ marginTop: '0.25rem' }}>{requests.length} pending request{requests.length === 1 ? '' : 's'}</h3>
                <p className="muted small" style={{ marginTop: '0.4rem' }}>
                  These requests are visible here for awareness. Business owners or managers approve or decline them from the business dashboard; staff can prepare around likely schedule changes.
                </p>

                <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
                  {requests.slice(0, 3).map((request) => (
                    <div key={request.id} className="card" style={{ background: 'var(--surface-2)' }}>
                      <strong>{firstRequestBooking(request)?.customer_name || 'Customer'}</strong>
                      <p className="small muted" style={{ marginTop: '0.25rem' }}>
                        {request.request_type} · {firstRequestServiceName(request) || 'Service'}
                      </p>
                      {request.requested_start_at && (
                        <p className="small muted">
                          Requested: {new Date(request.requested_start_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="staff-schedule-header">
                <div>
                  <p className="small muted">Schedule</p>
                  <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                    Your appointments
                  </h2>
                  <p className="muted small" style={{ marginTop: '0.35rem' }}>
                    Mirëbook shows only appointments assigned to your staff profile. Service pricing, business profile and customer approvals stay with the business owner.
                  </p>
                </div>

                <div className="staff-filter-controls">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="all">All statuses</option>
                    <option value="pending">Pending approval</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="history">History</option>
                  </select>
                </div>
              </div>

              <div className="staff-day-tabs">
                {nextSevenDays.map((day) => (
                  <button
                    key={day.dateString}
                    type="button"
                    onClick={() => {
                      setSelectedDate(day.dateString)
                      setStatusFilter('active')
                    }}
                    className={selectedDate === day.dateString ? 'staff-day-tab-active' : ''}
                  >
                    <strong>{day.label}</strong>
                    <span>{day.subLabel}</span>
                    <small>{day.count} active</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="staff-booking-list">
              {selectedDateBookings.length === 0 && (
                <div className="card">
                  <h3>No appointments in this view</h3>
                  <p className="muted" style={{ marginTop: '0.5rem' }}>
                    Try another date or status filter. If you expected appointments here, ask the business owner to check staff assignment for the service.
                  </p>
                </div>
              )}

              {selectedDateBookings.map(renderBookingCard)}
            </div>
          </>
        )}
      </section>

      <style jsx>{`
        .staff-hero-card {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 1.5rem;
        }

        .staff-profile-row {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .staff-avatar {
          width: 72px;
          height: 72px;
          border-radius: 24px;
          overflow: hidden;
          background: var(--accent-dim);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent);
          font-weight: 900;
          font-size: 1.1rem;
          flex: 0 0 auto;
        }

        .staff-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .staff-hero-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .staff-assigned-services-card {
          margin-bottom: 1.5rem;
        }

        .staff-assigned-services-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .staff-assigned-service-pill {
          display: grid;
          gap: 0.25rem;
          padding: 0.85rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface-2);
        }

        .staff-assigned-service-pill span {
          color: var(--text-muted);
          font-size: 0.85rem;
        }

        .staff-summary-button {
          width: 100%;
          text-align: left;
          color: var(--text);
          cursor: pointer;
        }

        .staff-summary-button:hover {
          border-color: rgba(255,107,53,0.35);
          transform: translateY(-1px);
        }

        .staff-schedule-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .staff-filter-controls {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .staff-day-tabs {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 0.5rem;
          margin-top: 1rem;
        }

        .staff-day-tabs button {
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text);
          border-radius: 14px;
          padding: 0.7rem;
          text-align: left;
          cursor: pointer;
        }

        .staff-day-tabs button span,
        .staff-day-tabs button small {
          display: block;
          color: var(--text-muted);
          margin-top: 0.2rem;
        }

        .staff-day-tabs button.staff-day-tab-active {
          border-color: rgba(255,107,53,0.5);
          background: var(--accent-dim);
        }

        .staff-booking-list {
          display: grid;
          gap: 1rem;
        }

        .staff-booking-card-inner {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .staff-booking-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .staff-notes-box {
          margin-top: 0.75rem;
          padding: 0.8rem;
          border-radius: var(--radius);
          background: var(--surface-2);
          border: 1px solid var(--border);
        }

        @media (max-width: 820px) {
          .staff-day-tabs {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 620px) {
          .staff-hero-card,
          .staff-profile-row,
          .staff-schedule-header,
          .staff-booking-card-inner {
            display: grid;
          }

          .staff-hero-actions,
          .staff-filter-controls,
          .staff-booking-actions {
            width: 100%;
          }

          .staff-hero-actions :global(.btn),
          .staff-filter-controls input,
          .staff-filter-controls select,
          .staff-booking-actions :global(.btn),
          .staff-booking-actions button,
          .staff-booking-actions a {
            width: 100%;
            justify-content: center;
          }

          .staff-day-tabs {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  )
}