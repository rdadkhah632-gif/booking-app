import Link from 'next/link'

export default function Home() {
  return (
    <main>
      <nav className="nav-simple">
        <div className="nav-simple-inner">
          <Link href="/" className="logo">
            Slot<span>ly</span>
          </Link>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Link href="/explore" className="muted">Browse</Link>
            <Link href="/my-bookings" className="muted">My bookings</Link>
            <Link href="/login" className="muted">Login</Link>
            <Link href="/register" className="btn btn-accent">Join</Link>
          </div>
        </div>
      </nav>

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

            <div style={{
              display: 'flex',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              overflow: 'hidden',
              maxWidth: 620,
              marginBottom: 24
            }}>
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                padding: '13px 16px',
                borderRight: '1px solid var(--border)'
              }}>
                <span className="small muted">What are you looking for?</span>
                <span>Haircut, dental checkup, massage...</span>
              </div>

              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                padding: '13px 16px',
                borderRight: '1px solid var(--border)'
              }}>
                <span className="small muted">Location</span>
                <span>Coventry, Tirana, London...</span>
              </div>

              <Link href="/explore" className="btn btn-accent" style={{
                borderRadius: 0,
                padding: '0 28px'
              }}>
                Search
              </Link>
            </div>

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
              <div className="card" style={{ background: 'var(--surface-2)' }}>
                <strong>Manage services</strong>
                <p className="small muted">Duration, price and active status.</p>
              </div>

              <div className="card" style={{ background: 'var(--surface-2)' }}>
                <strong>Control availability</strong>
                <p className="small muted">Set opening hours and prevent overlaps.</p>
              </div>

              <div className="card" style={{ background: 'var(--surface-2)' }}>
                <strong>View bookings</strong>
                <p className="small muted">See customer details and cancel bookings.</p>
              </div>
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