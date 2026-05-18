import Link from 'next/link'
import AuthNav from '@/components/AuthNav'

export default function SupportPage() {
  return (
    <main>
      <AuthNav />

      <section className="container" style={{ paddingTop: 42, paddingBottom: 72 }}>
        <div className="support-shell">
          <div className="card support-hero">
            <p className="small" style={{ color: 'var(--accent)' }}>Mirëbook support</p>
            <h1 className="page-title">What do you need help with?</h1>
            <p className="page-sub" style={{ marginTop: '0.6rem' }}>
              Choose the support route that matches your account type. Customer, business and staff issues are handled separately so the help flow stays focused.
            </p>
          </div>

          <div className="support-route-grid">
            <Link href="/support/customer" className="card support-route-card">
              <p className="small muted">Customers</p>
              <h2>Booking support</h2>
              <p className="muted small" style={{ marginTop: '0.5rem' }}>
                Get help with booking requests, confirmations, cancellations, reschedules, notifications and account issues as a customer.
              </p>
              <span className="btn btn-accent" style={{ marginTop: '1rem' }}>
                Customer support
              </span>
            </Link>

            <Link href="/support/business" className="card support-route-card">
              <p className="small muted">Businesses</p>
              <h2>Business support</h2>
              <p className="muted small" style={{ marginTop: '0.5rem' }}>
                Get help with business setup, publishing, services, staff, working hours, booking approval, trials and subscription access.
              </p>
              <span className="btn btn-accent" style={{ marginTop: '1rem' }}>
                Business support
              </span>
            </Link>

            <Link href="/support/staff" className="card support-route-card">
              <p className="small muted">Staff</p>
              <h2>Staff support</h2>
              <p className="muted small" style={{ marginTop: '0.5rem' }}>
                Get help with staff account linking, schedule access, availability problems or being connected to the wrong business.
              </p>
              <span className="btn btn-accent" style={{ marginTop: '1rem' }}>
                Staff support
              </span>
            </Link>
          </div>

          <div className="grid-2">
            <div className="card support-content">
              <div>
                <p className="small muted">Common account routes</p>
                <h2>Quick links</h2>
              </div>

              <div className="support-link-list">
                <Link href="/my-bookings" className="support-link-row">
                  <span>
                    <strong>My bookings</strong>
                    <small>Track customer appointments, pending requests and reschedules.</small>
                  </span>
                  <span>→</span>
                </Link>

                <Link href="/dashboard/businesses" className="support-link-row">
                  <span>
                    <strong>Business setup</strong>
                    <small>Manage business profile, services, staff, hours and publishing.</small>
                  </span>
                  <span>→</span>
                </Link>

                <Link href="/staff" className="support-link-row">
                  <span>
                    <strong>Staff workspace</strong>
                    <small>View staff schedule and access staff availability tools.</small>
                  </span>
                  <span>→</span>
                </Link>

                <Link href="/account" className="support-link-row">
                  <span>
                    <strong>Account settings</strong>
                    <small>Update name, phone and open your connected workspaces.</small>
                  </span>
                  <span>→</span>
                </Link>
              </div>
            </div>

            <div className="card support-content">
              <div>
                <p className="small muted">Before launch</p>
                <h2>Support inbox status</h2>
              </div>

              <div className="support-note-box">
                <p>
                  Mirëbook support is being split into role-specific flows. The next production step is connecting these support forms into an operator inbox so messages can be reviewed, replied to and closed from the admin area.
                </p>
              </div>

              <div className="support-contact-actions">
                <Link href="/privacy" className="btn btn-ghost">
                  Privacy policy
                </Link>

                <Link href="/terms" className="btn btn-ghost">
                  Terms of service
                </Link>

                <Link href="/explore" className="btn btn-accent">
                  Explore Mirëbook
                </Link>
              </div>
            </div>
          </div>

          <div className="card support-faq-card">
            <div>
              <p className="small muted">Common questions</p>
              <h2>Frequently asked questions</h2>
            </div>

            <div className="support-faq-list">
              <div className="support-faq-item">
                <h3>My booking is pending. What does that mean?</h3>
                <p>
                  Some businesses use manual approval. Your booking request has been sent to the business and is not confirmed until they accept it. You can track it from My Bookings or Notifications.
                </p>
              </div>

              <div className="support-faq-item">
                <h3>Can customers pay through Mirëbook?</h3>
                <p>
                  Not currently. Customers use Mirëbook to book and manage appointments. The first commercial billing model is business subscription billing, where businesses pay a monthly fee to use the platform.
                </p>
              </div>

              <div className="support-faq-item">
                <h3>How does a business get ready for customers?</h3>
                <p>
                  A business should complete its profile, add services, assign staff, set working hours and choose booking settings before publishing. The setup hub shows what still needs attention.
                </p>
              </div>

              <div className="support-faq-item">
                <h3>How does staff access work?</h3>
                <p>
                  A business owner adds a staff member and their email. When that person registers or logs in with the same email, Mirëbook can link their account to the staff profile.
                </p>
              </div>

              <div className="support-faq-item">
                <h3>Will Mirëbook support Albania and other countries?</h3>
                <p>
                  Yes. Mirëbook is being prepared for Albanian and international markets. Region, currency and language support will expand as the platform moves closer to launch.
                </p>
              </div>

              <div className="support-faq-item">
                <h3>Will there be a mobile app?</h3>
                <p>
                  The current product is being built as a web platform first, with future app-store readiness in mind. The goal is to make the routes, layout, account flow and settings suitable for a later app version.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .support-shell {
          max-width: 1080px;
          margin: 0 auto;
          display: grid;
          gap: 1rem;
        }

        .support-hero {
          background: linear-gradient(135deg, rgba(255,107,53,0.12), rgba(45,212,191,0.08));
          border-color: rgba(255,107,53,0.25);
        }

        .support-route-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
        }

        .support-route-card {
          display: flex;
          flex-direction: column;
          min-height: 240px;
          transition: transform 0.2s, border-color 0.2s;
        }

        .support-route-card:hover {
          transform: translateY(-2px);
          border-color: rgba(255,107,53,0.35);
        }

        .support-content,
        .support-faq-card {
          display: grid;
          gap: 1rem;
        }

        .support-link-list {
          display: grid;
          gap: 0.75rem;
        }

        .support-link-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          border: 1px solid var(--border);
          background: var(--surface-2);
          border-radius: var(--radius);
          padding: 0.9rem;
        }

        .support-link-row small {
          display: block;
          margin-top: 0.2rem;
          color: var(--text-muted);
          line-height: 1.5;
        }

        .support-note-box,
        .support-faq-item {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 1rem;
        }

        .support-note-box p,
        .support-faq-item p {
          color: var(--text-muted);
          line-height: 1.65;
        }

        .support-faq-list {
          display: grid;
          gap: 0.85rem;
        }

        .support-faq-item h3 {
          margin-bottom: 0.4rem;
        }

        .support-contact-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        @media (max-width: 860px) {
          .support-route-grid {
            grid-template-columns: 1fr;
          }

          .support-route-card {
            min-height: auto;
          }
        }

        @media (max-width: 640px) {
          .support-contact-actions,
          .support-contact-actions :global(.btn),
          .support-contact-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  )
}