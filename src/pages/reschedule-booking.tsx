import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AuthNav from '@/components/AuthNav'

type Booking = {
  id: string
  business_id: string
  service_id: string
  customer_user_id: string
  customer_name: string
  customer_email?: string
  customer_phone?: string
  start_at: string
  duration_minutes: number
  status: string
  staff_member_id?: string | null
  businesses?: {
    id: string
    name: string
    user_id: string
  } | null
  services?: {
    id: string
    name: string
    duration_minutes: number
    price: number
  } | null
  staff_members?: {
    id?: string
    name: string
    role_title?: string | null
  } | null
}

type StaffMember = {
  id: string
  name: string
  role_title?: string | null
}

type StaffService = {
  staff_member_id: string
  service_id: string
}

type StaffAvailability = {
  staff_member_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_closed: boolean
}

type Role = 'customer' | 'business' | null

export default function RescheduleBooking() {
  const router = useRouter()
  const { id } = router.query

  const [booking, setBooking] = useState<Booking | null>(null)
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [staffServices, setStaffServices] = useState<StaffService[]>([])
  const [staffAvailability, setStaffAvailability] = useState<StaffAvailability[]>([])
  const [existingBookings, setExistingBookings] = useState<any[]>([])

  const [role, setRole] = useState<Role>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [timeSlots, setTimeSlots] = useState<string[]>([])
  const [selectedTime, setSelectedTime] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dateOptions = useMemo(() => {
    const dates: { value: string; label: string; subLabel: string }[] = []

    for (let i = 0; i < 14; i++) {
      const date = new Date()
      date.setDate(date.getDate() + i)

      const yyyy = date.getFullYear()
      const mm = String(date.getMonth() + 1).padStart(2, '0')
      const dd = String(date.getDate()).padStart(2, '0')

      dates.push({
        value: `${yyyy}-${mm}-${dd}`,
        label: date.toLocaleDateString(undefined, { weekday: 'short' }),
        subLabel: date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
      })
    }

    return dates
  }, [])

  async function loadPage() {
    setLoading(true)
    setError(null)

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      router.replace('/login')
      return
    }

    if (!id || Array.isArray(id)) {
      setError('Missing booking reference.')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    const userRole = profile?.role === 'business' ? 'business' : 'customer'
    setRole(userRole)

    const { data: bookingData, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        businesses (
          id,
          name,
          user_id
        ),
        services (
          id,
          name,
          duration_minutes,
          price
        ),
        staff_members (
          id,
          name,
          role_title
        )
      `)
      .eq('id', id)
      .single()

    if (bookingError || !bookingData) {
      setError(bookingError?.message || 'Booking not found.')
      setLoading(false)
      return
    }

    const linkedBusiness = Array.isArray(bookingData.businesses)
      ? bookingData.businesses[0]
      : bookingData.businesses

    const linkedService = Array.isArray(bookingData.services)
      ? bookingData.services[0]
      : bookingData.services

    const linkedStaff = Array.isArray(bookingData.staff_members)
      ? bookingData.staff_members[0]
      : bookingData.staff_members

    const normalisedBooking: Booking = {
      ...bookingData,
      businesses: linkedBusiness,
      services: linkedService,
      staff_members: linkedStaff
    }

    const isCustomerOwner = normalisedBooking.customer_user_id === session.user.id
    const isBusinessOwner = normalisedBooking.businesses?.user_id === session.user.id

    if (!isCustomerOwner && !isBusinessOwner) {
      setError('You do not have permission to reschedule this booking.')
      setLoading(false)
      return
    }

    if (normalisedBooking.status === 'cancelled') {
      setError('Cancelled bookings cannot be rescheduled.')
      setLoading(false)
      return
    }

    setBooking(normalisedBooking)

    const originalDate = new Date(normalisedBooking.start_at)
    const yyyy = originalDate.getFullYear()
    const mm = String(originalDate.getMonth() + 1).padStart(2, '0')
    const dd = String(originalDate.getDate()).padStart(2, '0')
    setSelectedDate(`${yyyy}-${mm}-${dd}`)
    setSelectedStaffId(normalisedBooking.staff_member_id || '')
    setSelectedTime('')

    const { data: staffData, error: staffError } = await supabase
      .from('staff_members')
      .select('id, name, role_title')
      .eq('business_id', normalisedBooking.business_id)
      .eq('active', true)
      .order('created_at', { ascending: false })

    if (staffError) {
      setError(staffError.message)
      setLoading(false)
      return
    }

    setStaffMembers(staffData || [])

    const staffIds = (staffData || []).map((staff) => staff.id)

    if (staffIds.length > 0) {
      const { data: staffServiceData, error: staffServiceError } = await supabase
        .from('staff_services')
        .select('staff_member_id, service_id')
        .in('staff_member_id', staffIds)

      if (staffServiceError) {
        setError(staffServiceError.message)
        setLoading(false)
        return
      }

      setStaffServices(staffServiceData || [])

      const { data: staffAvailabilityData, error: staffAvailabilityError } = await supabase
        .from('staff_availability')
        .select('staff_member_id, day_of_week, start_time, end_time, is_closed')
        .in('staff_member_id', staffIds)

      if (staffAvailabilityError) {
        setError(staffAvailabilityError.message)
        setLoading(false)
        return
      }

      setStaffAvailability(staffAvailabilityData || [])
    } else {
      setStaffServices([])
      setStaffAvailability([])
    }

    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('*')
      .eq('business_id', normalisedBooking.business_id)
      .eq('status', 'confirmed')

    setExistingBookings(bookingsData || [])
    setLoading(false)
  }

  useEffect(() => {
    if (!router.isReady) return
    loadPage()
  }, [router.isReady, id])

  function staffThatCanDoBookingService() {
    if (!booking?.services) return []

    return staffMembers.filter((staff) =>
      staffServices.some(
        (link) =>
          link.staff_member_id === staff.id &&
          link.service_id === booking.services?.id
      )
    )
  }

  function getStaffDayAvailability(staffId: string, dateValue: string) {
    if (!dateValue) return null

    const day = new Date(dateValue).getDay()

    return staffAvailability.find(
      (row) =>
        row.staff_member_id === staffId &&
        row.day_of_week === day
    ) || null
  }

  function getStaffStatus(staff: StaffMember) {
    if (!selectedDate) {
      return {
        available: false,
        label: 'Choose date first'
      }
    }

    const dayAvailability = getStaffDayAvailability(staff.id, selectedDate)

    if (!dayAvailability || dayAvailability.is_closed) {
      return {
        available: false,
        label: 'Unavailable / day off'
      }
    }

    return {
      available: true,
      label: `${dayAvailability.start_time.slice(0, 5)} - ${dayAvailability.end_time.slice(0, 5)}`
    }
  }

  function generateSlots() {
    if (!booking || !booking.services || !selectedDate || !selectedStaffId) {
      setTimeSlots([])
      return
    }

    const dayAvailability = getStaffDayAvailability(selectedStaffId, selectedDate)

    if (!dayAvailability || dayAvailability.is_closed) {
      setTimeSlots([])
      return
    }

    const slots: string[] = []

    let start = new Date(`${selectedDate}T${dayAvailability.start_time}`)
    const end = new Date(`${selectedDate}T${dayAvailability.end_time}`)
    const duration = booking.services.duration_minutes || booking.duration_minutes

    while (start.getTime() + duration * 60000 <= end.getTime()) {
      const slotStart = new Date(start)
      const slotEnd = new Date(start.getTime() + duration * 60000)
      const timeString = slotStart.toTimeString().slice(0, 5)

      const overlapsBooking = existingBookings.some((existing) => {
        if (existing.id === booking.id) return false
        if (existing.staff_member_id !== selectedStaffId) return false

        const bookingStart = new Date(existing.start_at)
        const bookingEnd = existing.end_at
          ? new Date(existing.end_at)
          : new Date(bookingStart.getTime() + existing.duration_minutes * 60000)

        return slotStart < bookingEnd && slotEnd > bookingStart
      })

      if (!overlapsBooking) {
        slots.push(timeString)
      }

      start = new Date(start.getTime() + duration * 60000)
    }

    setTimeSlots(slots)
  }

  useEffect(() => {
    generateSlots()
  }, [booking, selectedDate, selectedStaffId, staffAvailability, existingBookings])

  async function saveReschedule(e: React.FormEvent) {
    e.preventDefault()

    if (!booking || !selectedTime || !selectedStaffId) return

    setSaving(true)
    setError(null)

    const newStartAt = new Date(`${selectedDate}T${selectedTime}:00`).toISOString()
    const newDuration = booking.services?.duration_minutes || booking.duration_minutes

    let error = null

    if (role === 'customer') {
      const { data: existingPendingRequest, error: existingRequestError } = await supabase
        .from('booking_requests')
        .select('id')
        .eq('booking_id', booking.id)
        .eq('requested_by', 'customer')
        .eq('request_type', 'reschedule')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingRequestError) {
        error = existingRequestError
      } else if (existingPendingRequest?.id) {
        const result = await supabase
          .from('booking_requests')
          .update({
            current_start_at: booking.start_at,
            requested_start_at: newStartAt,
            current_staff_member_id: booking.staff_member_id || null,
            requested_staff_member_id: selectedStaffId,
            requested_duration_minutes: newDuration,
            message: 'Customer updated their requested appointment time.',
            response_message: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingPendingRequest.id)

        error = result.error
      } else {
        const result = await supabase
          .from('booking_requests')
          .insert({
            booking_id: booking.id,
            business_id: booking.business_id,
            customer_user_id: booking.customer_user_id,
            requested_by: 'customer',
            request_type: 'reschedule',
            status: 'pending',
            current_start_at: booking.start_at,
            requested_start_at: newStartAt,
            current_staff_member_id: booking.staff_member_id || null,
            requested_staff_member_id: selectedStaffId,
            requested_duration_minutes: newDuration,
            message: 'Customer requested a new appointment time.'
          })

        error = result.error
      }
    } else {
      const result = await supabase
        .from('bookings')
        .update({
          start_at: newStartAt,
          duration_minutes: newDuration,
          staff_member_id: selectedStaffId,
          status: 'confirmed'
        })
        .eq('id', booking.id)

      error = result.error
    }

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    if (role === 'business') {
      router.push(`/dashboard/bookings?businessId=${booking.business_id}`)
    } else {
      router.push('/my-bookings?requestSent=1')
    }
  }
  const selectableStaff = staffThatCanDoBookingService()

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ padding: '42px 24px 80px' }}>
        {loading && (
          <div className="card">
            <p className="muted">Loading booking...</p>
          </div>
        )}

        {error && (
          <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)' }}>
            <h1 className="page-title">Cannot reschedule</h1>
            <p style={{ color: 'var(--danger)', marginTop: '0.75rem' }}>{error}</p>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <Link href="/my-bookings" className="btn btn-accent">
                My bookings
              </Link>

              <Link href="/dashboard" className="btn btn-ghost">
                Dashboard
              </Link>
            </div>
          </div>
        )}

        {!loading && !error && booking && (
          <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gap: '1rem' }}>
            <div>
              <p className="small muted">Modify appointment</p>
              <h1 className="page-title">Reschedule booking</h1>
              <p className="page-sub" style={{ marginTop: '0.5rem' }}>
                Choose a new date, staff member and available time.
              </p>
            </div>

            <div className="card">
              <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: '1rem' }}>
                Current booking
              </h2>

              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <div>
                  <p className="small muted">Business</p>
                  <strong>{booking.businesses?.name || 'Business'}</strong>
                </div>

                <div>
                  <p className="small muted">Service</p>
                  <strong>{booking.services?.name || 'Service'}</strong>
                </div>

                <div>
                  <p className="small muted">Current staff member</p>
                  <strong>
                    {booking.staff_members?.name || 'Staff not recorded'}
                    {booking.staff_members?.role_title ? ` — ${booking.staff_members.role_title}` : ''}
                  </strong>
                </div>

                <div>
                  <p className="small muted">Current time</p>
                  <strong>{new Date(booking.start_at).toLocaleString()}</strong>
                </div>

                <div>
                  <p className="small muted">Customer</p>
                  <strong>{booking.customer_name}</strong>
                  <p className="small muted">{booking.customer_email}</p>
                </div>
              </div>
            </div>

            <form onSubmit={saveReschedule} className="card" style={{ display: 'grid', gap: '1rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)' }}>
                New appointment time
              </h2>

              <div>
                <label className="small muted">Choose date</label>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '0.5rem',
                  marginTop: '0.5rem'
                }}>
                  {dateOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setSelectedDate(option.value)
                        setSelectedStaffId('')
                        setSelectedTime('')
                      }}
                      style={{
                        padding: '0.65rem',
                        borderRadius: 14,
                        border: selectedDate === option.value ? '1px solid rgba(255,107,53,0.55)' : '1px solid var(--border)',
                        background: selectedDate === option.value ? 'var(--accent-dim)' : 'var(--surface-2)',
                        color: 'var(--text)',
                        textAlign: 'center'
                      }}
                    >
                      <strong>{option.label}</strong>
                      <p className="small muted">{option.subLabel}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="small muted">Available staff</label>

                {!selectedDate && (
                  <p className="small muted" style={{ marginTop: '0.5rem' }}>
                    Select a date first.
                  </p>
                )}

                {selectedDate && selectableStaff.length === 0 && (
                  <p className="small muted" style={{ marginTop: '0.5rem' }}>
                    No staff are assigned to this service yet.
                  </p>
                )}

                {selectedDate && selectableStaff.length > 0 && (
                  <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {selectableStaff.map((staff) => {
                      const status = getStaffStatus(staff)
                      const isSelected = selectedStaffId === staff.id

                      return (
                        <button
                          key={staff.id}
                          type="button"
                          disabled={!status.available}
                          onClick={() => {
                            setSelectedStaffId(staff.id)
                            setSelectedTime('')
                          }}
                          style={{
                            opacity: status.available ? 1 : 0.45,
                            textAlign: 'left',
                            padding: '0.85rem',
                            borderRadius: 'var(--radius)',
                            border: isSelected ? '1px solid rgba(255,107,53,0.55)' : '1px solid var(--border)',
                            background: isSelected ? 'var(--accent-dim)' : 'var(--surface-2)',
                            color: 'var(--text)'
                          }}
                        >
                          <strong>{staff.name}</strong>
                          <p className="small muted">
                            {staff.role_title || 'Staff member'}
                          </p>
                          <p
                            className="small"
                            style={{
                              color: status.available ? 'var(--success)' : 'var(--warning)'
                            }}
                          >
                            {status.label}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="small muted">Available times</label>

                {!selectedStaffId && (
                  <p className="small muted" style={{ marginTop: '0.5rem' }}>
                    Select an available staff member first.
                  </p>
                )}

                {selectedStaffId && timeSlots.length === 0 && (
                  <p className="small muted" style={{ marginTop: '0.5rem' }}>
                    No free slots for this staff member on this date.
                  </p>
                )}

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(82px, 1fr))',
                  gap: '0.5rem',
                  marginTop: '0.75rem'
                }}>
                  {timeSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedTime(slot)}
                      style={{
                        padding: '0.65rem',
                        borderRadius: 999,
                        border: selectedTime === slot ? '1px solid rgba(255,107,53,0.5)' : '1px solid var(--border)',
                        background: selectedTime === slot ? 'var(--accent)' : 'var(--surface-2)',
                        color: selectedTime === slot ? 'var(--bg)' : 'var(--text)'
                      }}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={saving || !selectedDate || !selectedStaffId || !selectedTime}
                className="btn btn-accent"
              >
                {saving ? 'Saving...' : role === 'customer' ? 'Request new time' : 'Save new time'}
              </button>
            </form>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {role === 'business' ? (
                <Link href={`/dashboard/bookings?businessId=${booking.business_id}`} className="btn btn-ghost">
                  Back to business bookings
                </Link>
              ) : (
                <Link href="/my-bookings" className="btn btn-ghost">
                  Back to my bookings
                </Link>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}