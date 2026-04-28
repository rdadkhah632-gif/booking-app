import { useEffect, useState } from 'react'
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
}

type UserRole = 'customer' | 'business' | null

export default function BusinessBookingPage() {
  const router = useRouter()
  const { businessId } = router.query

  const [business, setBusiness] = useState<any>(null)
  const [services, setServices] = useState<Service[]>([])
  const [availability, setAvailability] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])

  const [customerUserId, setCustomerUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<UserRole>(null)
  const [authChecked, setAuthChecked] = useState(false)

  const [selectedService, setSelectedService] = useState<Service | null>(null)

  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')

  const [date, setDate] = useState('')
  const [timeSlots, setTimeSlots] = useState<string[]>([])
  const [selectedTime, setSelectedTime] = useState('')

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

      if (profile?.full_name) {
        setCustomerName(profile.full_name)
      }

      if (profile?.phone) {
        setCustomerPhone(profile.phone)
      }

      if (profile?.role === 'business') {
        setUserRole('business')
      } else {
        setUserRole('customer')
      }

      setAuthChecked(true)
    }

    getCustomerSession()
  }, [])

  useEffect(() => {
    if (!businessId || Array.isArray(businessId)) return

    async function load() {
      setPageLoading(true)
      setError(null)

      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .eq('published', true)
        .single()

      if (businessError) {
        setError(businessError.message)
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
        .select('*')
        .eq('business_id', businessId)
        .eq('status', 'confirmed')

      setBookings(bookingsData || [])
      setPageLoading(false)
    }

    load()
  }, [businessId])

  function generateTimeSlots() {
    if (!date || !selectedService) {
      setTimeSlots([])
      return
    }

    const selectedDate = new Date(date)
    const day = selectedDate.getDay()

    const dayAvailability = availability.find(a => a.day_of_week === day)

    if (!dayAvailability || dayAvailability.is_closed) {
      setTimeSlots([])
      return
    }

    const slots: string[] = []

    let start = new Date(`${date}T${dayAvailability.start_time}`)
    const end = new Date(`${date}T${dayAvailability.end_time}`)

    while (start.getTime() + selectedService.duration_minutes * 60000 <= end.getTime()) {
      const slotStart = new Date(start)
      const slotEnd = new Date(start.getTime() + selectedService.duration_minutes * 60000)
      const timeString = slotStart.toTimeString().slice(0, 5)

      const overlapsBooking = bookings.some(b => {
        const bookingStart = new Date(b.start_at)
        const bookingEnd = b.end_at
          ? new Date(b.end_at)
          : new Date(bookingStart.getTime() + b.duration_minutes * 60000)

        return slotStart < bookingEnd && slotEnd > bookingStart
      })

      if (!overlapsBooking) {
        slots.push(timeString)
      }

      start = new Date(start.getTime() + selectedService.duration_minutes * 60000)
    }

    setTimeSlots(slots)
  }

  useEffect(() => {
    generateTimeSlots()
  }, [date, selectedService, availability, bookings])

  async function createBooking(e: React.FormEvent) {
    e.preventDefault()

    if (!authChecked) return

    if (!customerUserId || userRole !== 'customer') {
      setError(`Please login or create a customer account to book with ${business?.name || 'this business'}.`)
      return
    }

    if (!businessId || Array.isArray(businessId) || !selectedService) return

    setLoading(true)
    setError(null)

    const startAt = new Date(`${date}T${selectedTime}:00`).toISOString()

    const { error } = await supabase
      .from('bookings')
      .insert({
        business_id: businessId,
        service_id: selectedService.id,
        customer_user_id: customerUserId,
        customer_name: customerName,
        customer_email: customerEmail.trim().toLowerCase(),
        customer_phone: customerPhone,
        start_at: startAt,
        duration_minutes: selectedService.duration_minutes,
        status: 'confirmed'
      })

    setLoading(false)

    if (error) {
      if (error.message.includes('prevent_overlapping_bookings')) {
        setError('This time slot has just been booked. Please choose another.')
      } else {
        setError(error.message)
      }
      return
    }

    const { data: latestBooking } = await supabase
  .from('bookings')
  .select('id')
  .eq('business_id', businessId)
  .eq('customer_user_id', customerUserId)
  .eq('start_at', startAt)
  .order('created_at', { ascending: false })
  .limit(1)
  .single()

if (latestBooking?.id) {
  router.push(`/booking-confirmation?id=${latestBooking.id}`)
} else {
  router.push('/my-bookings')
}
  }

  if (pageLoading) {
    return (
      <main>
        <AuthNav />
        <section className="page-shell">
          <div className="container">
            <p className="muted">Loading booking page...</p>
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
            <p className="page-sub">This business may be hidden or unavailable.</p>
            <Link href="/explore" className="btn btn-accent" style={{ marginTop: '1rem' }}>
              Back to explore
            </Link>
          </div>
        </section>
      </main>
    )
  }

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
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
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

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 420px',
          gap: '2rem',
          alignItems: 'start',
          marginTop: '1.5rem'
        }}>
          <section>
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div style={{
                display: 'flex',
                gap: '1rem',
                alignItems: 'center',
                marginBottom: '1rem'
              }}>
                <div style={{
                  width: 86,
                  height: 86,
                  borderRadius: 22,
                  background: 'var(--accent-dim)',
                  border: '1px solid rgba(255,107,53,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2.2rem'
                }}>
                  {business.category?.toLowerCase().includes('dent') ? '🦷' :
                    business.category?.toLowerCase().includes('barber') ? '💈' :
                    business.category?.toLowerCase().includes('salon') ? '✂️' :
                    '✨'}
                </div>

                <div>
                  <h1 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '2rem',
                    lineHeight: 1.1
                  }}>
                    {business.name}
                  </h1>

                  {business.category && (
                    <p className="small" style={{ color: 'var(--accent)' }}>
                      {business.category}
                    </p>
                  )}

                  <p className="muted small">
                    {[business.address, business.city, business.country].filter(Boolean).join(', ') || 'Location not added'}
                  </p>
                </div>
              </div>

              <p className="muted">
                {business.description || 'Book available appointments with this business.'}
              </p>

              {business.phone && (
                <p className="small muted" style={{ marginTop: '0.75rem' }}>
                  Phone: {business.phone}
                </p>
              )}
            </div>

            <div className="card">
              <h2 style={{
                fontFamily: 'var(--font-display)',
                marginBottom: '1rem'
              }}>
                Services
              </h2>

              {services.length === 0 && (
                <p className="muted">No services available yet.</p>
              )}

              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {services.map(service => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => {
                      setSelectedService(service)
                      setSelectedTime('')
                    }}
                    style={{
                      textAlign: 'left',
                      background: selectedService?.id === service.id ? 'var(--accent-dim)' : 'var(--surface-2)',
                      border: selectedService?.id === service.id ? '1px solid rgba(255,107,53,0.45)' : '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      padding: '1rem',
                      color: 'var(--text)'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '1rem'
                    }}>
                      <strong>{service.name}</strong>
                      <strong>£{Number(service.price).toFixed(2)}</strong>
                    </div>

                    <p className="small muted">
                      {service.duration_minutes} minutes
                    </p>

                    {service.description && (
                      <p className="small muted" style={{ marginTop: '0.4rem' }}>
                        {service.description}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <aside className="card" style={{
            position: 'sticky',
            top: 96
          }}>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              marginBottom: '0.5rem'
            }}>
              Book appointment
            </h2>

            <p className="small muted" style={{ marginBottom: '1rem' }}>
              Select a service, choose a date, then pick one of the available times.
            </p>

            {!customerUserId && (
              <div className="card" style={{ background: 'var(--surface-2)', marginBottom: '1rem' }}>
                <strong>Login required</strong>
                <p className="small muted" style={{ marginTop: '0.35rem' }}>
                  You can browse services, but you need a customer account to confirm a booking.
                </p>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                  <Link href="/login" className="btn btn-accent">
                    Login
                  </Link>

                  <Link href="/register" className="btn btn-ghost">
                    Register
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
              </div>
            )}

            <form onSubmit={createBooking} className="form-grid">
              <div>
                <label className="small muted">Selected service</label>
                <div className="card" style={{
                  background: 'var(--surface-2)',
                  marginTop: '0.4rem',
                  padding: '0.85rem'
                }}>
                  {selectedService ? (
                    <>
                      <strong>{selectedService.name}</strong>
                      <p className="small muted">
                        {selectedService.duration_minutes} mins · £{Number(selectedService.price).toFixed(2)}
                      </p>
                    </>
                  ) : (
                    <p className="muted small">Choose a service from the list.</p>
                  )}
                </div>
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

              <input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value)
                  setSelectedTime('')
                }}
                required
              />

              <div>
                <label className="small muted">Available times</label>

                {!selectedService && (
                  <p className="small muted" style={{ marginTop: '0.5rem' }}>
                    Select a service first.
                  </p>
                )}

                {selectedService && date && timeSlots.length === 0 && (
                  <p className="small muted" style={{ marginTop: '0.5rem' }}>
                    No slots available for that date.
                  </p>
                )}

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(82px, 1fr))',
                  gap: '0.5rem',
                  marginTop: '0.5rem'
                }}>
                  {timeSlots.map(slot => (
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
                disabled={loading || !selectedService || !selectedTime || !customerUserId || userRole !== 'customer'}
                className="btn btn-accent"
              >
                {loading ? 'Booking...' : 'Confirm booking'}
              </button>
            </form>
          </aside>
        </div>
      </section>
    </main>
  )
}