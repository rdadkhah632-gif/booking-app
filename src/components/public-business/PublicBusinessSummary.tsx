import Link from 'next/link'
import { Business, Service, TimeSlot } from './publicBusinessTypes'

type Props = {
  business: Business
  selectedService: Service | null
  selectedSlot: TimeSlot | null
  selectedStaffSummary: () => string
  customerName: string
  customerEmail: string
  customerPhone: string
  customerNotes: string
  submitting: boolean
  error: string | null
  canSubmit: boolean
  customerUserId: string | null
  userRole: string | null
  loginHref: string
  onCustomerNameChange: (value: string) => void
  onCustomerEmailChange: (value: string) => void
  onCustomerPhoneChange: (value: string) => void
  onCustomerNotesChange: (value: string) => void
  onSubmit: (e: React.FormEvent) => void
  formatServicePrice: (price: number) => string
  bookingModeText: () => string
  bookingModeDescription: () => string
  reschedulePolicyText: () => string
}

export default function PublicBusinessSummary({
  business,
  selectedService,
  selectedSlot,
  selectedStaffSummary,
  customerName,
  customerEmail,
  customerPhone,
  customerNotes,
  submitting,
  error,
  canSubmit,
  customerUserId,
  userRole,
  loginHref,
  onCustomerNameChange,
  onCustomerEmailChange,
  onCustomerPhoneChange,
  onCustomerNotesChange,
  onSubmit,
  formatServicePrice,
  bookingModeText,
  bookingModeDescription,
  reschedulePolicyText
}: Props) {
  const blockedByRole = Boolean(customerUserId && userRole && userRole !== 'customer')

  return (
    <aside className="card booking-summary-panel">
      <div>
        <p className="small muted">Booking summary</p>
        <h2 style={{ fontFamily: 'var(--font-display)' }}>{bookingModeText()}</h2>
        <p className="small muted" style={{ marginTop: '0.35rem' }}>
          {bookingModeDescription()}
        </p>
      </div>

      <div className="public-business-summary-box">
        <p className="small muted">Business</p>
        <strong>{business.name}</strong>

        <p className="small muted" style={{ marginTop: '0.75rem' }}>Service</p>
        <strong>{selectedService ? selectedService.name : 'Choose a service'}</strong>

        {selectedService && (
          <p className="small muted" style={{ marginTop: '0.25rem' }}>
            {selectedService.duration_minutes} minutes · {formatServicePrice(selectedService.price)}
          </p>
        )}

        <p className="small muted" style={{ marginTop: '0.75rem' }}>Staff</p>
        <strong>{selectedStaffSummary()}</strong>

        <p className="small muted" style={{ marginTop: '0.75rem' }}>Time</p>
        <strong>{selectedSlot ? new Date(selectedSlot.startAt).toLocaleString() : 'Choose a time'}</strong>

        <p className="small muted" style={{ marginTop: '0.75rem' }}>
          {business.auto_accept_bookings === false ? 'This will be sent as a booking request.' : 'This will be confirmed instantly if the slot is still available.'}
        </p>
      </div>

      {!customerUserId && (
        <div className="public-business-summary-box" style={{ borderColor: 'rgba(255,107,53,0.28)', background: 'rgba(255,107,53,0.06)' }}>
          <p className="small" style={{ color: 'var(--accent)' }}>Login required</p>
          <h3 style={{ marginTop: '0.25rem' }}>Sign in to continue</h3>
          <p className="small muted" style={{ marginTop: '0.35rem' }}>
            Customers need to log in before sending booking requests or confirming appointments.
          </p>
          <div className="booking-action-row compact">
            <Link href={loginHref} className="btn btn-accent">
              Login
            </Link>
            <Link href="/register" className="btn btn-ghost">
              Create account
            </Link>
            <Link href="/support/customer" className="btn btn-ghost">
              Help
            </Link>
          </div>
        </div>
      )}

      {blockedByRole && (
        <div className="public-business-summary-box" style={{ borderColor: 'rgba(255,190,11,0.28)', background: 'rgba(255,190,11,0.06)' }}>
          <p className="small" style={{ color: 'var(--warning)' }}>Customer account required</p>
          <h3 style={{ marginTop: '0.25rem' }}>This account cannot book as a customer</h3>
          <p className="small muted" style={{ marginTop: '0.35rem' }}>
            Business, staff and operator accounts can view this page, but bookings must be made from a customer account.
          </p>
          <div className="booking-action-row compact">
            <Link href="/account" className="btn btn-ghost">
              Account
            </Link>
            <Link href="/support/customer" className="btn btn-ghost">
              Customer support
            </Link>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="public-business-form">
        <label className="small muted">
          Name
          <input value={customerName} onChange={(e) => onCustomerNameChange(e.target.value)} placeholder="Your name" style={{ marginTop: '0.35rem' }} />
        </label>

        <label className="small muted">
          Email
          <input value={customerEmail} onChange={(e) => onCustomerEmailChange(e.target.value)} placeholder="you@example.com" style={{ marginTop: '0.35rem' }} />
        </label>

        <label className="small muted">
          Phone
          <input value={customerPhone} onChange={(e) => onCustomerPhoneChange(e.target.value)} placeholder="Phone number" style={{ marginTop: '0.35rem' }} />
        </label>

        <label className="small muted">
          Notes
          <textarea value={customerNotes} onChange={(e) => onCustomerNotesChange(e.target.value)} placeholder="Optional notes for the business" rows={4} style={{ marginTop: '0.35rem' }} />
        </label>

        {error && (
          <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)', background: 'rgba(255,77,109,0.05)', padding: '0.85rem' }}>
            <p className="small" style={{ color: 'var(--danger)' }}>{error}</p>
          </div>
        )}

        <button type="submit" className="btn btn-accent" disabled={submitting || !canSubmit}>
          {submitting
            ? 'Working...'
            : business.auto_accept_bookings === false ? 'Send booking request' : 'Confirm appointment'}
        </button>
      </form>

      <div className="public-business-summary-box">
        <p className="small muted">Business policies</p>
        <p className="small muted" style={{ marginTop: '0.25rem' }}>{reschedulePolicyText()}</p>
        {business.cancellation_policy && (
          <p className="small muted" style={{ marginTop: '0.45rem' }}>{business.cancellation_policy}</p>
        )}
      </div>

      <Link href="/support/customer" className="btn btn-ghost">
        Need help?
      </Link>
    </aside>
  )
}