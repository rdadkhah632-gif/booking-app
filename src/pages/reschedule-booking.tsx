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

type BusinessAvailability = {
  day_of_week: number
  start_time: string
  end_time: string
  is_closed: boolean
}

type ExistingBooking = {
  id: string
  staff_member_id?: string | null
  start_at: string
  end_at?: string | null
  duration_minutes: number
  status: string
}

type StaffFilter = 'any' | string

type StaffChoice = 'any' | string

type SlotOption = {
  time: string
  staffIds: string[]
}

type CalendarDay = {
  date: Date
  dateString: string
  isCurrentMonth: boolean
  isToday: boolean
  isPast: boolean
  label: string
  shortLabel: string
  availableStaffIds: string[]
  availableSlotCount: number
  isBookable: boolean
}

type Role = 'customer' | 'business' | null

export default function RescheduleBooking() {
  const router = useRouter()
  const { id } = router.query

  const [booking, setBooking] = useState<Booking | null>(null)
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [staffServices, setStaffServices] = useState<StaffService[]>([])
  const [staffAvailability, setStaffAvailability] = useState<StaffAvailability[]>([])
  const [availability, setAvailability] = useState<BusinessAvailability[]>([])
  const [existingBookings, setExistingBookings] = useState<ExistingBooking[]>([])

  const [role, setRole] = useState<Role>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [staffFilter, setStaffFilter] = useState<StaffFilter>('any')
  const [selectedStaffChoice, setSelectedStaffChoice] = useState<StaffChoice>('any')
  const [timeSlots, setTimeSlots] = useState<SlotOption[]>([])
  const [selectedTime, setSelectedTime] = useState('')
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)


  async function loadPage() {
    setLoading(true)
    setError(null)
    setSuccess(null)

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

    if (normalisedBooking.status === 'completed') {
      setError('Completed bookings cannot be rescheduled.')
      setLoading(false)
      return
    }

    if (normalisedBooking.status === 'pending') {
      setError('This booking is still waiting for business approval. It can be changed after it is confirmed.')
      setLoading(false)
      return
    }

    setBooking(normalisedBooking)

    const originalDate = new Date(normalisedBooking.start_at)
    const yyyy = originalDate.getFullYear()
    const mm = String(originalDate.getMonth() + 1).padStart(2, '0')
    const dd = String(originalDate.getDate()).padStart(2, '0')
    const originalDateValue = `${yyyy}-${mm}-${dd}`
    setSelectedDate(originalDateValue)
    setCalendarMonth(new Date(originalDate.getFullYear(), originalDate.getMonth(), 1))
    setStaffFilter('any')
    setSelectedStaffChoice('any')
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

    const { data: availabilityData } = await supabase
      .from('availability')
      .select('day_of_week, start_time, end_time, is_closed')
      .eq('business_id', normalisedBooking.business_id)

    setAvailability(availabilityData || [])

    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('id, staff_member_id, start_at, end_at, duration_minutes, status')
      .eq('business_id', normalisedBooking.business_id)
      .in('status', ['pending', 'confirmed'])

    setExistingBookings(bookingsData || [])
    setLoading(false)
  }

  useEffect(() => {
    if (!router.isReady) return
    loadPage()
  }, [router.isReady, id])

  function formatDateInputValue(date: Date) {
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  function sameDate(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
  }

  function normaliseDateValue(date: Date) {
    const cleanDate = new Date(date)
    cleanDate.setHours(0, 0, 0, 0)
    return cleanDate
  }

  function addMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60000)
  }

  function monthLabel(date: Date) {
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }

  function moveCalendarMonth(direction: number) {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1))
  }

  function resetCalendarToToday() {
    const today = new Date()
    setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1))
  }

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

  function getCandidateStaff(filter: StaffFilter = staffFilter) {
    const serviceStaff = staffThatCanDoBookingService()
    if (filter === 'any') return serviceStaff
    return serviceStaff.filter((staff) => staff.id === filter)
  }

  function getBusinessDayAvailabilityForDate(dateValue: string) {
    if (!dateValue) return null

    const day = new Date(`${dateValue}T12:00:00`).getDay()

    return availability.find((row) => row.day_of_week === day) || null
  }

  function getStaffDayAvailabilityForDate(staffId: string, dateValue: string) {
    if (!dateValue) return null

    const day = new Date(`${dateValue}T12:00:00`).getDay()

    const staffSpecificAvailability = staffAvailability.find(
      (row) =>
        row.staff_member_id === staffId &&
        row.day_of_week === day
    )

    if (staffSpecificAvailability) return staffSpecificAvailability

    const businessDayAvailability = getBusinessDayAvailabilityForDate(dateValue)

    if (!businessDayAvailability) return null

    return {
      staff_member_id: staffId,
      day_of_week: businessDayAvailability.day_of_week,
      start_time: businessDayAvailability.start_time,
      end_time: businessDayAvailability.end_time,
      is_closed: businessDayAvailability.is_closed
    }
  }

  function generateSlotsForStaffOnDate(staffId: string, dateValue: string) {
    if (!booking || !booking.services || !dateValue || !staffId) return []

    const dayAvailability = getStaffDayAvailabilityForDate(staffId, dateValue)

    if (!dayAvailability || dayAvailability.is_closed) return []

    const slots: string[] = []
    let start = new Date(`${dateValue}T${dayAvailability.start_time}`)
    const end = new Date(`${dateValue}T${dayAvailability.end_time}`)
    const duration = booking.services.duration_minutes || booking.duration_minutes
    const now = new Date()
    const slotIntervalMinutes = 15

    while (start.getTime() + duration * 60000 <= end.getTime()) {
      const slotStart = new Date(start)
      const slotEnd = addMinutes(slotStart, duration)
      const timeString = slotStart.toTimeString().slice(0, 5)
      const isPastSlot = slotStart < now

      const overlapsBooking = existingBookings.some((existing) => {
        if (existing.id === booking.id) return false
        if (existing.staff_member_id !== staffId) return false

        const bookingStart = new Date(existing.start_at)
        const bookingEnd = existing.end_at
          ? new Date(existing.end_at)
          : addMinutes(bookingStart, existing.duration_minutes)

        return slotStart < bookingEnd && slotEnd > bookingStart
      })

      if (!isPastSlot && !overlapsBooking) {
        slots.push(timeString)
      }

      start = addMinutes(start, slotIntervalMinutes)
    }

    return slots
  }

  function generateMergedSlots(dateValue: string, filter: StaffFilter = staffFilter) {
    if (!booking?.services || !dateValue) return []

    const mergedSlots = getCandidateStaff(filter).reduce<Record<string, string[]>>((acc, staff) => {
      const slots = generateSlotsForStaffOnDate(staff.id, dateValue)

      slots.forEach((slot) => {
        if (!acc[slot]) acc[slot] = []
        acc[slot].push(staff.id)
      })

      return acc
    }, {})

    return Object.entries(mergedSlots)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, staffIds]) => ({ time, staffIds }))
  }

  function getDayAvailabilitySummary(dateValue: string, filter: StaffFilter = staffFilter) {
    const slots = generateMergedSlots(dateValue, filter)
    const availableStaffIds = Array.from(new Set(slots.flatMap((slot) => slot.staffIds)))

    return {
      availableStaffIds,
      availableSlotCount: slots.length,
      isBookable: slots.length > 0
    }
  }

  const selectableStaff = useMemo(() => staffThatCanDoBookingService(), [booking, staffMembers, staffServices])

  const selectedStaff = useMemo(() => {
    if (selectedStaffChoice === 'any') return null
    return staffMembers.find((staff) => staff.id === selectedStaffChoice) || null
  }, [selectedStaffChoice, staffMembers])

  const selectedFilterStaff = useMemo(() => {
    if (staffFilter === 'any') return null
    return staffMembers.find((staff) => staff.id === staffFilter) || null
  }, [staffFilter, staffMembers])

  const selectedDateLabel = useMemo(() => {
    if (!selectedDate) return null

    const date = new Date(`${selectedDate}T12:00:00`)
    return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }, [selectedDate])

  const calendarDays = useMemo<CalendarDay[]>(() => {
    const firstOfMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1)
    const gridStart = new Date(firstOfMonth)
    gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay())

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart)
      date.setDate(gridStart.getDate() + index)
      date.setHours(0, 0, 0, 0)

      const dateString = formatDateInputValue(date)
      const isCurrentMonth = date.getMonth() === calendarMonth.getMonth()
      const isToday = sameDate(date, today)
      const isPast = normaliseDateValue(date) < today
      const availabilitySummary = !isPast && booking?.services
        ? getDayAvailabilitySummary(dateString, staffFilter)
        : { availableStaffIds: [], availableSlotCount: 0, isBookable: false }

      return {
        date,
        dateString,
        isCurrentMonth,
        isToday,
        isPast,
        label: date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
        shortLabel: String(date.getDate()),
        ...availabilitySummary
      }
    })
  }, [calendarMonth, booking, staffFilter, staffMembers, staffServices, staffAvailability, availability, existingBookings])

  const availableStaffForSelectedTime = useMemo(() => {
    if (!selectedTime) return []

    const selectedSlot = timeSlots.find((slot) => slot.time === selectedTime)
    if (!selectedSlot) return []

    return selectableStaff.filter((staff) => selectedSlot.staffIds.includes(staff.id))
  }, [selectedTime, timeSlots, selectableStaff])

  useEffect(() => {
    if (!booking || !selectedDate) {
      setTimeSlots([])
      return
    }

    const slots = generateMergedSlots(selectedDate, staffFilter)
    setTimeSlots(slots)

    if (selectedTime && !slots.some((slot) => slot.time === selectedTime)) {
      setSelectedTime('')
      setSelectedStaffChoice('any')
    }
  }, [booking, selectedDate, staffFilter, staffAvailability, availability, existingBookings, selectableStaff])

  function staffForSlot(slotTime: string) {
    const slot = timeSlots.find((item) => item.time === slotTime)
    if (!slot) return []

    return selectableStaff.filter((staff) => slot.staffIds.includes(staff.id))
  }

  function resolveStaffForReschedule() {
    const slot = timeSlots.find((item) => item.time === selectedTime)
    if (!slot) return ''

    if (selectedStaffChoice !== 'any') {
      return slot.staffIds.includes(selectedStaffChoice) ? selectedStaffChoice : ''
    }

    return slot.staffIds[0] || ''
  }

  async function saveReschedule(e: React.FormEvent) {
    e.preventDefault()

    if (!booking || !selectedDate || !selectedTime) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    const staffMemberIdForReschedule = resolveStaffForReschedule()

    if (!staffMemberIdForReschedule) {
      setSaving(false)
      setError('Please choose Any available staff or one of the staff available for this time.')
      return
    }

    const newStartAt = new Date(`${selectedDate}T${selectedTime}:00`).toISOString()
    const newDuration = booking.services?.duration_minutes || booking.duration_minutes

    const freshSlots = generateSlotsForStaffOnDate(staffMemberIdForReschedule, selectedDate)

    if (!freshSlots.includes(selectedTime)) {
      setSaving(false)
      setError('This time is no longer available. Please choose another slot.')
      setSelectedTime('')
      return
    }

    if (newStartAt === booking.start_at && staffMemberIdForReschedule === booking.staff_member_id) {
      setSaving(false)
      setError('Choose a different date, time or staff member before submitting a reschedule.')
      return
    }

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
            requested_staff_member_id: staffMemberIdForReschedule,
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
            requested_staff_member_id: staffMemberIdForReschedule,
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
          staff_member_id: staffMemberIdForReschedule,
          status: 'confirmed'
        })
        .eq('id', booking.id)

      error = result.error

      if (!error) {
        const { error: cancelOtherRequestsError } = await supabase
          .from('booking_requests')
          .update({
            status: 'cancelled',
            response_message: 'Cancelled automatically because the business rescheduled this booking directly.',
            updated_at: new Date().toISOString()
          })
          .eq('booking_id', booking.id)
          .eq('status', 'pending')

        error = cancelOtherRequestsError
      }
    }

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess(role === 'business' ? 'Booking rescheduled successfully.' : 'Reschedule request sent to the business for approval.')

    if (role === 'business') {
      router.replace(`/dashboard/bookings?businessId=${booking.business_id}`)
    } else {
      router.replace('/my-bookings?requestSent=1')
    }
  }

  const newDuration = booking?.services?.duration_minutes || booking?.duration_minutes || 0
  const requestedStart = selectedDate && selectedTime ? new Date(`${selectedDate}T${selectedTime}:00`) : null
  const requestedEnd = requestedStart ? new Date(requestedStart.getTime() + newDuration * 60000) : null
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

              <Link href="/dashboard/bookings" className="btn btn-ghost">
                Business bookings
              </Link>
            </div>
          </div>
        )}

        {!loading && !error && booking && (
          <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gap: '1rem' }}>
            <div>
              <p className="small muted">
                {role === 'business' ? 'Business reschedule' : 'Customer reschedule request'}
              </p>
              <h1 className="page-title">Reschedule booking</h1>
              <p className="page-sub" style={{ marginTop: '0.5rem' }}>
                {role === 'business'
                  ? 'Choose a smart calendar date, available time and staff choice. This updates the booking immediately.'
                  : 'Choose a smart calendar date, available time and staff choice. Your original appointment stays confirmed until the business approves the change.'}
              </p>
            </div>

            <div
              className="card"
              style={{
                borderColor: role === 'business' ? 'rgba(45,212,191,0.28)' : 'rgba(255,107,53,0.28)',
                background: role === 'business' ? 'rgba(45,212,191,0.06)' : 'var(--accent-dim)'
              }}
            >
              <p className="small" style={{ color: role === 'business' ? 'var(--success)' : 'var(--accent)' }}>
                {role === 'business' ? 'Direct reschedule' : 'Approval required'}
              </p>
              <strong>
                {role === 'business'
                  ? 'Saving here immediately changes the customer booking.'
                  : 'Your original appointment stays confirmed until the business accepts your new requested time.'}
              </strong>
            </div>

            {success && (
              <div className="card" style={{ borderColor: 'rgba(45,212,191,0.35)', background: 'rgba(45,212,191,0.06)' }}>
                <p className="small" style={{ color: 'var(--success)' }}>{success}</p>
              </div>
            )}

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
                  <p className="small muted">Status</p>
                  <strong style={{ textTransform: 'capitalize' }}>{booking.status}</strong>
                </div>

                <div>
                  <p className="small muted">Customer</p>
                  <strong>{booking.customer_name}</strong>
                  <p className="small muted">{booking.customer_email}</p>
                </div>
              </div>
            </div>

            <div className="card" style={{ background: 'var(--surface-2)' }}>
              <p className="small muted">New requested appointment</p>
              <h3 style={{ marginTop: '0.25rem' }}>
                {requestedStart
                  ? `${requestedStart.toLocaleString()}${requestedEnd ? ` - ${requestedEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`
                  : 'Choose a new date and time'}
              </h3>
              <p className="small muted" style={{ marginTop: '0.45rem' }}>
                {selectedTime
                  ? selectedStaff
                    ? `Staff: ${selectedStaff.name}${selectedStaff.role_title ? ` — ${selectedStaff.role_title}` : ''}`
                    : availableStaffForSelectedTime.length === 1
                      ? `Assigned automatically: ${availableStaffForSelectedTime[0].name}`
                      : `Any available staff · ${availableStaffForSelectedTime.length} staff can do this time`
                  : 'Choose a time to select Any available staff or a specific person.'}
              </p>
              <p className="small muted">
                {booking.services?.name || 'Service'} · {newDuration} minutes
              </p>
            </div>

            <form onSubmit={saveReschedule} className="card reschedule-form-card">
              <h2 style={{ fontFamily: 'var(--font-display)' }}>
                New appointment time
              </h2>

              <div>
                <label className="small muted">Smart calendar</label>

                {selectableStaff.length === 0 && (
                  <p className="small muted" style={{ marginTop: '0.5rem' }}>
                    This booking cannot be rescheduled yet because no active staff are assigned to this service.
                  </p>
                )}

                {selectableStaff.length > 0 && (
                  <div className="card reschedule-calendar-card" style={{ background: 'var(--surface-2)', padding: '0.9rem', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <button type="button" onClick={() => moveCalendarMonth(-1)} className="btn btn-ghost" style={{ padding: '0.5rem 0.7rem' }}>
                        ←
                      </button>

                      <div style={{ textAlign: 'center' }}>
                        <strong>{monthLabel(calendarMonth)}</strong>
                        <p className="small muted">Mirëbook disables days that cannot fit this service.</p>
                      </div>

                      <button type="button" onClick={() => moveCalendarMonth(1)} className="btn btn-ghost" style={{ padding: '0.5rem 0.7rem' }}>
                        →
                      </button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
                      <button type="button" onClick={resetCalendarToToday} className="btn btn-ghost" style={{ padding: '0.45rem 0.75rem' }}>
                        Back to this month
                      </button>
                    </div>

                    <div style={{ marginBottom: '0.85rem' }}>
                      <label className="small muted">Optional staff filter</label>
                      <div className="reschedule-staff-filter-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', marginTop: '0.45rem' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setStaffFilter('any')
                            setSelectedDate('')
                            setSelectedTime('')
                            setSelectedStaffChoice('any')
                          }}
                          style={{
                            textAlign: 'left',
                            padding: '0.7rem',
                            borderRadius: 14,
                            border: staffFilter === 'any' ? '1px solid rgba(255,107,53,0.55)' : '1px solid var(--border)',
                            background: staffFilter === 'any' ? 'var(--accent-dim)' : 'var(--surface)',
                            color: 'var(--text)'
                          }}
                        >
                          <strong>Any staff</strong>
                          <p className="small muted">Show all bookable days</p>
                        </button>

                        {selectableStaff.map((staff) => (
                          <button
                            key={staff.id}
                            type="button"
                            onClick={() => {
                              setStaffFilter(staff.id)
                              setSelectedDate('')
                              setSelectedTime('')
                              setSelectedStaffChoice('any')
                            }}
                            style={{
                              textAlign: 'left',
                              padding: '0.7rem',
                              borderRadius: 14,
                              border: staffFilter === staff.id ? '1px solid rgba(255,107,53,0.55)' : '1px solid var(--border)',
                              background: staffFilter === staff.id ? 'var(--accent-dim)' : 'var(--surface)',
                              color: 'var(--text)'
                            }}
                          >
                            <strong>{staff.name}</strong>
                            <p className="small muted">{staff.role_title || 'Staff member'}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="reschedule-calendar-weekdays" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.35rem', marginBottom: '0.35rem' }}>
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                        <p key={day} className="small muted" style={{ textAlign: 'center', fontWeight: 700 }}>
                          {day}
                        </p>
                      ))}
                    </div>

                    <div className="reschedule-calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '0.35rem' }}>
                      {calendarDays.map((day) => {
                        const isSelected = selectedDate === day.dateString
                        const isDisabled = day.isPast || !day.isBookable

                        return (
                          <button
                            key={day.dateString}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => {
                              setSelectedDate(day.dateString)
                              setSelectedTime('')
                              setSelectedStaffChoice('any')
                            }}
                            title={day.isBookable ? `${day.label} · ${day.availableSlotCount} slots` : `${day.label} · unavailable`}
                            style={{
                              minHeight: 46,
                              borderRadius: 12,
                              border: isSelected ? '1px solid rgba(255,107,53,0.65)' : day.isToday ? '1px solid rgba(45,212,191,0.45)' : '1px solid var(--border)',
                              background: isSelected ? 'var(--accent)' : day.isBookable ? 'var(--surface)' : 'rgba(148,163,184,0.08)',
                              color: isSelected ? 'var(--bg)' : day.isCurrentMonth ? 'var(--text)' : 'var(--text-muted)',
                              opacity: isDisabled ? 0.32 : day.isCurrentMonth ? 1 : 0.55,
                              cursor: isDisabled ? 'not-allowed' : 'pointer',
                              fontWeight: isSelected || day.isToday ? 800 : 500
                            }}
                          >
                            <span>{day.shortLabel}</span>
                            {day.isBookable && (
                              <span style={{ display: 'block', fontSize: '0.62rem', opacity: 0.78 }}>
                                {day.availableSlotCount}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {selectedDateLabel && (
                      <p className="small muted" style={{ marginTop: '0.75rem' }}>
                        Selected: <strong style={{ color: 'var(--text)' }}>{selectedDateLabel}</strong>
                        {staffFilter !== 'any' && selectedFilterStaff ? ` · filtered to ${selectedFilterStaff.name}` : ''}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="small muted">Available times</label>

                {!selectedDate && (
                  <p className="small muted" style={{ marginTop: '0.5rem' }}>
                    Pick a smart calendar date first.
                  </p>
                )}

                {selectedDate && timeSlots.length === 0 && (
                  <p className="small muted" style={{ marginTop: '0.5rem' }}>
                    No free slots are available for this service on the selected date.
                  </p>
                )}

                <div className="reschedule-time-grid">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      onClick={() => {
                        setSelectedTime(slot.time)
                        setSelectedStaffChoice('any')
                      }}
                      style={{
                        padding: '0.65rem',
                        borderRadius: 999,
                        border: selectedTime === slot.time ? '1px solid rgba(255,107,53,0.5)' : '1px solid var(--border)',
                        background: selectedTime === slot.time ? 'var(--accent)' : 'var(--surface-2)',
                        color: selectedTime === slot.time ? 'var(--bg)' : 'var(--text)'
                      }}
                    >
                      <span>{slot.time}</span>
                      {slot.staffIds.length > 1 && (
                        <span style={{ display: 'block', fontSize: '0.68rem', opacity: 0.8 }}>
                          {slot.staffIds.length} available
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="small muted">Staff choice</label>

                {!selectedDate && (
                  <p className="small muted" style={{ marginTop: '0.5rem' }}>
                    Select a date first.
                  </p>
                )}

                {selectedDate && !selectedTime && (
                  <p className="small muted" style={{ marginTop: '0.5rem' }}>
                    Choose a time first, then pick Any available staff or a specific staff member for that exact time.
                  </p>
                )}

                {selectedDate && selectedTime && (
                  <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <div className="card" style={{ background: 'var(--surface-2)', padding: '0.85rem' }}>
                      <p className="small muted">Available for {selectedTime}</p>
                      <strong>
                        {availableStaffForSelectedTime.length === 1
                          ? `${availableStaffForSelectedTime[0].name} is available`
                          : `${availableStaffForSelectedTime.length} staff available`}
                      </strong>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedStaffChoice('any')}
                      style={{
                        textAlign: 'left',
                        padding: '0.85rem',
                        borderRadius: 'var(--radius)',
                        border: selectedStaffChoice === 'any' ? '1px solid rgba(255,107,53,0.55)' : '1px solid var(--border)',
                        background: selectedStaffChoice === 'any' ? 'var(--accent-dim)' : 'var(--surface-2)',
                        color: 'var(--text)'
                      }}
                    >
                      <strong>Any available staff</strong>
                      <p className="small muted" style={{ marginTop: '0.25rem' }}>
                        Mirëbook will assign one of the available staff for this exact time.
                      </p>
                    </button>

                    {availableStaffForSelectedTime.map((staff) => {
                      const isSelected = selectedStaffChoice === staff.id

                      return (
                        <button
                          key={staff.id}
                          type="button"
                          onClick={() => setSelectedStaffChoice(staff.id)}
                          style={{
                            textAlign: 'left',
                            padding: '0.85rem',
                            borderRadius: 'var(--radius)',
                            border: isSelected ? '1px solid rgba(255,107,53,0.55)' : '1px solid var(--border)',
                            background: isSelected ? 'var(--accent-dim)' : 'var(--surface-2)',
                            color: 'var(--text)'
                          }}
                        >
                          <strong>{staff.name}</strong>
                          <p className="small muted">{staff.role_title || 'Staff member'}</p>
                          <p className="small" style={{ color: 'var(--success)', marginTop: '0.25rem' }}>
                            Available at {selectedTime}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={saving || !selectedDate || !selectedTime || !selectedStaffChoice}
                className="btn btn-accent"
              >
                {saving
                  ? role === 'customer' ? 'Sending request...' : 'Saving new time...'
                  : role === 'customer' ? 'Send reschedule request' : 'Save new appointment time'}
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

      <style jsx>{`
        .reschedule-form-card {
          display: grid;
          gap: 1rem;
        }

        .reschedule-time-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(82px, 1fr));
          gap: 0.5rem;
          margin-top: 0.75rem;
        }

        @media (max-width: 520px) {
          .reschedule-calendar-card {
            padding: 0.65rem !important;
          }

          .reschedule-staff-filter-grid {
            grid-template-columns: 1fr !important;
          }

          .reschedule-calendar-weekdays,
          .reschedule-calendar-grid {
            gap: 0.25rem !important;
          }

          .reschedule-calendar-grid button {
            min-height: 40px !important;
            border-radius: 10px !important;
            padding: 0.15rem !important;
          }

          .reschedule-time-grid {
            grid-template-columns: repeat(auto-fill, minmax(74px, 1fr));
          }
        }
      `}</style>
    </main>
  )
}