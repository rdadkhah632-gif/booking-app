import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'

type Props = {
  children: React.ReactNode
  title?: string
  subtitle?: string
}

export default function DashboardLayout({ children, title, subtitle }: Props) {
  const router = useRouter()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const links = [
    { href: '/dashboard', label: 'Overview' },
    { href: '/dashboard/businesses', label: 'Business profile' },
    { href: '/dashboard/services', label: 'Services' },
    { href: '/dashboard/availability', label: 'Working hours' },
    { href: '/dashboard/bookings', label: 'Bookings' }
  ]

  return (
    <main className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Link href="/" className="logo">
            Slot<span>ly</span>
          </Link>
          <p className="small muted" style={{ marginTop: '0.35rem' }}>
            Business control panel
          </p>
        </div>

        <nav className="sidebar-nav">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`sidebar-link ${router.pathname === link.href ? 'active' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', padding: '1rem 0.5rem' }}>
          <Link href="/explore" className="sidebar-link">
            View marketplace
          </Link>

          <button
            onClick={logout}
            className="sidebar-link"
            style={{
              width: '100%',
              textAlign: 'left',
              border: 'none',
              marginTop: '0.5rem',
              background: 'transparent',
              color: 'var(--text-muted)'
            }}
          >
            Log out
          </button>
        </div>
      </aside>

      <section className="dashboard-main">
        {(title || subtitle) && (
          <div style={{ marginBottom: '1.5rem' }}>
            {title && (
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '2rem',
                  marginBottom: '0.25rem'
                }}
              >
                {title}
              </h1>
            )}

            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
        )}

        {children}
      </section>
    </main>
  )
}