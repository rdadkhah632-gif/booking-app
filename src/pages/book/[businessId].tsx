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

  return (
    <main>
      <AuthNav />

      <section className="container" style={{ padding: '42px 24px 80px' }}>
        <div className="card" style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <p className="small muted">Redirecting</p>

          <h1 className="page-title" style={{ marginTop: '0.35rem' }}>
            Opening the booking page...
          </h1>

          <p className="page-sub" style={{ marginTop: '0.75rem' }}>
            Slotly now uses the improved marketplace booking page with services, staff, live availability and booking approval support.
          </p>

          {businessId && !Array.isArray(businessId) ? (
            <Link href={`/explore/${businessId}`} className="btn btn-accent" style={{ marginTop: '1.25rem' }}>
              Continue to booking page
            </Link>
          ) : (
            <Link href="/explore" className="btn btn-accent" style={{ marginTop: '1.25rem' }}>
              Browse marketplace
            </Link>
          )}
        </div>
      </section>
    </main>
  )
}