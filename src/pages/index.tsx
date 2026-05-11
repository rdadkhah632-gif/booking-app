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

      <section style={{
        minHeight: 'calc(100vh - 72px)',
        display: 'flex',
        alignItems: 'center',
        padding: '80px 24px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: '-20%',
          right: '-10%',
          width: 650,
          height: 650,
          background: 'radial-gradient(circle, rgba(255,107,53,0.14) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{
          position: 'absolute',
          bottom: '-10%',
          left: '-5%',
          width: 420,
          height: 420,
          background: 'radial-gradient(circle, rgba(255,190,11,0.09) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div className="container" style={{
          display: 'grid',
          gridTemplateColumns: '1fr 420px',
          gap: 60,
          alignItems: 'center',
          position: 'relative',
          zIndex: 1
        }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(255,107,53,0.12)',
              border: '1px solid rgba(255,107,53,0.3)',
              color: 'var(--accent)',
              fontSize: '0.78rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '6px 16px',
              borderRadius: 999,
              marginBottom: 22
            }}>
              Book local services faster
            </div>

            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.6rem, 5.5vw, 4.4rem)',
              fontWeight: 900,
              lineHeight: 1.08,
              letterSpacing: '-0.03em',
              marginBottom: 22
            }}>
              Find and book <em style={{ color: 'var(--accent)' }}>trusted</em> local services.
            </h1>

            <p style={{
              fontSize: '1.1rem',
              color: 'var(--text-muted)',
              maxWidth: 520,
              marginBottom: 36,
              fontWeight: 300,
              lineHeight: 1.65
            }}>
              Discover barbers, salons, clinics, dentists and service businesses.
              Choose a service, pick a real available slot, and book instantly.
            </p>

            <form
              onSubmit={searchBusinesses}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr auto',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
                maxWidth: 720,
                marginBottom: 24
              }}
            >
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Haircut, dental checkup, massage..."
                style={{
                  borderRadius: 0,
                  borderTop: 'none',
                  borderBottom: 'none',
                  borderLeft: 'none'
                }}
              />

              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Coventry, Tirana, London..."
                style={{
                  borderRadius: 0,
                  borderTop: 'none',
                  borderBottom: 'none',
                  borderLeft: 'none'
                }}
              />

              <button className="btn btn-accent" style={{ borderRadius: 0, padding: '0 28px' }}>
                Search
              </button>
            </form>

            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <span className="small muted">✓ Instant bookings</span>
              <span className="small muted">✓ Live availability</span>
              <span className="small muted">✓ No phone calls</span>
            </div>
          </div>

          <div className="card" style={{
            padding: 32,
            borderRadius: 20,
            animation: 'fadeUp 0.6s var(--ease) both'
          }}>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.8rem',
              marginBottom: 12
            }}>
              For businesses
            </h2>

            <p className="muted" style={{ marginBottom: 24 }}>
              Set your services, prices and working hours. Let customers book only the slots you actually have available.
            </p>

            <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
              <Link href="/dashboard/businesses" className="card" style={{ background: 'var(--surface-2)' }}>
                <strong>Manage services</strong>
                <p className="small muted">Duration, price and active status.</p>
              </Link>

              <Link href="/dashboard/businesses" className="card" style={{ background: 'var(--surface-2)' }}>
                <strong>Control availability</strong>
                <p className="small muted">Set opening hours and prevent overlaps.</p>
              </Link>

              <Link href="/dashboard/businesses" className="card" style={{ background: 'var(--surface-2)' }}>
                <strong>View bookings</strong>
                <p className="small muted">See customer details and cancel bookings.</p>
              </Link>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/register" className="btn btn-accent">
                Register business
              </Link>

              <Link href="/login" className="btn btn-ghost">
                Business login
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container" style={{ padding: '60px 24px' }}>
        <div className="grid-2">
          <div className="card">
            <h3>Customers</h3>
            <p className="muted" style={{ margin: '0.5rem 0 1rem' }}>
              Browse published businesses, book appointments and manage your bookings.
            </p>
            <Link href="/explore" className="btn btn-ghost">Browse businesses</Link>
          </div>

          <div className="card">
            <h3>Already booked?</h3>
            <p className="muted" style={{ margin: '0.5rem 0 1rem' }}>
              Login and view your upcoming appointments.
            </p>
            <Link href="/my-bookings" className="btn btn-ghost">My bookings</Link>
          </div>
        </div>
      </section>
    </main>
  )
}
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

      <section
        style={{
          minHeight: 'calc(100vh - 72px)',
          display: 'flex',
          alignItems: 'center',
          padding: '80px 24px',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-20%',
            right: '-10%',
            width: 650,
            height: 650,
            background: 'radial-gradient(circle, rgba(255,107,53,0.14) 0%, transparent 70%)',
            pointerEvents: 'none'
          }}
        />

        <div
          style={{
            position: 'absolute',
            bottom: '-10%',
            left: '-5%',
            width: 420,
            height: 420,
            background: 'radial-gradient(circle, rgba(255,190,11,0.09) 0%, transparent 70%)',
            pointerEvents: 'none'
          }}
        />

        <div
          className="container"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 430px',
            gap: 60,
            alignItems: 'center',
            position: 'relative',
            zIndex: 1
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(255,107,53,0.12)',
                border: '1px solid rgba(255,107,53,0.3)',
                color: 'var(--accent)',
                fontSize: '0.78rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '6px 16px',
                borderRadius: 999,
                marginBottom: 22
              }}
            >
              Live booking marketplace
            </div>

            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2.6rem, 5.5vw, 4.4rem)',
                fontWeight: 900,
                lineHeight: 1.08,
                letterSpacing: '-0.03em',
                marginBottom: 22
              }}
            >
              Book local services with <em style={{ color: 'var(--accent)' }}>real availability</em>.
            </h1>

            <p
              style={{
                fontSize: '1.1rem',
                color: 'var(--text-muted)',
                maxWidth: 620,
                marginBottom: 34,
                fontWeight: 300,
                lineHeight: 1.65
              }}
            >
              Discover barbers, salons, clinics, dentists and service businesses. Choose a service, pick staff, view available times and book instantly or request approval depending on the business.
            </p>

            <form
              onSubmit={searchBusinesses}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr auto',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
                maxWidth: 760,
                marginBottom: 20
              }}
            >
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Haircut, dental checkup, massage..."
                style={{
                  borderRadius: 0,
                  borderTop: 'none',
                  borderBottom: 'none',
                  borderLeft: 'none'
                }}
              />

              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Coventry, Tirana, London..."
                style={{
                  borderRadius: 0,
                  borderTop: 'none',
                  borderBottom: 'none',
                  borderLeft: 'none'
                }}
              />

              <button className="btn btn-accent" style={{ borderRadius: 0, padding: '0 28px' }}>
                Search
              </button>
            </form>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
              <Link href="/explore" className="btn btn-accent">
                Explore businesses
              </Link>

              <Link href="/my-bookings" className="btn btn-ghost">
                My bookings
              </Link>

              <Link href="/register" className="btn btn-ghost">
                Create account
              </Link>
            </div>

            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <span className="small muted">✓ Instant or approval-based bookings</span>
              <span className="small muted">✓ Staff-specific availability</span>
              <span className="small muted">✓ Reschedule tracking</span>
            </div>
          </div>

          <div
            className="card"
            style={{
              padding: 32,
              borderRadius: 20,
              animation: 'fadeUp 0.6s var(--ease) both'
            }}
          >
            <p className="small" style={{ color: 'var(--accent)', marginBottom: '0.35rem' }}>
              For businesses
            </p>

            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.8rem',
                marginBottom: 12
              }}
            >
              Run your bookings from one workspace.
            </h2>

            <p className="muted" style={{ marginBottom: 24 }}>
              Build your customer-facing profile, add services, assign staff, set working hours and handle approvals from your dashboard.
            </p>

            <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
              <Link href="/dashboard/businesses" className="card" style={{ background: 'var(--surface-2)' }}>
                <strong>Profile readiness</strong>
                <p className="small muted">Check services, staff, hours and publishing status.</p>
              </Link>

              <Link href="/dashboard/notifications" className="card" style={{ background: 'var(--surface-2)' }}>
                <strong>Action centre</strong>
                <p className="small muted">Approve new bookings and customer reschedule requests.</p>
              </Link>

              <Link href="/dashboard/bookings" className="card" style={{ background: 'var(--surface-2)' }}>
                <strong>Appointment manager</strong>
                <p className="small muted">View confirmed, pending, completed and cancelled bookings.</p>
              </Link>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/register" className="btn btn-accent">
                Register business
              </Link>

              <Link href="/login" className="btn btn-ghost">
                Business login
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container" style={{ padding: '60px 24px' }}>
        <div style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto 2rem' }}>
          <p className="small" style={{ color: 'var(--accent)', marginBottom: '0.5rem' }}>
            Built for confidence
          </p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem' }}>
            Clear booking states for customers and businesses.
          </h2>
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            Slotly separates confirmed appointments, approval requests, reschedule requests and completed bookings so users know exactly what has happened.
          </p>
        </div>

        <div className="grid-2">
          <div className="card">
            <p className="small muted">Customers</p>
            <h3 style={{ marginTop: '0.25rem' }}>Book and track appointments</h3>
            <p className="muted" style={{ margin: '0.5rem 0 1rem' }}>
              Browse bookable businesses, choose available staff and times, track pending approvals and manage your appointments.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Link href="/explore" className="btn btn-accent">Explore marketplace</Link>
              <Link href="/notifications" className="btn btn-ghost">Notifications</Link>
            </div>
          </div>

          <div className="card">
            <p className="small muted">Businesses</p>
            <h3 style={{ marginTop: '0.25rem' }}>Control how bookings are accepted</h3>
            <p className="muted" style={{ margin: '0.5rem 0 1rem' }}>
              Use instant confirmation for simple flows or manual approval when you want to review each booking request first.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Link href="/dashboard" className="btn btn-accent">Business dashboard</Link>
              <Link href="/dashboard/businesses" className="btn btn-ghost">Setup profile</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}