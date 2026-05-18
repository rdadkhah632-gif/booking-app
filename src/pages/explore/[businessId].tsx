import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AuthNav from '@/components/AuthNav'

type Service = {
  id: string
  name: string
  duration_minutes: number
  price: number
  description?: string | null
  image_url?: string | null
}

type StaffMember = {
  id: string
  name: string
  role_title?: string | null
  image_url?: string | null
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

type Business = {
  id: string
  name: string
  description?: string | null
  category?: string | null
  city?: string | null
  country?: string | null
  phone?: string | null
  address?: string | null
  image_url?: string | null
  auto_accept_bookings?: boolean
  booking_interval_minutes?: number | null
  min_notice_minutes?: number | null
  max_advance_days?: number | null
  buffer_before_minutes?: number | null
  buffer_after_minutes?: number | null
  cancellation_policy?: string | null
  reschedule_policy?: string | null
  timezone?: string | null
  currency?: string | null
}

type Booking = {
  id: string
  staff_member_id: string
  start_at: string
  end_at?: string | null
  duration_minutes: number
  status: string
}

type UserRole = 'customer' | 'business' | null

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

export default function BusinessBookingPage() {
  const router = useRouter()
  const { businessId } = router.query

  const [business, setBusiness] = useState<Business | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [availability, setAvailability] = useState<BusinessAvailability[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])

  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [staffServices, setStaffServices] = useState<StaffService[]>([])
  const [staffAvailability, setStaffAvailability] = useState<StaffAvailability[]>([])

  const [customerUserId, setCustomerUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<UserRole>(null)
  const [authChecked, setAuthChecked] = useState(false)

  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [staffFilter, setStaffFilter] = useState<StaffFilter>('any')
  const [timeSlots, setTimeSlots] = useState<SlotOption[]>([])
  const [selectedTime, setSelectedTime] = useState('')
  const [selectedStaffChoice, setSelectedStaffChoice] = useState<StaffChoice>('any')
  
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })

  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerNote, setCustomerNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function getCustomerSession() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        setAuthChecked(true)
        return
      }

      setCustomerUserId(session.user.id)
      setCustomerEmail(session.user.email || '')

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name, phone')
        .eq('id', session.user.id)
        .single()

      if (profile?.full_name) setCustomerName(profile.full_name)
      if (profile?.phone) setCustomerPhone(profile.phone)

      setUserRole(profile?.role === 'business' ? 'business' : 'customer')
      setAuthChecked(true)
    }

    getCustomerSession()
  }, [])

  async function loadBookingPage() {
    if (!businessId || Array.isArray(businessId)) return

    setPageLoading(true)
    setError(null)

    const { data: businessData, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .eq('published', true)
      .single()

    if (businessError) {
      setError('This business is not currently available for public booking.')
      setPageLoading(false)
      return
    }

    setBusiness(businessData)

    const { data: servicesData, error: servicesError } = await supabase
      .from('services')
      .select('*')
      .eq('business_id', businessId)
      .eq('active', true)
      .order('created_at', { ascending: false })

    if (servicesError) {
      setError(servicesError.message)
      setPageLoading(false)
      return
    }

    setServices(servicesData || [])

    const { data: staffData, error: staffError } = await supabase
      .from('staff_members')
      .select('id, name, role_title, image_url')
      .eq('business_id', businessId)
      .eq('active', true)
      .order('created_at', { ascending: false })

    if (staffError) {
      setError(staffError.message)
      setPageLoading(false)
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
        setPageLoading(false)
        return
      }

      setStaffServices(staffServiceData || [])

      const { data: staffAvailabilityData, error: staffAvailabilityError } = await supabase
        .from('staff_availability')
        .select('staff_member_id, day_of_week, start_time, end_time, is_closed')
        .in('staff_member_id', staffIds)

      if (staffAvailabilityError) {
        setError(staffAvailabilityError.message)
        setPageLoading(false)
        return
      }

      setStaffAvailability(staffAvailabilityData || [])
    } else {
      setStaffServices([])
      setStaffAvailability([])
    }

    const { data: availabilityData, error: availabilityError } = await supabase
      .from('availability')
      .select('*')
      .eq('business_id', businessId)

    if (availabilityError) {
      setError(availabilityError.message)
      setPageLoading(false)
      return
    }

    setAvailability(availabilityData || [])

    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('id, staff_member_id, start_at, end_at, duration_minutes, status')
      .eq('business_id', businessId)
      .in('status', ['pending', 'confirmed'])

    setBookings(bookingsData || [])
    setPageLoading(false)
  }

  useEffect(() => {
    loadBookingPage()
  }, [businessId])

  useEffect(() => {
    function refreshOnFocus() {
      loadBookingPage()
    }

    function refreshWhenActive() {
      if (document.visibilityState === 'visible') {
        loadBookingPage()
      }
    }

    window.addEventListener('focus', refreshOnFocus)
    document.addEventListener('visibilitychange', refreshWhenActive)

    return () => {
      window.removeEventListener('focus', refreshOnFocus)
      document.removeEventListener('visibilitychange', refreshWhenActive)
    }
  }, [businessId])

    function formatDateInputValue(date: Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function sameDate(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
  }

  function monthLabel(date: Date) {
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }

  function moveCalendarMonth(offset: number) {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  function resetCalendarToToday() {
    const today = new Date()
    setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1))
  }

  function normaliseDateValue(date: Date) {
    const cleanDate = new Date(date)
    cleanDate.setHours(0, 0, 0, 0)
    return cleanDate
  }

  function addMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60000)
  }
  function bookingIntervalMinutes() {
    return business?.booking_interval_minutes || 15
  }

  function minNoticeMinutes() {
    return business?.min_notice_minutes || 0
  }

  function maxAdvanceDays() {
    return business?.max_advance_days || 60
  }

  function bufferBeforeMinutes() {
    return business?.buffer_before_minutes || 0
  }

  function bufferAfterMinutes() {
    return business?.buffer_after_minutes || 0
  }

  function currencySymbol() {
    if (business?.currency === 'EUR') return '€'
    if (business?.currency === 'ALL') return 'L'
    if (business?.currency === 'USD') return '$'
    return '£'
  }

  function formatServicePrice(price: number) {
    return `${currencySymbol()}${Number(price || 0).toFixed(2)}`
  }

  function locationLabel() {
    return [business?.address, business?.city, business?.country]
      .filter(Boolean)
      .join(', ') || 'Location details coming soon'
  }

  function heroBackgroundImage() {
    if (!business?.image_url) return undefined
    return `linear-gradient(rgba(11, 18, 32, 0.2), rgba(11, 18, 32, 0.75)), url("${business.image_url}")`
  }

  function serviceImageBackground(service: Service) {
    if (!service.image_url) return undefined
    return `linear-gradient(rgba(11,18,32,0.05), rgba(11,18,32,0.65)), url("${service.image_url}")`
  }

  function bookingModeText() {
    return business?.auto_accept_bookings === false ? 'Booking request' : 'Instant booking'
  }

  function bookingModeDescription() {
    return business?.auto_accept_bookings === false
      ? 'This business reviews new booking requests before confirming them.'
      : 'This business confirms new bookings instantly when you choose an available slot.'
  }

  function businessTimezoneLabel() {
    return business?.timezone || 'local business time'
  }

  function cancellationPolicyText() {
    return business?.cancellation_policy?.trim() || 'Cancellation policy has not been added by this business yet.'
  }

  function reschedulePolicyText() {
    return business?.reschedule_policy?.trim() || 'Reschedule requests can be managed from My Bookings when available.'
  }

  async function createBookingNotifications(bookingId: string | null, bookingStatus: string, startAt: string, staffMemberId: string) {
    if (!business || !businessId || Array.isArray(businessId) || !selectedService || !customerUserId) return

    const appointmentTime = new Date(startAt).toLocaleString()
    const staff = staffMembers.find((member) => member.id === staffMemberId)
    const staffLabel = staff ? staff.name : 'Any available staff'

    await supabase.from('notifications').insert([
      {
        user_id: customerUserId,
        business_id: businessId,
        booking_id: bookingId,
        audience: 'customer',
        type: bookingStatus === 'pending' ? 'booking_requested' : 'booking_confirmed',
        title: bookingStatus === 'pending' ? 'Booking request sent' : 'Booking confirmed',
        message: bookingStatus === 'pending'
          ? `${business.name} will review your ${selectedService.name} booking request for ${appointmentTime}.`
          : `Your ${selectedService.name} booking with ${business.name} is confirmed for ${appointmentTime}.`,
        action_url: bookingId ? `/booking-confirmation?id=${bookingId}` : '/my-bookings'
      },
      {
        business_id: businessId,
        booking_id: bookingId,
        audience: 'business',
        type: bookingStatus === 'pending' ? 'booking_needs_approval' : 'booking_created',
        title: bookingStatus === 'pending' ? 'New booking needs approval' : 'New booking created',
        message: `${customerName.trim() || 'A customer'} booked ${selectedService.name} for ${appointmentTime} with ${staffLabel}.`,
        action_url: `/dashboard/bookings?businessId=${businessId}&date=${selectedDate}`
      }
    ])
  }

  function getServiceStaff(service: Service | null) {
    if (!service) return []

    return staffMembers.filter((staff) =>
      staffServices.some(
        (link) =>
          link.staff_member_id === staff.id &&
          link.service_id === service.id
      )
    )
  }

  function getCandidateStaff(service: Service | null, filter: StaffFilter = staffFilter) {
    const serviceStaff = getServiceStaff(service)
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

  function generateSlotsForStaffOnDate(staffId: string, dateValue: string, service: Service | null) {
    if (!dateValue || !service) return []

    const dayAvailability = getStaffDayAvailabilityForDate(staffId, dateValue)
    if (!dayAvailability || dayAvailability.is_closed) return []

    const slots: string[] = []
    let start = new Date(`${dateValue}T${dayAvailability.start_time}`)
    const end = new Date(`${dateValue}T${dayAvailability.end_time}`)
    const now = new Date()
    const slotIntervalMinutes = bookingIntervalMinutes()
    const earliestBookableTime = addMinutes(now, minNoticeMinutes())
    const maxAdvanceDate = new Date(now)
    maxAdvanceDate.setDate(maxAdvanceDate.getDate() + maxAdvanceDays())
    maxAdvanceDate.setHours(23, 59, 59, 999)
    while (start.getTime() + service.duration_minutes * 60000 <= end.getTime()) {
      const visibleSlotStart = new Date(start)
      const slotStart = addMinutes(visibleSlotStart, -bufferBeforeMinutes())
      const appointmentEnd = addMinutes(visibleSlotStart, service.duration_minutes)
      const slotEnd = addMinutes(appointmentEnd, bufferAfterMinutes())
      const timeString = visibleSlotStart.toTimeString().slice(0, 5)
      const isPastSlot = visibleSlotStart < now
      const isTooSoon = visibleSlotStart < earliestBookableTime
      const isTooFarAhead = visibleSlotStart > maxAdvanceDate

      const overlapsBooking = bookings.some((booking) => {
        if (booking.staff_member_id !== staffId) return false

        const bookingStart = new Date(booking.start_at)
        const bookingEnd = booking.end_at
          ? new Date(booking.end_at)
          : addMinutes(bookingStart, booking.duration_minutes)

        return slotStart < bookingEnd && slotEnd > bookingStart
      })

      if (!isPastSlot && !isTooSoon && !isTooFarAhead && !overlapsBooking) {
        slots.push(timeString)
      }

      start = addMinutes(start, slotIntervalMinutes)
    }

    return slots
  }

  function generateMergedSlots(dateValue: string, service: Service | null, filter: StaffFilter = staffFilter) {
    if (!dateValue || !service) return []

    const mergedSlots = getCandidateStaff(service, filter).reduce<Record<string, string[]>>((acc, staff) => {
      const slots = generateSlotsForStaffOnDate(staff.id, dateValue, service)

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

  function getDayAvailabilitySummary(dateValue: string, service: Service | null, filter: StaffFilter = staffFilter) {
    const slots = generateMergedSlots(dateValue, service, filter)
    const availableStaffIds = Array.from(new Set(slots.flatMap((slot) => slot.staffIds)))

    return {
      availableStaffIds,
      availableSlotCount: slots.length,
      isBookable: slots.length > 0
    }
  }

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
      const availabilitySummary = !isPast && selectedService
        ? getDayAvailabilitySummary(dateString, selectedService, staffFilter)
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
  }, [calendarMonth, selectedService, staffFilter, staffMembers, staffServices, staffAvailability, bookings, business])

  const selectedStaff = useMemo(() => {
    if (selectedStaffChoice === 'any') return null
    return staffMembers.find((staff) => staff.id === selectedStaffChoice) || null
  }, [staffMembers, selectedStaffChoice])

  const selectedFilterStaff = useMemo(() => {
    if (staffFilter === 'any') return null
    return staffMembers.find((staff) => staff.id === staffFilter) || null
  }, [staffMembers, staffFilter])

  const selectableStaff = useMemo(() => {
    return getServiceStaff(selectedService)
  }, [selectedService, staffMembers, staffServices])

  const availableStaffForSelectedTime = useMemo(() => {
    if (!selectedTime) return []

    const selectedSlot = timeSlots.find((slot) => slot.time === selectedTime)
    if (!selectedSlot) return []

    return selectableStaff.filter((staff) => selectedSlot.staffIds.includes(staff.id))
  }, [selectedTime, timeSlots, selectableStaff])

  const bookableServiceCount = services.filter((service) =>
    staffServices.some((link) => link.service_id === service.id)
  ).length
const visibleServices = useMemo(() => {
  return services.map((service) => {
    const assignedStaffCount = staffServices.filter((link) => link.service_id === service.id).length

    return {
      service,
      assignedStaffCount,
      isBookable: assignedStaffCount > 0
    }
  })
}, [services, staffServices])

const setupIssueMessages = useMemo(() => {
  const issues: string[] = []

  if (services.length === 0) issues.push('No active services are available yet.')
  if (staffMembers.length === 0) issues.push('No active staff are available yet.')
  if (availability.filter((row) => row.is_closed !== true).length === 0) issues.push('No working hours are available yet.')
  if (bookableServiceCount === 0 && services.length > 0) issues.push('Services are visible but not assigned to staff yet.')

  return issues
}, [services, staffMembers, availability, bookableServiceCount])

  function businessIcon() {
    if (business?.category?.toLowerCase().includes('dent')) return '🦷'
    if (business?.category?.toLowerCase().includes('barber')) return '💈'
    if (business?.category?.toLowerCase().includes('salon')) return '✂️'
    if (business?.category?.toLowerCase().includes('restaurant')) return '🍽️'
    return '✨'
  }

  // useEffect for time slots
  useEffect(() => {
    if (!selectedDate || !selectedService) {
      setTimeSlots([])
      return
    }

    const slots = generateMergedSlots(selectedDate, selectedService, staffFilter)
    setTimeSlots(slots)

    if (selectedTime && !slots.some((slot) => slot.time === selectedTime)) {
      setSelectedTime('')
      setSelectedStaffChoice('any')
    }
  }, [selectedDate, selectedService, staffFilter, staffAvailability, bookings, selectableStaff, business])

  function staffForSlot(slotTime: string) {
    const slot = timeSlots.find((item) => item.time === slotTime)
    if (!slot) return []

    return selectableStaff.filter((staff) => slot.staffIds.includes(staff.id))
  }

  function resolveStaffForBooking() {
    const slot = timeSlots.find((item) => item.time === selectedTime)
    if (!slot) return ''

    if (selectedStaffChoice !== 'any') {
      return slot.staffIds.includes(selectedStaffChoice) ? selectedStaffChoice : ''
    }

    return slot.staffIds[0] || ''
  }

  function selectedStaffSummary() {
    if (!selectedTime) {
      if (staffFilter === 'any') return 'Staff choice appears after choosing a time'
      return selectedFilterStaff ? `Only showing slots with ${selectedFilterStaff.name}` : 'Choose a time to pick staff'
    }

    const staffForSelectedSlot = staffForSlot(selectedTime)

    if (selectedStaffChoice === 'any') {
      if (staffForSelectedSlot.length === 0) return 'Any available staff'

      return staffForSelectedSlot.length === 1
        ? `Assigned automatically: ${staffForSelectedSlot[0].name}`
        : `Any available staff · ${staffForSelectedSlot.length} staff can do this time`
    }

    return selectedStaff ? `Staff: ${selectedStaff.name}` : 'No staff selected'
  }

  async function createBooking(e: React.FormEvent) {
    e.preventDefault()

    if (!authChecked) return

    if (!customerUserId || userRole !== 'customer') {
      setError(`Please login or create a customer account to book with ${business?.name || 'this business'}.`)
      return
    }

    if (!businessId || Array.isArray(businessId) || !selectedService || !selectedTime) return

    const staffMemberIdForBooking = resolveStaffForBooking()

    if (!staffMemberIdForBooking) {
      setError('Please choose Any available staff or one of the staff available for this time.')
      return
    }

    setLoading(true)
    setError(null)

    const freshSlots = generateSlotsForStaffOnDate(staffMemberIdForBooking, selectedDate, selectedService)

    if (!freshSlots.includes(selectedTime)) {
      setLoading(false)
      setError('This time is no longer available. Please choose another slot.')
      setSelectedTime('')
      return
    }

    const startAt = new Date(`${selectedDate}T${selectedTime}:00`).toISOString()
    const bookingStatus = business?.auto_accept_bookings === false ? 'pending' : 'confirmed'

    const { data: createdBooking, error } = await supabase
      .from('bookings')
      .insert({
        business_id: businessId,
        service_id: selectedService.id,
        staff_member_id: staffMemberIdForBooking,
        customer_user_id: customerUserId,
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim().toLowerCase(),
        customer_phone: customerPhone.trim() || null,
        customer_notes: customerNote.trim() || null,
        start_at: startAt,
        duration_minutes: selectedService.duration_minutes,
        status: bookingStatus
      })
      .select('id')
      .single()

    setLoading(false)

    if (error) {
      if (error.message.includes('prevent_overlapping_bookings')) {
        setError('This time slot has just been booked. Please choose another.')
      } else {
        setError(error.message)
      }
      await loadBookingPage()
      return
    }

    await createBookingNotifications(createdBooking?.id || null, bookingStatus, startAt, staffMemberIdForBooking)

    if (createdBooking?.id) {
      router.push(`/booking-confirmation?id=${createdBooking.id}`)
    } else {
      router.push(bookingStatus === 'pending' ? '/my-bookings?bookingRequested=1' : '/my-bookings')
    }
  }
  if (pageLoading) {
    return (
      <main>
        <AuthNav />
        <section className="page-shell">
          <div className="container">
            <p className="muted">Loading Mirëbook booking page...</p>
          </div>
        </section>
      </main>
    )
  }

  if (!business) {
    return (
      <main>
        <AuthNav />
        <section className="page-shell">
          <div className="container">
            <h1 className="page-title">Business not found</h1>
            <p className="page-sub">This business may be hidden, unpublished or unavailable.</p>
            <Link href="/explore" className="btn btn-accent" style={{ marginTop: '1rem' }}>
              Back to Mirëbook marketplace
            </Link>

            <Link href="/support/customer" className="btn btn-ghost" style={{ marginTop: '1rem', marginLeft: '0.75rem' }}>
              Customer support
            </Link>
          </div>
        </section>
      </main>
    )
  }

  const selectedDateLabel = selectedDate
    ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
    : ''

  const canSubmit = Boolean(
    selectedService &&
    selectedDate &&
    selectedTime &&
    selectedStaffChoice &&
    customerUserId &&
    userRole === 'customer'
  )

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ padding: '36px 24px 70px' }}>
        <Link href="/explore" className="muted small">
          ← Back to results
        </Link>

            {error && (
              <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)', marginTop: '1rem' }}>
                <p style={{ color: 'var(--danger)' }}>{error}</p>

                {(!customerUserId || userRole !== 'customer') && (
                  <div className="booking-action-row">
                    <Link href="/login" className="btn btn-accent">
                      Login to book
                    </Link>

                    <Link href="/register" className="btn btn-ghost">
                      Create customer account
                    </Link>
                  </div>
                )}
              </div>
            )}

        <div className="card" style={{ marginTop: '1.5rem', overflow: 'hidden', padding: 0 }}>
          {business.image_url ? (
            <div
              style={{
                minHeight: 210,
                backgroundImage: heroBackgroundImage(),
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                display: 'flex',
                alignItems: 'flex-end',
                padding: '1.5rem'
              }}
            >
              <div>
                <p className="small" style={{ color: 'var(--accent)' }}>
                  {business.category || 'Bookable business'}
                </p>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', lineHeight: 1.05 }}>
                  {business.name}
                </h1>
              </div>
            </div>
          ) : (
            <div
              style={{
                minHeight: 190,
                background: 'linear-gradient(135deg, rgba(255,107,53,0.18), rgba(45,212,191,0.10))',
                display: 'flex',
                alignItems: 'flex-end',
                padding: '1.5rem'
              }}
            >
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div
                  style={{
                    width: 82,
                    height: 82,
                    borderRadius: 22,
                    background: 'var(--accent-dim)',
                    border: '1px solid rgba(255,107,53,0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2.1rem'
                  }}
                >
                  {businessIcon()}
                </div>

                <div>
                  <p className="small" style={{ color: 'var(--accent)' }}>
                    {business.category || 'Bookable business'}
                  </p>
                  <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', lineHeight: 1.05 }}>
                    {business.name}
                  </h1>
                </div>
              </div>
            </div>
          )}

          <div style={{ padding: '1.25rem 1.5rem' }}>
            <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
              <span
                className="small"
                style={{
                  background: business.auto_accept_bookings === false ? 'rgba(255,107,53,0.12)' : 'rgba(45,212,191,0.12)',
                  color: business.auto_accept_bookings === false ? 'var(--accent)' : 'var(--success)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: 999
                }}
              >
                {business.auto_accept_bookings === false ? 'Manual approval' : 'Instant confirmation'}
              </span>

              <span
                className="small"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: 999,
                  border: '1px solid var(--border)'
                }}
              >
                {bookableServiceCount} bookable service{bookableServiceCount === 1 ? '' : 's'}
              </span>

              <span
                className="small"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: 999,
                  border: '1px solid var(--border)'
                }}
              >
                Availability-based slots
              </span>

              <span
                className="small"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: 999,
                  border: '1px solid var(--border)'
                }}
              >
                No customer checkout yet
              </span>
            </div>

            <p className="muted">
              {business.description || 'Book available appointments through Mirëbook. Customers can request or confirm appointments without a Mirëbook checkout step.'}
            </p>

            <div style={{ display: 'grid', gap: '0.4rem', marginTop: '1rem' }}>
              <p className="small muted">
                {locationLabel()}
              </p>

              {business.phone && (
                <p className="small muted">
                  Phone: {business.phone}
                </p>
              )}

              <p className="small muted">
                Booking mode: {bookingModeText()} · {bookingModeDescription()}
              </p>

              <p className="small muted">
                Times shown in {businessTimezoneLabel()} · {bookingIntervalMinutes()} minute slot grid
              </p>
            </div>
          </div>
        </div>

        {setupIssueMessages.length > 0 && (
          <div className="card" style={{ borderColor: 'rgba(255,190,11,0.3)', background: 'rgba(255,190,11,0.06)', marginTop: '1rem' }}>
            <p className="small" style={{ color: 'var(--warning)' }}>Limited booking setup</p>
            <h3 style={{ marginTop: '0.25rem' }}>Some booking information is not ready yet</h3>
            <ul style={{ marginTop: '0.75rem', paddingLeft: '1.2rem', color: 'var(--text-muted)' }}>
              {setupIssueMessages.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
            <div className="booking-action-row compact">
              <Link href="/support/customer" className="btn btn-ghost">
                Customer support
              </Link>
              <Link href="/explore" className="btn btn-ghost">
                Back to marketplace
              </Link>
            </div>
          </div>
        )}

       <div className="booking-page-grid">
          <section>
            <div className="card">
              <div className="booking-section-heading">
                <div>
                  <p className="small muted">Step 1</p>
                  <h2 style={{ fontFamily: 'var(--font-display)' }}>
                    Choose a service
                  </h2>
                </div>

                {selectedService && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setSelectedService(null)
                      setSelectedDate('')
                      setStaffFilter('any')
                      setSelectedStaffChoice('any')
                      setSelectedTime('')
                    }}
                  >
                    Change service
                  </button>
                )}
              </div>

              {services.length === 0 && (
                <div className="card" style={{ background: 'var(--surface-2)' }}>
                  <h3>No services available yet</h3>
                  <p className="muted" style={{ marginTop: '0.35rem' }}>
                    This business is published, but it does not have active services ready for booking yet.
                  </p>
                </div>
              )}

              <div style={{ display: 'grid', gap: '0.75rem' }}>
               {visibleServices.map(({ service, assignedStaffCount, isBookable }) => {
  const isSelected = selectedService?.id === service.id

  return (
    <button
      key={service.id}
      type="button"
      disabled={!isBookable}
      onClick={() => {
        if (!isBookable) return
        setSelectedService(service)
        setSelectedDate('')
        setStaffFilter('any')
        setSelectedStaffChoice('any')
        setSelectedTime('')
      }}
                      style={{
                        textAlign: 'left',
                        background: isSelected ? 'var(--accent-dim)' : 'var(--surface-2)',
                        border: isSelected ? '1px solid rgba(255,107,53,0.45)' : '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        padding: service.image_url ? 0 : '1rem',
                        color: 'var(--text)',
                        overflow: 'hidden',
opacity: isBookable ? 1 : 0.55,
cursor: isBookable ? 'pointer' : 'not-allowed'
                      }}
                    >
                      {service.image_url && (
                        <div
                          style={{
                            minHeight: 120,
                            backgroundImage: serviceImageBackground(service),
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                          }}
                        />
                      )}

                      <div style={{ padding: service.image_url ? '1rem' : 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                          <strong>{service.name}</strong>
                          <strong>{formatServicePrice(service.price)}</strong>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.55rem' }}>
                          <span className="small muted">{service.duration_minutes} minutes</span>
                          <span className="small muted">{assignedStaffCount} staff member{assignedStaffCount === 1 ? '' : 's'}</span>
                        </div>

                        {service.description && (
                          <p className="small muted" style={{ marginTop: '0.55rem' }}>
                            {service.description}
                          </p>
                        )}

                        {assignedStaffCount === 0 && (
                          <p className="small" style={{ color: 'var(--warning)', marginTop: '0.55rem' }}>
                            Not bookable yet — this business still needs to assign staff to this service.
                          </p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

         <aside className="card booking-summary-panel">
            <div style={{ marginBottom: '1rem' }}>
              <p className="small muted">Book with {business.name}</p>
              <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: '0.35rem' }}>
                {business.auto_accept_bookings === false ? 'Request appointment' : 'Book appointment'}
              </h2>
              <p className="small muted">
                Mirëbook only shows days and times that can actually be booked. Choose a service, pick a date, select a time, then choose Any available staff or a specific person. Customers do not pay through Mirëbook at booking.
              </p>
            </div>

            <div
              className="card"
              style={{
                background: business.auto_accept_bookings === false ? 'rgba(255,107,53,0.08)' : 'rgba(45,212,191,0.06)',
                borderColor: business.auto_accept_bookings === false ? 'rgba(255,107,53,0.28)' : 'rgba(45,212,191,0.22)',
                marginBottom: '1rem',
                padding: '0.85rem'
              }}
            >
              <p className="small" style={{ color: business.auto_accept_bookings === false ? 'var(--accent)' : 'var(--success)' }}>
                {bookingModeText()}
              </p>
              <p className="small muted" style={{ marginTop: '0.35rem' }}>
                {bookingModeDescription()}
              </p>
            </div>

            {!customerUserId && (
              <div className="card" style={{ background: 'var(--surface-2)', marginBottom: '1rem' }}>
                <strong>Login required</strong>
                <p className="small muted" style={{ marginTop: '0.35rem' }}>
                  You can browse services, but you need a customer account to request or confirm a booking.
                </p>

                <div className="booking-action-row compact">
                  <Link href="/login" className="btn btn-accent">
                    Login
                  </Link>

                  <Link href="/register" className="btn btn-ghost">
                    Register
                  </Link>

                  <Link href="/support/customer" className="btn btn-ghost">
                    Help
                  </Link>
                </div>
              </div>
            )}

            {userRole === 'business' && (
              <div className="card" style={{ background: 'var(--surface-2)', marginBottom: '1rem' }}>
                <strong>Business account detected</strong>
                <p className="small muted" style={{ marginTop: '0.35rem' }}>
                  Business accounts manage bookings from the dashboard. Use a customer account to book appointments.
                </p>

                <Link href="/dashboard" className="btn btn-accent" style={{ marginTop: '0.75rem' }}>
                  Go to dashboard
                </Link>

                <Link href="/support/business" className="btn btn-ghost" style={{ marginTop: '0.75rem', marginLeft: '0.5rem' }}>
                  Business support
                </Link>
              </div>
            )}

            <form onSubmit={createBooking} className="form-grid">
              <div>
                <label className="small muted">Selected service</label>
                <div className="card" style={{ background: 'var(--surface-2)', marginTop: '0.4rem', padding: '0.85rem' }}>
                  {selectedService ? (
                    <>
                      <strong>{selectedService.name}</strong>
                      <p className="small muted">
                        {selectedService.duration_minutes} mins · {formatServicePrice(selectedService.price)}
                      </p>
                    </>
                  ) : (
                    <p className="muted small">Choose a service from the list.</p>
                  )}
                </div>
              </div>

              <div>
                <label className="small muted">Smart calendar</label>

                {!selectedService && (
                  <p className="small muted" style={{ marginTop: '0.5rem' }}>
                    Select a service first to see bookable days.
                  </p>
                )}

                {selectedService && selectableStaff.length === 0 && (
                  <p className="small muted" style={{ marginTop: '0.5rem' }}>
                    This service is not bookable yet because no staff are assigned.
                  </p>
                )}

                {selectedService && selectableStaff.length > 0 && (
                  <div className="card booking-calendar-card" style={{ background: 'var(--surface-2)', padding: '0.9rem', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <button type="button" onClick={() => moveCalendarMonth(-1)} className="btn btn-ghost" style={{ padding: '0.5rem 0.7rem' }}>
                        ←
                      </button>

                      <div style={{ textAlign: 'center' }}>
                        <strong>{monthLabel(calendarMonth)}</strong>
                        <p className="small muted">Unavailable days are disabled automatically · {businessTimezoneLabel()}</p>
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
                      <div className="booking-staff-filter-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', marginTop: '0.45rem' }}>
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

                    <div className="booking-calendar-weekdays" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.35rem', marginBottom: '0.35rem' }}>
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                        <p key={day} className="small muted" style={{ textAlign: 'center', fontWeight: 700 }}>
                          {day}
                        </p>
                      ))}
                    </div>

                    <div className="booking-calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '0.35rem' }}>
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
                      </p>
                    )}

                    <p className="small muted" style={{ marginTop: '0.45rem' }}>
                      Booking rules: {minNoticeMinutes() > 0 ? `${Math.round(minNoticeMinutes() / 60)}h minimum notice` : 'no minimum notice'} · up to {maxAdvanceDays()} days ahead
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="small muted">Staff choice</label>

                {!selectedService && (
                  <p className="small muted" style={{ marginTop: '0.5rem' }}>
                    Select a service first.
                  </p>
                )}

                {selectedService && !selectedDate && (
                  <p className="small muted" style={{ marginTop: '0.5rem' }}>
                    Select a bookable date first. Staff choice appears after you choose a time.
                  </p>
                )}

                {selectedService && selectedDate && !selectedTime && (
                  <p className="small muted" style={{ marginTop: '0.5rem' }}>
                    Choose an available time, then pick Any available staff or a specific person for that exact time.
                  </p>
                )}

                {selectedService && selectedDate && selectedTime && (
                  <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <div
                      className="card"
                      style={{
                        background: 'var(--surface-2)',
                        padding: '0.85rem'
                      }}
                    >
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

              <div>
                <label className="small muted">Available times</label>

                {selectedDateLabel && selectedService && (
                  <p className="small muted" style={{ marginTop: '0.25rem' }}>
                    {selectedDateLabel} · {staffFilter === 'any' ? 'All available staff' : selectedFilterStaff ? `filtered to ${selectedFilterStaff.name}` : 'Filtered staff'}
                  </p>
                )}

                {selectedService && !selectedDate && (
                  <p className="small muted" style={{ marginTop: '0.5rem' }}>
                    Pick a smart calendar date first.
                  </p>
                )}

                {selectedService && selectedDate && timeSlots.length === 0 && (
                  <p className="small muted" style={{ marginTop: '0.5rem' }}>
                    No free slots for this selection on this date.
                  </p>
                )}

               <div className="booking-time-grid">
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

              <div className="card" style={{ background: 'var(--surface-2)', padding: '0.85rem' }}>
                <p className="small muted">Summary</p>
                <p className="small muted" style={{ marginTop: '0.4rem' }}>
                  {selectedService ? `${selectedService.name} · ${selectedService.duration_minutes} mins · ${formatServicePrice(selectedService.price)}` : 'No service selected'}
                </p>
                <p className="small muted">
                  {selectedDateLabel || 'No date selected'}{selectedTime ? ` · ${selectedTime}` : ''}
                </p>
                <p className="small muted">
                  {selectedStaffSummary()}
                </p>
                <p className="small muted">
                  {business.auto_accept_bookings === false ? 'This will be sent as a booking request.' : 'This will be confirmed instantly if the slot is still available.'}
                </p>
              </div>

              <div className="card" style={{ background: 'var(--surface-2)', padding: '0.85rem' }}>
                <p className="small muted">Business policies</p>
                <p className="small muted" style={{ marginTop: '0.4rem' }}>
                  Cancellation: {cancellationPolicyText()}
                </p>
                <p className="small muted" style={{ marginTop: '0.35rem' }}>
                  Reschedule: {reschedulePolicyText()}
                </p>
              </div>

              <input
                type="text"
                placeholder="Your name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                disabled={!customerUserId || userRole !== 'customer'}
              />

              <input
                type="email"
                placeholder="Your email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                required
                disabled
              />

              <input
                type="tel"
                placeholder="Your phone number"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                disabled={!customerUserId || userRole !== 'customer'}
              />

              <textarea
                placeholder="Optional note for the business"
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                rows={3}
                disabled={!customerUserId || userRole !== 'customer'}
              />

              <button
                type="submit"
                disabled={loading || !canSubmit}
                className="btn btn-accent"
              >
                {loading
                  ? business.auto_accept_bookings === false ? 'Sending request...' : 'Booking...'
                  : business.auto_accept_bookings === false ? 'Send booking request' : 'Confirm appointment'}
              </button>
            </form>
          </aside>
        </div>
     </section>

<style jsx>{`
  .booking-action-row {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
    flex-wrap: wrap;
  }

  .booking-action-row.compact {
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .booking-section-heading {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    align-items: flex-end;
    margin-bottom: 1rem;
  }
  .booking-page-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 430px;
    gap: 2rem;
    align-items: start;
    margin-top: 1.5rem;
  }

  .booking-summary-panel {
    position: sticky;
    top: 96px;
  }

  .booking-time-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(82px, 1fr));
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  @media (max-width: 980px) {
    .booking-page-grid {
      grid-template-columns: 1fr;
    }

    .booking-summary-panel {
      position: static;
    }
  }

  @media (max-width: 520px) {
    .booking-calendar-card {
      padding: 0.65rem !important;
    }

    .booking-staff-filter-grid {
      grid-template-columns: 1fr !important;
    }

    .booking-calendar-weekdays,
    .booking-calendar-grid {
      gap: 0.25rem !important;
    }

    .booking-calendar-grid button {
      min-height: 40px !important;
      border-radius: 10px !important;
      padding: 0.15rem !important;
    }

    .booking-time-grid {
      grid-template-columns: repeat(auto-fill, minmax(74px, 1fr));
    }

    .booking-action-row,
    .booking-section-heading {
      display: grid;
    }

    .booking-action-row :global(.btn),
    .booking-action-row a,
    .booking-action-row button {
      width: 100%;
      justify-content: center;
    }

    .booking-summary-panel input,
    .booking-summary-panel textarea,
    .booking-summary-panel select,
    .booking-summary-panel .btn {
      width: 100%;
    }
  }
`}</style>
</main>
  )
}