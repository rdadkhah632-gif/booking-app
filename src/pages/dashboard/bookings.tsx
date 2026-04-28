import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/DashboardLayout'

type Business = {
  id: string
  name: string
}

type Booking = {
  id: string
  customer_name: string
  customer_email?: string
  customer_phone?: string
  start_at: string
  end_at?: string
  duration_minutes: number
  status: string
  services?: {
    name: string
    price: number
  } | null
}

export default function Bookings() {
  const router = useRouter()
  const { businessId } = router.query

  const [business, setBusiness] = useState<Business | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadBookings() {
    setError(null)
    setPageLoading(true)

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      router.replace('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (!profile || profile.role !== 'business') {
      router.replace('/explore')
      return
    }

    if (!businessId || Array.isArray(businessId)) {
      setBusiness(null)
      setBookings([])
      setPageLoading(false)
      return
    }

    const { data: businessData, error: businessError } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('id', businessId)
      .eq('user_id', session.user.id)
      .single()

    if (businessError || !businessData) {
      setError(businessError?.message || 'Business not found.')
      setBusiness(null)
      setBookings([])
      setPageLoading(false)
      return
    }

    setBusiness(businessData)

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        services (
          name,
          price
        )
      `)
      .eq('business_id', businessData.id)
      .order('start_at', { ascending: true })

    if (error) {
      setError(error.message)
      setPageLoading(false)
      return
    }

    setBookings(data || [])
    setPageLoading(false)
  }

  useEffect(() => {
    if (!router.isReady) return
    loadBookings()
  }, [router.isReady, businessId])

  async function cancelBooking(id: string) {
    const confirmed = confirm('Cancel this booking?')
    if (!confirmed) return

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', id)

    if (error) {
      setError(error.message)
      return
    }

    await loadBookings()
  }

  return (
    <DashboardLayout
      title="Bookings"
      subtitle={business ? `Viewing bookings for ${business.name}` : 'Choose a business from Business Profile first.'}
    >
      {!businessId && (
        <div className="card">
          <h3>No business selected</h3>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            Go to Business Profile and choose View bookings under the business you want to manage.
          </p>
          <button
            className="btn btn-accent"
            style={{ marginTop: '1rem' }}
            onClick={() => router.push('/dashboard/businesses')}
          >
            Go to Business Profile
          </button>
        </div>
      )}

      {pageLoading && (
        <div className="card">
          <p className="muted">Loading bookings...</p>
        </div>
      )}

      {error && (
        <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)', marginBottom: '1rem' }}>
          <p style={{ color: 'var(--danger)' }}>{error}</p>
        </div>
      )}

      {!pageLoading && business && bookings.length === 0 && (
        <div className="card">
          <h3>No bookings yet</h3>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            Customer bookings for this business will appear here.
          </p>
        </div>
      )}

      {!pageLoading && business && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="card"
              style={{
                opacity: booking.status === 'cancelled' ? 0.5 : 1
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <strong>{booking.customer_name}</strong>

                  <p className="small muted">
                    Service: {booking.services?.name || 'No service recorded'}
                  </p>

                  <p className="small muted">
                    Price: £{booking.services?.price ? Number(booking.services.price).toFixed(2) : '0.00'}
                  </p>

                  <p className="small muted">
                    Time: {new Date(booking.start_at).toLocaleString()}
                  </p>

                  <p className="small muted">
                    Duration: {booking.duration_minutes} minutes
                  </p>

                  <p className="small muted">
                    Email: {booking.customer_email || 'Not provided'}
                  </p>

                  <p className="small muted">
                    Phone: {booking.customer_phone || 'Not provided'}
                  </p>

                  <p
                    className="small"
                    style={{
                      color: booking.status === 'cancelled' ? 'var(--warning)' : 'var(--success)'
                    }}
                  >
                    Status: {booking.status}
                  </p>
                </div>

                {booking.status !== 'cancelled' && (
                  <button onClick={() => cancelBooking(booking.id)} className="btn btn-danger">
                    Cancel booking
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}