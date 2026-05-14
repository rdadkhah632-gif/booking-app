import Link from 'next/link'
import AuthNav from '@/components/AuthNav'

export default function TermsPage() {
  return (
    <main>
      <AuthNav />

      <section className="container" style={{ paddingTop: 42, paddingBottom: 72 }}>
        <div className="legal-shell">
          <div className="card legal-hero">
            <p className="small" style={{ color: 'var(--accent)' }}>Mirëbook legal</p>
            <h1 className="page-title">Terms of Service</h1>
            <p className="page-sub" style={{ marginTop: '0.6rem' }}>
              These terms explain the basic rules for using Mirëbook as a customer, business owner or staff member.
            </p>
            <p className="small muted" style={{ marginTop: '0.75rem' }}>
              Last updated: May 2026
            </p>
          </div>

          <div className="card legal-note">
            <p className="small" style={{ color: 'var(--warning)' }}>Important</p>
            <p className="muted" style={{ marginTop: '0.35rem' }}>
              This is a starter terms page for the current Mirëbook development stage. Before public launch, it should be reviewed against your actual company, payment setup, support process and legal requirements.
            </p>
          </div>

          <div className="card legal-content">
            <h2>1. About Mirëbook</h2>
            <p>
              Mirëbook is a booking platform that helps customers discover businesses, view services, choose available appointment times and manage bookings. Businesses use Mirëbook to manage profiles, services, staff, availability, bookings and future subscription billing.
            </p>

            <h2>2. Accounts</h2>
            <p>
              You are responsible for keeping your login details secure and for making sure the information you provide is accurate. Mirëbook may support customer, business and staff access from the same login where the account is linked correctly.
            </p>

            <h2>3. Customer bookings</h2>
            <p>
              Customers can request or create appointments through Mirëbook. Some businesses may auto-accept available bookings, while others may require manual approval. A booking is only confirmed when the booking status shows as confirmed.
            </p>
            <p>
              Customers do not currently pay Mirëbook to book appointments. If a business charges for a service outside Mirëbook, that payment arrangement is between the customer and the business unless a future payment feature is clearly added.
            </p>

            <h2>4. Business responsibilities</h2>
            <p>
              Businesses are responsible for keeping their profile, services, prices, staff, availability and customer-facing information accurate. Businesses should only publish profiles that are ready for customers to book.
            </p>
            <p>
              Businesses are responsible for accepting, declining, completing, cancelling or rescheduling appointments appropriately and for handling their own customer service obligations.
            </p>

            <h2>5. Staff access</h2>
            <p>
              Staff accounts may be linked to a business staff profile. Staff access is intended for viewing assigned bookings, managing staff availability and completing permitted staff actions. Staff should not share login details or access booking information outside their authorised role.
            </p>

            <h2>6. Reschedules and cancellations</h2>
            <p>
              Customers may request reschedules where the feature is available. A requested reschedule may require business approval. Until a business accepts a reschedule request, the original confirmed appointment may remain active.
            </p>
            <p>
              Cancellation and reschedule rules may vary by business. Businesses should clearly communicate their policy to customers.
            </p>

            <h2>7. Business subscription billing</h2>
            <p>
              Mirëbook’s intended commercial model is business subscription billing. Businesses may later pay a recurring monthly fee to use Mirëbook. Pricing may vary by business, market, plan or onboarding agreement.
            </p>
            <p>
              Any future payment provider integration will be used for business subscriptions unless Mirëbook clearly introduces a separate customer payment feature.
            </p>

            <h2>8. Platform availability</h2>
            <p>
              Mirëbook is under active development. Features may change, improve or be removed as the platform is tested and prepared for launch. We aim to keep the service reliable, but we cannot guarantee uninterrupted availability during development.
            </p>

            <h2>9. Acceptable use</h2>
            <p>
              You must not misuse Mirëbook, attempt to access data that does not belong to you, interfere with the platform, submit false information, impersonate another person or business, or use the platform for unlawful activity.
            </p>

            <h2>10. Content and business information</h2>
            <p>
              Businesses are responsible for the accuracy of the content they publish, including names, descriptions, images, services, prices, staff information and availability. Mirëbook may remove or hide content that appears misleading, inappropriate or harmful.
            </p>

            <h2>11. Limitation of responsibility</h2>
            <p>
              Mirëbook provides software to help manage bookings. The actual services, appointments and customer relationships are provided by the listed businesses. Mirëbook is not responsible for the quality, safety, timing or delivery of services provided by businesses using the platform.
            </p>

            <h2>12. Changes to these terms</h2>
            <p>
              These terms may be updated as Mirëbook develops. Continued use of the platform after updates means you accept the latest version.
            </p>

            <h2>13. Contact</h2>
            <p>
              For questions about these terms, account access, business onboarding or support, contact the Mirëbook team through the support page.
            </p>

            <div className="legal-actions">
              <Link href="/support" className="btn btn-accent">
                Contact support
              </Link>

              <Link href="/privacy" className="btn btn-ghost">
                Privacy policy
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