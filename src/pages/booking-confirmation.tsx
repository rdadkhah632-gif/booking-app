import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AuthNav from '@/components/AuthNav'

type Booking = {
  id: string
  business_id?: string
  customer_name: string
  customer_email?: string
  customer_phone?: string
  start_at: string
  duration_minutes: number
  status: string
  businesses?: {
    id?: string
    user_id?: string
    name: string
    address?: string | null
    city?: string | null
    country?: string | null
    phone?: string | null
  } | null
  services?: {
    name: string
    price: number
  } | null
  staff_members?: {
    name: string
    role_title?: string | null
  } | null
}

export default function BookingConfirmation() {
  const router = useRouter()
  const { id } = router.query

  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<'customer' | 'business' | null>(null)

  useEffect(() => {
    if (!router.isReady) return

    async function loadBooking() {
      setLoading(true)
      setError(null)

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

      setRole(profile?.role === 'business' ? 'business' : 'customer')

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          businesses (
            id,
            name,
            user_id,
            address,
            city,
            country,
            phone
          ),
          services (
            name,
            price
          ),
          staff_members (
            name,
            role_title
          )
        `)
        .eq('id', id)
        .single()

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      const normalisedBooking = {
        ...data,
        businesses: Array.isArray(data.businesses) ? data.businesses[0] || null : data.businesses,
        services: Array.isArray(data.services) ? data.services[0] || null : data.services,
        staff_members: Array.isArray(data.staff_members) ? data.staff_members[0] || null : data.staff_members
      }

      const isCustomerOwner = normalisedBooking.customer_user_id === session.user.id
      const isBusinessOwner = normalisedBooking.businesses?.user_id === session.user.id

      if (!isCustomerOwner && !isBusinessOwner) {
        setError('You do not have permission to view this booking.')
        setLoading(false)
        return
      }

      setBooking(normalisedBooking)
      setLoading(false)
    }

    loadBooking()
  }, [router.isReady, id])

  function statusLabel(status: string) {
    if (status === 'pending') return 'Booking request sent'
    if (status === 'confirmed') return 'Confirmed appointment'
    if (status === 'completed') return 'Completed appointment'
    if (status === 'cancelled') return 'Cancelled booking'
    return status
  }

  function statusColor(status: string) {
    if (status === 'pending') return 'var(--accent)'
    if (status === 'confirmed') return 'var(--success)'
    if (status === 'completed') return 'var(--accent)'
    if (status === 'cancelled') return 'var(--warning)'
    return 'var(--text-muted)'
  }

  function statusBackground(status: string) {
    if (status === 'pending') return 'rgba(255,107,53,0.12)'
    if (status === 'confirmed') return 'rgba(45,212,191,0.12)'
    if (status === 'completed') return 'rgba(255,107,53,0.12)'
    if (status === 'cancelled') return 'rgba(255,190,11,0.12)'
    return 'var(--surface-2)'
  }

  function primaryHeading() {
    if (booking?.status === 'pending') return 'Your booking request was sent.'
    if (booking?.status === 'confirmed') return 'Your appointment is confirmed.'
    if (booking?.status === 'completed') return 'This appointment is completed.'
    if (booking?.status === 'cancelled') return 'This booking is cancelled.'
    return 'Booking received.'
  }

  function leadCopy() {
    if (booking?.status === 'pending') {
      return `Your request has been sent to ${booking.businesses?.name || 'this business'} for approval. Your appointment is not confirmed until the business accepts it.`
    }

    if (booking?.status === 'confirmed') {
      return `Your booking is confirmed with ${booking?.businesses?.name || 'this business'}. You can view, cancel or request a reschedule from My Bookings.`
    }

    if (booking?.status === 'completed') {
      return 'This appointment has been marked as completed. You can still view it in your booking history.'
    }

    if (booking?.status === 'cancelled') {
      return 'This booking is no longer active. You can browse other available services from Explore.'
    }

    return 'Your booking details are below.'
  }

  function isPendingApproval() {
    return booking?.status === 'pending'
  }

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ padding: '42px 24px 80px' }}>
        {loading && (
          <div className="card">
            <p className="muted">Loading booking confirmation...</p>
          </div>
        )}

        {error && (
          <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)' }}>
            <h1 className="page-title">Could not load booking</h1>
            <p style={{ color: 'var(--danger)', marginTop: '0.75rem' }}>{error}</p>
            <Link href="/my-bookings" className="btn btn-accent" style={{ marginTop: '1rem' }}>
              Go to my bookings
            </Link>
          </div>
        )}

        {!loading && !error && booking && (
          <div style={{
            maxWidth: 760,
            margin: '0 auto',
            display: 'grid',
            gap: '1rem'
          }}>
            <div className="card" style={{
              textAlign: 'center',
              padding: '2.2rem'
            }}>
              <div style={{
                width: 72,
                height: 72,
                borderRadius: 999,
                background: statusBackground(booking.status),
                color: statusColor(booking.status),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                margin: '0 auto 1rem'
              }}>
                {booking.status === 'pending' ? '…' : booking.status === 'cancelled' ? '!' : '✓'}
              </div>

              <p className="small" style={{ color: statusColor(booking.status) }}>
                {statusLabel(booking.status)}
              </p>

              <h1 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '2.4rem',
                marginTop: '0.35rem'
              }}>
                {primaryHeading()}
              </h1>

              <p className="muted" style={{ marginTop: '0.75rem' }}>
                {leadCopy()}
              </p>
            </div>

            <div
              className="card"
              style={{
                borderColor: isPendingApproval() ? 'rgba(255,107,53,0.28)' : 'rgba(45,212,191,0.28)',
                background: isPendingApproval() ? 'rgba(255,107,53,0.06)' : 'rgba(45,212,191,0.06)'
              }}
            >
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 999,
                    background: isPendingApproval() ? 'rgba(255,107,53,0.12)' : 'rgba(45,212,191,0.12)',
                    color: isPendingApproval() ? 'var(--accent)' : 'var(--success)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    flexShrink: 0
                  }}
                >
                  {isPendingApproval() ? '!' : '✓'}
                </div>

                <div>
                  <strong>
                    {booking.status === 'pending'
                      ? 'Waiting for business approval'
                      : booking.status === 'confirmed'
                        ? 'What happens next?'
                        : booking.status === 'completed'
                          ? 'Appointment completed'
                          : 'Booking no longer active'}
                  </strong>
                  <p className="small muted" style={{ marginTop: '0.35rem' }}>
                    {booking.status === 'pending'
                      ? 'The business needs to approve this booking request before it becomes a confirmed appointment. You can track the request from My Bookings or Notifications.'
                      : booking.status === 'confirmed'
                        ? 'This appointment is currently confirmed. If you need to change it, request a new time from My Bookings and the business will review it.'
                        : booking.status === 'completed'
                          ? 'This appointment is locked as completed and will stay in your booking history.'
                          : 'This booking is cancelled and cannot be changed. You can browse the marketplace to book another appointment.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <h2 style={{ fontFamily: 'var(--font-display)' }}>
                  Appointment details
                </h2>

                <span
                  className="small"
                  style={{
                    background: statusBackground(booking.status),
                    color: statusColor(booking.status),
                    padding: '0.2rem 0.65rem',
                    borderRadius: 999
                  }}
                >
                  {statusLabel(booking.status)}
                </span>
              </div>

              <div style={{ display: 'grid', gap: '0.85rem' }}>
                <div>
                  <p className="small muted">Business</p>
                  <strong>{booking.businesses?.name || 'Business'}</strong>
                </div>

                <div>
                  <p className="small muted">Service</p>
                  <strong>{booking.services?.name || 'Service'}</strong>
                </div>
                <div>
                  <p className="small muted">Staff member</p>
                  <strong>
                    {booking.staff_members?.name || 'Any available staff'}
                    {booking.staff_members?.role_title ? ` — ${booking.staff_members.role_title}` : ''}
                  </strong>
                </div>

                <div
                  style={{
                    padding: '0.9rem',
                    borderRadius: 'var(--radius)',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <p className="small muted">{isPendingApproval() ? 'Requested date and time' : 'Confirmed date and time'}</p>
                  <strong>{new Date(booking.start_at).toLocaleString()}</strong>
                </div>

                <div>
                  <p className="small muted">Duration</p>
                  <strong>{booking.duration_minutes} minutes</strong>
                </div>

                <div>
                  <p className="small muted">Price</p>
                  <strong>£{booking.services?.price ? Number(booking.services.price).toFixed(2) : '0.00'}</strong>
                </div>

                <div>
                  <p className="small muted">Customer</p>
                  <strong>{booking.customer_name}</strong>
                  <p className="small muted">{booking.customer_email}</p>
                  {booking.customer_phone && (
                    <p className="small muted">{booking.customer_phone}</p>
                  )}
                </div>

                <div>
                  <p className="small muted">Location</p>
                  <strong>
                    {[booking.businesses?.address, booking.businesses?.city, booking.businesses?.country]
                      .filter(Boolean)
                      .join(', ') || 'Location not added'}
                  </strong>
                </div>

                {booking.businesses?.phone && (
                  <div>
                    <p className="small muted">Business phone</p>
                    <strong>{booking.businesses.phone}</strong>
                  </div>
                )}

                <div>
                  <p className="small muted">Status</p>
                  <strong style={{ color: statusColor(booking.status) }}>
                    {statusLabel(booking.status)}
                  </strong>
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <Link href="/my-bookings" className="btn btn-accent">
                {isPendingApproval() ? 'Track booking request' : 'View or manage this booking'}
              </Link>

              <Link href="/notifications" className="btn btn-ghost">
                Notifications
              </Link>

              <Link href="/explore" className="btn btn-ghost">
                Explore more businesses
              </Link>

              {role === 'business' && booking.business_id && (
                <Link href={`/dashboard/bookings?businessId=${booking.business_id}`} className="btn btn-ghost">
                  Business bookings
                </Link>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}