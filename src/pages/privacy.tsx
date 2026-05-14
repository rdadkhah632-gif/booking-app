import Link from 'next/link'
import AuthNav from '@/components/AuthNav'

export default function PrivacyPage() {
  return (
    <main>
      <AuthNav />

      <section className="container" style={{ paddingTop: 42, paddingBottom: 72 }}>
        <div className="legal-shell">
          <div className="card legal-hero">
            <p className="small" style={{ color: 'var(--accent)' }}>Mirëbook legal</p>
            <h1 className="page-title">Privacy Policy</h1>
            <p className="page-sub" style={{ marginTop: '0.6rem' }}>
              This page explains how Mirëbook handles account, booking and business information while the platform is in development and early launch.
            </p>
            <p className="small muted" style={{ marginTop: '0.75rem' }}>
              Last updated: May 2026
            </p>
          </div>

          <div className="card legal-note">
            <p className="small" style={{ color: 'var(--warning)' }}>Important</p>
            <p className="muted" style={{ marginTop: '0.35rem' }}>
              This is a practical starter privacy policy for the current Mirëbook product. Before public launch, it should be reviewed against your actual company setup, hosting, payment provider, email provider and legal requirements.
            </p>
          </div>

          <div className="card legal-content">
            <h2>1. Who we are</h2>
            <p>
              Mirëbook is a booking platform that helps customers discover businesses, view services, choose available times and manage appointment requests. Businesses use Mirëbook to manage profiles, services, staff, availability, bookings and subscription billing.
            </p>

            <h2>2. Information we collect</h2>
            <p>
              We may collect information you provide when using Mirëbook, including your name, email address, phone number, account type, booking details, service selections, appointment times, staff selections, reschedule requests and messages linked to bookings.
            </p>
            <p>
              For business users, we may collect business profile information such as business name, category, location, phone number, description, staff details, services, prices, opening hours, billing email and subscription status.
            </p>

            <h2>3. How we use your information</h2>
            <p>
              We use your information to provide the Mirëbook service, including account login, booking creation, booking approvals, rescheduling, customer booking history, business dashboards, staff schedules, notifications and platform administration.
            </p>
            <p>
              Business billing information is used to manage future Mirëbook subscription payments. Customers do not currently pay Mirëbook to book appointments.
            </p>

            <h2>4. Booking and business visibility</h2>
            <p>
              Published business profiles may be visible on the Mirëbook marketplace. Customer booking information is intended to be visible only to the relevant customer, the business owner and authorised staff linked to that booking.
            </p>

            <h2>5. Service providers</h2>
            <p>
              Mirëbook uses third-party technology providers to operate the platform, including hosting, authentication, database, deployment and future payment processing services. These providers may process data as needed to run the platform.
            </p>

            <h2>6. Payments and billing</h2>
            <p>
              Mirëbook’s planned payment model is business subscription billing. Businesses may later add payment details to pay a monthly fee for using the platform. Customer appointment payments, deposits or checkout are not part of the current customer booking flow.
            </p>

            <h2>7. Data security</h2>
            <p>
              We aim to protect user and business data through authentication, access controls and database security rules. As Mirëbook moves toward production, security policies and access controls should be reviewed and tested before onboarding real users at scale.
            </p>

            <h2>8. Your choices</h2>
            <p>
              You can update your account details from your account page. Businesses can update their business profile, staff, services, availability and billing groundwork from the business dashboard.
            </p>

            <h2>9. Data retention</h2>
            <p>
              We keep account, booking and business information for as long as needed to provide the service, maintain booking history, support business operations and meet legal or operational requirements.
            </p>

            <h2>10. International use</h2>
            <p>
              Mirëbook is being developed for international use, including Albania and English-speaking markets. Language, region and currency features may be expanded as the platform develops.
            </p>

            <h2>11. Contact</h2>
            <p>
              For privacy questions, support requests or data-related queries, contact the Mirëbook team through the support page.
            </p>

            <div className="legal-actions">
              <Link href="/support" className="btn btn-accent">
                Contact support
              </Link>

              <Link href="/terms" className="btn btn-ghost">
                Terms of service
              </Link>

              <Link href="/explore" className="btn btn-ghost">
                Explore Mirëbook
              </Link>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .legal-shell {
          max-width: 900px;
          margin: 0 auto;
          display: grid;
          gap: 1rem;
        }

        .legal-hero {
          background: linear-gradient(135deg, rgba(255,107,53,0.12), rgba(45,212,191,0.08));
          border-color: rgba(255,107,53,0.25);
        }

        .legal-note {
          border-color: rgba(255,190,11,0.28);
          background: rgba(255,190,11,0.06);
        }

        .legal-content {
          display: grid;
          gap: 1rem;
        }

        .legal-content h2 {
          font-family: var(--font-display);
          margin-top: 0.75rem;
        }

        .legal-content p {
          color: var(--text-muted);
          line-height: 1.7;
        }

        .legal-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-top: 1rem;
        }

        @media (max-width: 640px) {
          .legal-actions,
          .legal-actions :global(.btn),
          .legal-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  )
}