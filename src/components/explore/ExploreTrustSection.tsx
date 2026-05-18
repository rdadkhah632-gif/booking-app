import Link from 'next/link'

export default function ExploreTrustSection() {
  return (
    <section className="container explore-trust-section">
      <div className="grid-3">
        <div className="card">
          <p className="small muted">For customers</p>
          <h3 style={{ marginTop: '0.25rem' }}>Book without checkout friction</h3>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            Mirëbook helps customers request or confirm appointments. Payment/deposit collection is not part of the current customer booking flow.
          </p>
        </div>

        <div className="card">
          <p className="small muted">For businesses</p>
          <h3 style={{ marginTop: '0.25rem' }}>Business billing is separate</h3>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            Business subscription controls are separate from the customer booking journey, so public booking stays focused on appointments.
          </p>
          <Link href="/dashboard/billing" className="btn btn-ghost" style={{ marginTop: '1rem' }}>
            Billing groundwork
          </Link>
        </div>

        <div className="card">
          <p className="small muted">Support and trust</p>
          <h3 style={{ marginTop: '0.25rem' }}>Clear launch foundations</h3>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            Support, privacy and terms pages are in place for early testing and should be reviewed before public launch.
          </p>
          <div className="explore-trust-actions">
            <Link href="/support/customer" className="btn btn-ghost">Customer support</Link>
            <Link href="/privacy" className="btn btn-ghost">Privacy</Link>
            <Link href="/terms" className="btn btn-ghost">Terms</Link>
          </div>
        </div>
      </div>
    </section>
  )
}