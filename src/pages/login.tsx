import AuthNav from '@/components/AuthNav'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const cleanEmail = email.trim().toLowerCase()

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const user = data.user

    if (!user) {
      setError('Login failed')
      setLoading(false)
      return
    }

    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      const metadataRole = user.user_metadata?.role === 'business' ? 'business' : 'customer'

      const { data: createdProfile, error: createProfileError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            email: cleanEmail,
            role: metadataRole
          },
          { onConflict: 'id' }
        )
        .select('role')
        .single()

      if (createProfileError || !createdProfile) {
        setError('Could not load or create user profile')
        setLoading(false)
        return
      }

      profile = createdProfile
    }

    setLoading(false)

    if (profile.role === 'business') {
      router.replace('/dashboard')
    } else {
      router.replace('/explore')
    }
  }

  return (
    <main>
      <AuthNav />

      <section className="auth-wrap">
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 480px',
          maxWidth: 960,
          width: '100%',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 24,
          overflow: 'hidden'
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #13121e 0%, #1f1d30 100%)',
            padding: '56px 48px',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 520
          }}>
            <div style={{
              position: 'absolute',
              top: '-30%',
              left: '-20%',
              width: 400,
              height: 400,
              background: 'radial-gradient(circle, rgba(255,107,53,0.18) 0%, transparent 70%)'
            }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="logo" style={{ marginBottom: '3rem' }}>
                Slot<span>ly</span>
              </div>

              <h1 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '2.2rem',
                lineHeight: 1.15,
                letterSpacing: '-0.03em',
                marginBottom: 16
              }}>
                Welcome back to your booking hub.
              </h1>

              <p className="muted">
                Customers can manage appointments. Businesses can manage services,
                working hours and bookings from one place.
              </p>
            </div>

            <div style={{
              position: 'relative',
              zIndex: 1,
              display: 'grid',
              gap: 12
            }}>
              <div className="card" style={{ background: 'rgba(255,255,255,0.04)' }}>
                ✓ Role-based login
              </div>
              <div className="card" style={{ background: 'rgba(255,255,255,0.04)' }}>
                ✓ Live booking availability
              </div>
              <div className="card" style={{ background: 'rgba(255,255,255,0.04)' }}>
                ✓ Customer and business dashboards
              </div>
            </div>
          </div>

          <div style={{ padding: 40 }}>
            <p className="small muted" style={{ marginBottom: '0.5rem' }}>
              Sign in
            </p>

            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2rem',
              marginBottom: 8
            }}>
              Login
            </h2>

            <p className="muted" style={{ marginBottom: '2rem' }}>
              Use your customer or business account. We’ll send you to the right dashboard.
            </p>

            <form onSubmit={onLogin} className="form-grid">
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
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>

            {error && (
              <p style={{
                color: 'var(--danger)',
                marginTop: '1rem'
              }}>
                {error}
              </p>
            )}

            <p className="small muted" style={{ marginTop: '1.5rem' }}>
              No account yet? <Link href="/register" style={{ color: 'var(--accent)' }}>Create one</Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}