import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/router'
import AuthNav from '@/components/AuthNav'
import MyBookingsHeader from '@/components/my-bookings/MyBookingsHeader'
import MyBookingsStats from '@/components/my-bookings/MyBookingsStats'
import MyBookingsEmptyState from '@/components/my-bookings/MyBookingsEmptyState'
import MyBookingsSection from '@/components/my-bookings/MyBookingsSection'
import MyBookingCard from '@/components/my-bookings/MyBookingCard'
import { Booking, BookingRequest } from '@/components/my-bookings/myBookingsTypes'
import { useI18n } from '@/lib/useI18n'

export default function MyBookings() {
  const router = useRouter()
  const { t } = useI18n()

  const [bookings, setBookings] = useState<Booking[]>([])
  const [requests, setRequests] = useState<BookingRequest[]>([])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const pendingSectionRef = useRef<HTMLElement | null>(null)
  const upcomingSectionRef = useRef<HTMLElement | null>(null)
  const changeRequestsSectionRef = useRef<HTMLElement | null>(null)
  const historySectionRef = useRef<HTMLElement | null>(null)

  async function loadBookings(options?: { keepSuccess?: boolean; silent?: boolean }) {
    if (!options?.silent) setLoading(true)
    setError(null)
    if (!options?.keepSuccess) setSuccess(null)

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      router.replace('/login?redirectTo=/my-bookings')
      return
    }

    setEmail(session.user.email || '')

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        businesses ( name ),
        services ( name, price ),
        staff_members ( name, role_title )
      `)
      .eq('customer_user_id', session.user.id)
      .order('start_at', { ascending: true })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const normalisedBookings = (data || []).map((booking: any) => ({
      ...booking,
      businesses: Array.isArray(booking.businesses) ? booking.businesses[0] || null : booking.businesses,
      services: Array.isArray(booking.services) ? booking.services[0] || null : booking.services,
      staff_members: Array.isArray(booking.staff_members) ? booking.staff_members[0] || null : booking.staff_members
    }))

    setBookings(normalisedBookings as Booking[])

    const { data: requestData, error: requestError } = await supabase
      .from('booking_requests')
      .select(`
        id,
        booking_id,
        status,
        requested_start_at,
        requested_duration_minutes,
        response_message,
        created_at,
        requested_staff:staff_members!booking_requests_requested_staff_member_id_fkey (
          name,
          role_title
        )
      `)
      .eq('customer_user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (requestError) {
      setError(requestError.message)
      setLoading(false)
      return
    }

    const normalisedRequests = (requestData || []).map((request: any) => ({
      ...request,
      requested_staff: Array.isArray(request.requested_staff)
        ? request.requested_staff[0] || null
        : request.requested_staff
    }))

    setRequests(normalisedRequests as BookingRequest[])
    setLoading(false)
  }

  useEffect(() => {
    loadBookings()
  }, [])

  useEffect(() => {
    function refreshOnFocus() {
      loadBookings({ silent: true, keepSuccess: true })
    }

    function refreshWhenActive() {
      if (document.visibilityState === 'visible') {
        loadBookings({ silent: true, keepSuccess: true })
      }
    }

    window.addEventListener('focus', refreshOnFocus)
    document.addEventListener('visibilitychange', refreshWhenActive)

    return () => {
      window.removeEventListener('focus', refreshOnFocus)
      document.removeEventListener('visibilitychange', refreshWhenActive)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let refreshTimer: number | null = null

    async function subscribeToBookingUpdates() {
      const { data: { session } } = await supabase.auth.getSession()

      if (cancelled || !session?.user?.id) return

      function queueRefresh() {
        if (refreshTimer) window.clearTimeout(refreshTimer)
        refreshTimer = window.setTimeout(() => {
          loadBookings({ silent: true, keepSuccess: true })
        }, 350)
      }

      const channel = supabase
        .channel(`customer-bookings-${session.user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bookings',
            filter: `customer_user_id=eq.${session.user.id}`
          },
          queueRefresh
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'booking_requests',
            filter: `customer_user_id=eq.${session.user.id}`
          },
          queueRefresh
        )
        .subscribe()

      return channel
    }

    let channelRef: ReturnType<typeof supabase.channel> | null = null

    subscribeToBookingUpdates().then((channel) => {
      if (channel) channelRef = channel
    })

    return () => {
      cancelled = true
      if (refreshTimer) window.clearTimeout(refreshTimer)
      if (channelRef) supabase.removeChannel(channelRef)
    }
  }, [])

  async function createBusinessNotification(booking: Booking, type: string, title: string, message: string) {
    if (!booking.business_id) return

    await supabase.from('notifications').insert({
      business_id: booking.business_id,
      booking_id: booking.id,
      audience: 'business',
      type,
      title,
      message,
      action_url: '/dashboard/notifications'
    })
  }

  async function cancelBooking(booking: Booking) {
    const confirmed = confirm(t('myBookings.confirm.cancel', 'Cancel this booking?'))
    if (!confirmed) return

    setActionLoadingId(booking.id)
    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', booking.id)

    setActionLoadingId(null)

    if (error) {
      setError(error.message)
      return
    }

    setBookings((current) =>
      current.map((item) => item.id === booking.id ? { ...item, status: 'cancelled' } : item)
    )

    await createBusinessNotification(
      booking,
      'booking_cancelled_by_customer',
      t('myBookings.notification.cancelledTitle', 'Customer cancelled booking'),
      `${booking.customer_name || t('publicBusiness.customerFallback', 'A customer')} ${t('myBookings.notification.cancelledWord', 'cancelled their booking for')} ${serviceName(booking)} ${t('publicBusiness.notification.forWord', 'for')} ${new Date(booking.start_at).toLocaleString()}.`
    )

    setSuccess(booking.status === 'pending'
      ? t('myBookings.success.pendingCancelled', 'Booking request cancelled. It is no longer waiting for business approval.')
      : t('myBookings.success.cancelled', 'Booking cancelled. The business has been notified and this booking is now locked as cancelled.')
    )
    await loadBookings({ keepSuccess: true, silent: true })
  }

  function statusLabel(status: string) {
    if (status === 'pending') return t('myBookings.status.waitingApproval', 'Waiting for approval')
    if (status === 'confirmed') return t('dashboardBookings.status.confirmedAppointment', 'Confirmed appointment')
    if (status === 'completed') return t('dashboardBookings.status.completedAppointment', 'Completed appointment')
    if (status === 'cancelled') return t('dashboardBookings.status.cancelledBooking', 'Cancelled booking')
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

  function cardTone(status: string, hasPendingRequest: boolean, mode: 'pending' | 'confirmed' | 'history') {
    if (status === 'pending') {
      return {
        border: 'rgba(255,107,53,0.45)',
        background: 'linear-gradient(135deg, rgba(255,107,53,0.12), rgba(255,107,53,0.04))'
      }
    }

    if (hasPendingRequest && status === 'confirmed') {
      return {
        border: 'rgba(255,107,53,0.45)',
        background: 'linear-gradient(135deg, rgba(255,107,53,0.10), rgba(31,28,44,0.85))'
      }
    }

    if (status === 'completed') {
      return {
        border: 'rgba(45,212,191,0.22)',
        background: 'linear-gradient(135deg, rgba(45,212,191,0.08), rgba(31,28,44,0.72))'
      }
    }

    if (status === 'cancelled') {
      return {
        border: 'rgba(255,190,11,0.22)',
        background: 'linear-gradient(135deg, rgba(255,190,11,0.07), rgba(31,28,44,0.66))'
      }
    }

    if (mode === 'history') {
      return {
        border: 'rgba(255,255,255,0.08)',
        background: 'rgba(31,28,44,0.62)'
      }
    }

    return {
      border: 'var(--border)',
      background: 'var(--surface)'
    }
  }

  function firstRelation<T>(value: T | T[] | null | undefined) {
    return Array.isArray(value) ? value[0] : value
  }

  function businessName(booking: Booking) {
    return firstRelation(booking.businesses)?.name || t('dashboardNotifications.labels.businessFallback', 'Business')
  }

  function serviceName(booking: Booking) {
    return firstRelation(booking.services)?.name || t('myBookings.fallback.serviceNotRecorded', 'Service not recorded')
  }

  function servicePrice(booking: Booking) {
    return Number(firstRelation(booking.services)?.price || 0)
  }

  function staffName(booking: Booking) {
    const staff = firstRelation(booking.staff_members)
    if (!staff) return t('dashboardBookings.card.noStaff', 'Staff not recorded')
    return `${staff.name}${staff.role_title ? ` — ${staff.role_title}` : ''}`
  }

  function requestedStaffName(request: BookingRequest) {
    const staff = firstRelation(request.requested_staff)
    if (!staff) return t('dashboardBookings.card.noStaff', 'Staff not recorded')
    return `${staff.name}${staff.role_title ? ` — ${staff.role_title}` : ''}`
  }

  function lifecycleTitle(booking: Booking, pendingRequest?: BookingRequest) {
    if (booking.status === 'pending') return t('myBookings.lifecycle.waitingTitle', 'Waiting for business approval')
    if (pendingRequest && booking.status === 'confirmed') return t('myBookings.lifecycle.pendingChangeTitle', 'Confirmed appointment with a pending change request')
    if (booking.status === 'confirmed') return t('dashboardBookings.status.confirmedAppointment', 'Confirmed appointment')
    if (booking.status === 'completed') return t('dashboardBookings.status.completedAppointment', 'Completed appointment')
    if (booking.status === 'cancelled') return t('dashboardBookings.status.cancelledBooking', 'Cancelled booking')
    return statusLabel(booking.status)
  }

  function lifecycleCopy(booking: Booking, pendingRequest?: BookingRequest) {
    if (booking.status === 'pending') {
      return t('myBookings.lifecycle.waitingBody', 'This booking is not confirmed yet. The business needs to accept it before it becomes an appointment.')
    }

    if (pendingRequest && booking.status === 'confirmed') {
      return t('myBookings.lifecycle.pendingChangeBody', 'Your original appointment is still confirmed. The new requested time will only replace it if the business accepts your request.')
    }

    if (booking.status === 'confirmed') {
      return t('myBookings.lifecycle.confirmedBody', 'This is your active appointment. You can request a new time or cancel it before it is completed.')
    }

    if (booking.status === 'completed') {
      return t('myBookings.lifecycle.completedBody', 'This appointment is complete and locked. It stays here as part of your booking history.')
    }

    if (booking.status === 'cancelled') {
      return t('myBookings.lifecycle.cancelledBody', 'This booking is cancelled and no longer active.')
    }

    return t('myBookings.lifecycle.defaultBody', 'Booking details are shown below.')
  }

  const pendingRequestByBookingId = useMemo(() => {
    const map: Record<string, BookingRequest> = {}

    requests
      .filter((request) => request.status === 'pending')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .forEach((request) => {
        if (!map[request.booking_id]) {
          map[request.booking_id] = request
        }
      })

    return map
  }, [requests])

  const pendingBookings = useMemo(() => {
    return bookings.filter((booking) => booking.status === 'pending')
  }, [bookings])

  const confirmedUpcomingBookings = useMemo(() => {
    return bookings.filter((booking) =>
      booking.status === 'confirmed' && new Date(booking.start_at) >= new Date()
    )
  }, [bookings])

  const nextConfirmedBooking = useMemo(() => {
    return [...confirmedUpcomingBookings]
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0] || null
  }, [confirmedUpcomingBookings])



  const historyBookings = useMemo(() => {
    return bookings.filter((booking) =>
      booking.status === 'cancelled' ||
      booking.status === 'completed' ||
      (booking.status === 'confirmed' && new Date(booking.start_at) < new Date())
    )
  }, [bookings])

  const pendingRescheduleCount = Object.keys(pendingRequestByBookingId).length

