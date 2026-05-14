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
            <h1 className="page-title">Support and contact</h1>
            <p className="page-sub" style={{ marginTop: '0.6rem' }}>
              Get help with customer bookings, business setup, staff access, account issues and Mirëbook onboarding.
            </p>
          </div>

          <div className="grid-3">
            <div className="card">
              <p className="small muted">Customers</p>
              <h3>Booking help</h3>
              <p className="muted small" style={{ marginTop: '0.5rem' }}>
                View your bookings, track approval status, request a reschedule or check appointment history.
              </p>
              <Link href="/my-bookings" className="btn btn-ghost" style={{ marginTop: '1rem' }}>
                My bookings
              </Link>
            </div>

            <div className="card">
              <p className="small muted">Businesses</p>
              <h3>Setup help</h3>
              <p className="muted small" style={{ marginTop: '0.5rem' }}>
                Manage your business profile, services, staff, working hours, settings and billing groundwork.
              </p>
              <Link href="/dashboard/businesses" className="btn btn-ghost" style={{ marginTop: '1rem' }}>
                Setup hub
              </Link>
            </div>

            <div className="card">
              <p className="small muted">Staff</p>
              <h3>Staff access</h3>
              <p className="muted small" style={{ marginTop: '0.5rem' }}>
                Staff can view assigned appointments and update their own availability once linked by the business.
              </p>
              <Link href="/staff" className="btn btn-ghost" style={{ marginTop: '1rem' }}>
                Staff workspace
              </Link>
            </div>
          </div>

          <div className="card support-content">
            <div>
              <p className="small muted">Common questions</p>
              <h2>What can Mirëbook help with?</h2>
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
                  Not currently. Customers use Mirëbook to book and manage appointments. The payment model planned for Mirëbook is business subscription billing, where businesses pay a monthly fee to use the platform.
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

          <div className="card support-contact-card">
            <div>
              <p className="small" style={{ color: 'var(--accent)' }}>Contact</p>
              <h2>Need direct support?</h2>
              <p className="muted" style={{ marginTop: '0.5rem' }}>
                For now, use this page as the public support hub. Before launch, this should connect to a real support email, form or helpdesk workflow.
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
      </section>

      <style jsx>{`
        .support-shell {
          max-width: 1000px;
          margin: 0 auto;
          display: grid;
          gap: 1rem;
        }

        .support-hero {
          background: linear-gradient(135deg, rgba(255,107,53,0.12), rgba(45,212,191,0.08));
          border-color: rgba(255,107,53,0.25);
        }

        .support-content {
          display: grid;
          gap: 1rem;
        }

        .support-faq-list {
          display: grid;
          gap: 0.85rem;
        }

        .support-faq-item {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 1rem;
        }

        .support-faq-item h3 {
          margin-bottom: 0.4rem;
        }

        .support-faq-item p {
          color: var(--text-muted);
          line-height: 1.65;
        }

        .support-contact-card {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .support-contact-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        @media (max-width: 640px) {
          .support-contact-card {
            display: grid;
          }

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