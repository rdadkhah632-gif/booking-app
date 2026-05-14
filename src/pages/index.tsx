import AuthNav from '@/components/AuthNav'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'

export default function Home() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [city, setCity] = useState('')

  function searchBusinesses(e: React.FormEvent) {
    e.preventDefault()

    router.push({
      pathname: '/explore',
      query: {
        ...(query.trim() ? { query: query.trim() } : {}),
        ...(city.trim() ? { city: city.trim() } : {})
      }
    })
  }

  return (
    <main>
      <AuthNav />

      <section className="home-hero">
        <div className="home-glow home-glow-one" />
        <div className="home-glow home-glow-two" />

        <div className="container home-hero-grid">
          <div className="home-copy">
            <div className="home-eyebrow">
              Mirëbook · live booking marketplace
            </div>

            <h1 className="home-title">
              Book trusted local services with <em>real availability</em>.
            </h1>

            <p className="home-subtitle">
              Mirëbook helps customers discover barbers, salons, clinics, dentists and service businesses. Choose a service, pick a smart calendar date, see real available times and book instantly or request approval depending on the business.
            </p>

            <form onSubmit={searchBusinesses} className="home-search">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Haircut, nails, dental checkup, massage..."
                className="home-search-input"
              />

              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Tirana, Coventry, London..."
                className="home-search-input"
              />

              <button className="btn btn-accent home-search-button">
                Search Mirëbook
              </button>
            </form>

            <div className="home-cta-row">
              <Link href="/explore" className="btn btn-accent">
                Explore Mirëbook
              </Link>

              <Link href="/my-bookings" className="btn btn-ghost">
                My bookings
              </Link>

              <Link href="/register" className="btn btn-ghost">
                Create account
              </Link>
            </div>

            <div className="home-proof-row">
              <span className="small muted">✓ Smart calendar availability</span>
              <span className="small muted">✓ Any staff or specific staff</span>
              <span className="small muted">✓ Approval and reschedule tracking</span>
            </div>
          </div>

          <aside className="card home-business-card">
            <p className="small" style={{ color: 'var(--accent)', marginBottom: '0.35rem' }}>
              For businesses
            </p>

            <h2 className="home-card-title">
              Run your service business from one Mirëbook workspace.
            </h2>

            <p className="muted" style={{ marginBottom: 24 }}>
              Build your customer-facing profile, add services, assign staff, set working hours and manage approvals, reschedules and daily appointments from your dashboard.
            </p>

            <div className="home-business-links">
              <Link href="/dashboard/businesses" className="card home-mini-card">
                <strong>Profile readiness</strong>
                <p className="small muted">Check services, staff, hours and publishing status.</p>
              </Link>

              <Link href="/dashboard/notifications" className="card home-mini-card">
                <strong>Action centre</strong>
                <p className="small muted">Approve new bookings and customer reschedule requests.</p>
              </Link>

              <Link href="/dashboard/bookings" className="card home-mini-card">
                <strong>Booking manager</strong>
                <p className="small muted">View confirmed, pending, completed and cancelled bookings.</p>
              </Link>
            </div>

            <div className="home-cta-row" style={{ marginBottom: 0 }}>
              <Link href="/register" className="btn btn-accent">
                Join as a business
              </Link>

              <Link href="/login" className="btn btn-ghost">
                Business login
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <section className="container home-confidence-section">
        <div className="home-section-heading">
          <p className="small" style={{ color: 'var(--accent)', marginBottom: '0.5rem' }}>
            Built for confidence
          </p>
          <h2>Clear booking states for customers and businesses.</h2>
          <p className="muted">
            Mirëbook separates confirmed appointments, approval requests, reschedule requests and completed bookings so customers and businesses always know what needs action.
          </p>
        </div>

        <div className="grid-2">
          <div className="card">
            <p className="small muted">Customers</p>
            <h3 style={{ marginTop: '0.25rem' }}>Book and track appointments</h3>
            <p className="muted" style={{ margin: '0.5rem 0 1rem' }}>
              Browse bookable businesses, choose a service, pick from real available times, select Any available staff or a specific staff member, and track every appointment from your account.
            </p>
            <div className="home-cta-row" style={{ marginBottom: 0 }}>
              <Link href="/explore" className="btn btn-accent">Explore marketplace</Link>
              <Link href="/notifications" className="btn btn-ghost">Notifications</Link>
            </div>
          </div>

          <div className="card">
            <p className="small muted">Businesses</p>
            <h3 style={{ marginTop: '0.25rem' }}>Control how bookings are accepted</h3>
            <p className="muted" style={{ margin: '0.5rem 0 1rem' }}>
              Use instant confirmation for simple flows or manual approval when you want to review each booking request first. Mirëbook keeps pending, confirmed, rescheduled, completed and cancelled bookings separated.
            </p>
            <div className="home-cta-row" style={{ marginBottom: 0 }}>
              <Link href="/dashboard" className="btn btn-accent">Business dashboard</Link>
              <Link href="/dashboard/businesses" className="btn btn-ghost">Setup profile</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container home-confidence-section">
        <div className="home-section-heading">
          <p className="small" style={{ color: 'var(--accent)', marginBottom: '0.5rem' }}>
            Built for international growth
          </p>
          <h2>Start local, scale across cities.</h2>
          <p className="muted">
            Mirëbook is designed for independent service providers and growing teams across Albania, the UK and wider international markets.
          </p>
        </div>

        <div className="grid-3">
          <div className="card">
            <p className="small muted">For customers</p>
            <h3 style={{ marginTop: '0.25rem' }}>Find real availability fast</h3>
            <p className="muted" style={{ marginTop: '0.5rem' }}>
              Search by service or city, compare bookable businesses and choose a time that already fits staff availability.
            </p>
          </div>

          <div className="card">
            <p className="small muted">For businesses</p>
            <h3 style={{ marginTop: '0.25rem' }}>Launch without messy admin</h3>
            <p className="muted" style={{ marginTop: '0.5rem' }}>
              Add services, staff and working hours, then publish a profile customers can book from directly.
            </p>
          </div>

          <div className="card">
            <p className="small muted">For teams</p>
            <h3 style={{ marginTop: '0.25rem' }}>Keep every appointment clear</h3>
            <p className="muted" style={{ marginTop: '0.5rem' }}>
              Track pending approvals, confirmed appointments, reschedule requests and completed bookings in one place.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
