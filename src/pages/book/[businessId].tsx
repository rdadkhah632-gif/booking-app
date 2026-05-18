import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import AuthNav from '@/components/AuthNav'

export default function LegacyBookBusinessRedirect() {
  const router = useRouter()
  const { businessId } = router.query

  useEffect(() => {
    if (!router.isReady) return
    if (!businessId || Array.isArray(businessId)) return

    router.replace(`/explore/${businessId}`)
  }, [router.isReady, businessId, router])

  const validBusinessId = typeof businessId === 'string' ? businessId : null

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ padding: '42px 24px 80px' }}>
        <div className="legacy-book-shell">
          <div className="card legacy-book-card">
            <p className="small" style={{ color: 'var(--accent)' }}>
              Mirëbook booking
            </p>

            <h1 className="page-title" style={{ marginTop: '0.35rem' }}>
              Opening the booking page...
            </h1>

            <p className="page-sub" style={{ marginTop: '0.75rem' }}>
              Mirëbook now handles booking from the public business page, where customers can view services, staff, availability and the business booking mode before confirming or sending a request.
            </p>

            <div className="legacy-book-note">
              <p className="small muted">
                This route is kept for old links and redirects automatically. Customers do not pay through Mirëbook at booking yet.
              </p>
            </div>

            <div className="legacy-book-actions">
              {validBusinessId ? (
                <Link href={`/explore/${validBusinessId}`} className="btn btn-accent">
                  Continue to business page
                </Link>
              ) : (
                <Link href="/explore" className="btn btn-accent">
                  Browse marketplace
                </Link>
              )}

              <Link href="/support/customer" className="btn btn-ghost">
                Customer support
              </Link>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .legacy-book-shell {
          max-width: 760px;
          margin: 0 auto;
        }

        .legacy-book-card {
          text-align: center;
          background: linear-gradient(135deg, rgba(255,107,53,0.10), rgba(45,212,191,0.05));
          border-color: rgba(255,107,53,0.24);
        }

        .legacy-book-note {
          margin-top: 1rem;
          padding: 0.85rem;
          border-radius: var(--radius);
          background: var(--surface-2);
          border: 1px solid var(--border);
        }

        .legacy-book-actions {
          display: flex;
          justify-content: center;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-top: 1.25rem;
        }

        @media (max-width: 560px) {
          .legacy-book-actions,
          .legacy-book-actions :global(.btn),
          .legacy-book-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  )
}