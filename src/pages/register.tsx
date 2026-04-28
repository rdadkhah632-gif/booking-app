import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'

export default function RegisterPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'customer' | 'business'>('customer')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const cleanEmail = email.trim().toLowerCase()

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          role
        }
      }
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: data.user.id,
            email: cleanEmail,
            role
          },
          { onConflict: 'id' }
        )

      if (profileError) {
        setError(profileError.message)
        setLoading(false)
        return
      }
    }

    setLoading(false)

    setMessage(
      role === 'business'
        ? 'Business account created. You can now log in and set up your business profile.'
        : 'Customer account created. You can now log in and book appointments.'
    )

    setTimeout(() => {
      router.replace('/login')
    }, 900)
  }

  return (
    <main>
      <nav className="nav-simple">
        <div className="nav-simple-inner">
          <Link href="/" className="logo">
            Slot<span>ly</span>
          </Link>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Link href="/explore" className="muted">Browse</Link>
            <Link href="/login" className="btn btn-ghost">Login</Link>
          </div>
        </div>
      </nav>

      <section className="auth-wrap">
        <div className="auth-card">
          <p className="small muted" style={{ marginBottom: '0.5rem' }}>
            Create account
          </p>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '2rem',
            marginBottom: 8
          }}>
            Join Slotly
          </h1>

          <p className="muted" style={{ marginBottom: '1.5rem' }}>
            Register as a customer to book appointments, or as a business to manage services and bookings.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.75rem',
            marginBottom: '1.5rem'
          }}>
            <button
              type="button"
              onClick={() => setRole('customer')}
              style={{
                background: role === 'customer' ? 'var(--accent-dim)' : 'var(--surface-2)',
                border: role === 'customer' ? '1px solid rgba(255,107,53,0.45)' : '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--text)',
                padding: '1rem',
                textAlign: 'left'
              }}
            >
              <strong>Customer</strong>
              <p className="small muted">Book and manage appointments.</p>
            </button>

            <button
              type="button"
              onClick={() => setRole('business')}
              style={{
                background: role === 'business' ? 'var(--accent-dim)' : 'var(--surface-2)',
                border: role === 'business' ? '1px solid rgba(255,107,53,0.45)' : '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--text)',
                padding: '1rem',
                textAlign: 'left'
              }}
            >
              <strong>Business</strong>
              <p className="small muted">Create services and receive bookings.</p>
            </button>
          </div>

          <form onSubmit={onRegister} className="form-grid">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button type="submit" disabled={loading} className="btn btn-accent">
              {loading ? 'Creating account...' : `Register as ${role}`}
            </button>
          </form>

          {error && (
            <p style={{ color: 'var(--danger)', marginTop: '1rem' }}>
              {error}
            </p>
          )}

          {message && (
            <p style={{ color: 'var(--success)', marginTop: '1rem' }}>
              {message}
            </p>
          )}

          <p className="small muted" style={{ marginTop: '1.5rem' }}>
            Already have an account? <Link href="/login" style={{ color: 'var(--accent)' }}>Login</Link>
          </p>
        </div>
      </section>
    </main>
  )
}