const hasCustomerActions = pendingBookings.length > 0 || pendingRescheduleCount > 0

  function scrollToSection(section: 'pending' | 'upcoming' | 'changes' | 'history') {
    const sectionMap = {
      pending: pendingSectionRef,
      upcoming: upcomingSectionRef,
      changes: changeRequestsSectionRef,
      history: historySectionRef
    }

    const target = sectionMap[section].current
    if (!target) return

    target.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    })
  }

  function statCardStyle(isActive: boolean) {
    return {
      width: '100%',
      textAlign: 'left' as const,
      cursor: isActive ? 'pointer' : 'default',
      borderColor: isActive ? 'rgba(255,107,53,0.35)' : 'var(--border)',
      background: isActive ? 'linear-gradient(135deg, rgba(255,107,53,0.10), rgba(31,28,44,0.72))' : 'var(--surface)',
      color: 'var(--text)'
    }
  }

  function renderBookingCard(booking: Booking, mode: 'pending' | 'confirmed' | 'history') {
    return (
      <MyBookingCard
        key={booking.id}
        booking={booking}
        mode={mode}
        pendingRequest={pendingRequestByBookingId[booking.id]}
        isWorking={actionLoadingId === booking.id}
        onCancel={cancelBooking}
        businessName={businessName}
        serviceName={serviceName}
        servicePrice={servicePrice}
        staffName={staffName}
        requestedStaffName={requestedStaffName}
        lifecycleTitle={lifecycleTitle}
        lifecycleCopy={lifecycleCopy}
        statusLabel={statusLabel}
        statusColor={statusColor}
        statusBackground={statusBackground}
        cardTone={cardTone}
      />
    )
  }

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ padding: '36px 24px 70px' }}>
        <MyBookingsHeader
          email={email}
          loading={loading}
          bookingRequested={router.query.bookingRequested}
          requestSent={router.query.requestSent}
          success={success}
          onClearSuccess={() => setSuccess(null)}
          onRefresh={() => loadBookings({ keepSuccess: true })}
        />

        <MyBookingsStats
          pendingCount={pendingBookings.length}
          upcomingCount={confirmedUpcomingBookings.length}
          changeCount={pendingRescheduleCount}
          historyCount={historyBookings.length}
          onJump={scrollToSection}
          statCardStyle={statCardStyle}
        />

        {error && (
          <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)', marginBottom: '1rem' }}>
            <p style={{ color: 'var(--danger)' }}>{error}</p>
          </div>
        )}

        {loading && (
          <div className="card">
            <p className="muted">{t('myBookings.loading', 'Loading your Mirëbook bookings...')}</p>
          </div>
        )}

        {!loading && bookings.length > 0 && (
          <div className="card my-bookings-command-card">
            <div>
              <p className="small muted">{t('myBookings.command.kicker', 'Customer booking hub')}</p>
              <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                {hasCustomerActions
                  ? t('myBookings.command.actionTitle', 'You have booking updates to track')
                  : nextConfirmedBooking
                    ? t('myBookings.command.nextTitle', 'Your next appointment is coming up')
                    : t('myBookings.command.historyTitle', 'Your bookings are up to date')}
              </h2>
              <p className="small muted" style={{ marginTop: '0.4rem' }}>
                {pendingBookings.length > 0
                  ? t('myBookings.command.pendingBody', 'Some booking requests are waiting for the business to approve them.')
                  : pendingRescheduleCount > 0
                    ? t('myBookings.command.changeBody', 'You have requested booking changes waiting for business approval.')
                    : nextConfirmedBooking
                      ? `${businessName(nextConfirmedBooking)} · ${serviceName(nextConfirmedBooking)} · ${new Date(nextConfirmedBooking.start_at).toLocaleString()}`
                      : t('myBookings.command.noActiveBody', 'No active customer action is needed right now. Your older bookings remain in history.')}
              </p>
            </div>

            <div className="my-bookings-command-actions">
              <button
                type="button"
                className="btn btn-accent"
                onClick={() => scrollToSection(pendingBookings.length > 0 ? 'pending' : nextConfirmedBooking ? 'upcoming' : 'history')}
              >
                {pendingBookings.length > 0
                  ? t('myBookings.command.viewPending', 'View pending requests')
                  : nextConfirmedBooking
                    ? t('myBookings.command.viewUpcoming', 'View upcoming')
                    : t('myBookings.command.viewHistory', 'View history')}
              </button>
              <a href="/explore" className="btn btn-ghost">
                {t('myBookings.command.bookAgain', 'Book another service')}
              </a>
            </div>
          </div>
        )}

        {!loading && bookings.length === 0 && (
          <MyBookingsEmptyState />
        )}

        {!loading && bookings.length > 0 && (
          <div className="my-bookings-section-list">
            {pendingBookings.length > 0 && (
              <MyBookingsSection
                sectionRef={pendingSectionRef}
                id="waiting-approval"
                kicker={t('myBookings.sections.actionStatus', 'Action status')}
                title={t('myBookings.sections.waitingTitle', 'Waiting for business approval')}
                body={t('myBookings.sections.waitingBody', 'These booking requests are not confirmed appointments yet. The business must accept them first, and you can cancel the request while it is still pending.')}
              >
                {pendingBookings.map((booking) => renderBookingCard(booking, 'pending'))}
              </MyBookingsSection>
            )}

            {pendingRescheduleCount > 0 && (
              <MyBookingsSection
                sectionRef={changeRequestsSectionRef}
                id="change-requests"
                kicker={t('myBookings.sections.requestedChanges', 'Requested changes')}
                title={t('dashboardNotifications.sections.pendingRescheduleRequests', 'Pending reschedule requests')}
                body={t('myBookings.sections.changeRequestsBody', 'These cards are also shown inside your active appointments. Your current appointment remains confirmed until the business approves the requested time.')}
              >
                {confirmedUpcomingBookings
                  .filter((booking) => pendingRequestByBookingId[booking.id])
                  .map((booking) => renderBookingCard(booking, 'confirmed'))}
              </MyBookingsSection>
            )}

            {confirmedUpcomingBookings.length > 0 && (
              <MyBookingsSection
                sectionRef={upcomingSectionRef}
                id="upcoming-bookings"
                kicker={t('myBookings.sections.schedule', 'Schedule')}
                title={t('myBookings.sections.activeTitle', 'Active confirmed appointments')}
                body={t('myBookings.sections.activeBody', 'These are your confirmed customer appointments. You can request a different time or cancel before the appointment is completed.')}
                action={pendingRescheduleCount > 0 ? (
                  <button type="button" onClick={() => scrollToSection('changes')} className="btn btn-ghost" style={{ marginTop: '0.75rem' }}>
                    {t('myBookings.actions.viewPendingChanges', 'View pending change requests')}
                  </button>
                ) : null}
              >
                {confirmedUpcomingBookings
                  .filter((booking) => !pendingRequestByBookingId[booking.id])
                  .map((booking) => renderBookingCard(booking, 'confirmed'))}
              </MyBookingsSection>
            )}

            {historyBookings.length > 0 && (
              <MyBookingsSection
                sectionRef={historySectionRef}
                id="booking-history"
                kicker={t('dashboardBookings.summary.history', 'History')}
                title={t('myBookings.sections.historyTitle', 'History and locked bookings')}
                body={t('myBookings.sections.historyBody', 'Completed, cancelled and past bookings stay here for your customer records. They cannot be changed from this page.')}
              >
                {historyBookings.map((booking) => renderBookingCard(booking, 'history'))}
              </MyBookingsSection>
            )}
          </div>
        )}
      </section>
      <style jsx>{`
        .my-bookings-command-card {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          margin-bottom: 1.5rem;
          border-color: rgba(255,107,53,0.24);
          background: linear-gradient(135deg, rgba(255,107,53,0.08), rgba(31,28,44,0.72));
        }

        .my-bookings-command-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .my-bookings-header-actions,
        .my-booking-empty-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-top: 1rem;
        }

        .my-booking-success-banner {
          margin-top: 1rem;
          border-color: rgba(45,212,191,0.35);
          background: rgba(45,212,191,0.06);
        }

        .my-booking-route-banner {
          margin-top: 1rem;
          border-color: rgba(255,107,53,0.45);
          background: var(--accent-dim);
        }

        .my-booking-banner-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .my-bookings-section-list {
          display: grid;
          gap: 1.5rem;
        }

        .my-bookings-section {
          display: grid;
          gap: 1rem;
          scroll-margin-top: 96px;
        }

        .my-booking-card-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .my-booking-card-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          align-items: flex-start;
          justify-content: flex-end;
        }

        .my-booking-pending-change-card {
          background: linear-gradient(135deg, rgba(255,107,53,0.14), rgba(255,107,53,0.05));
          margin-top: 1rem;
          border-color: rgba(255,107,53,0.45);
        }

        .my-booking-pill-accent {
          background: rgba(255,107,53,0.14);
          color: var(--accent);
          padding: 0.2rem 0.55rem;
          border-radius: 999px;
        }

        .my-booking-requested-time-box {
          margin-top: 0.75rem;
          padding: 0.85rem;
          border-radius: var(--radius);
          background: rgba(11,18,32,0.28);
          border: 1px solid rgba(255,107,53,0.28);
        }

        .my-booking-locked-card {
          background: var(--surface-2);
          padding: 0.85rem;
          max-width: 240px;
        }

        @media (max-width: 640px) {
          .my-bookings-command-card {
            display: grid;
          }

          .my-bookings-command-actions,
          .my-bookings-command-actions :global(.btn),
          .my-bookings-command-actions button,
          .my-bookings-command-actions a,
          .my-bookings-header-actions :global(.btn),
          .my-bookings-header-actions button,
          .my-bookings-header-actions a,
          .my-booking-empty-actions :global(.btn),
          .my-booking-empty-actions a,
          .my-booking-banner-row :global(.btn),
          .my-booking-banner-row button,
          .my-booking-card-actions :global(.btn),
          .my-booking-card-actions button,
          .my-booking-card-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  )
}