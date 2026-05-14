import AuthNav from '@/components/AuthNav'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'

export default function RegisterPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'customer' | 'business' | 'staff'>('customer')
  const [detectedStaffInvite, setDetectedStaffInvite] = useState<{
    id: string
    business_id: string
    name: string
    email: string | null
    invite_status?: string | null
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  async function redirectByRole(userId: string) {
    const { data: linkedStaff } = await supabase
      .from('staff_members')
      .select('id')
      .eq('user_id', userId)
      .limit(1)

    if (linkedStaff && linkedStaff.length > 0) {
      router.replace('/staff')
      return
    }

    const { data: ownedBusinesses } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', userId)
      .limit(1)

    if (ownedBusinesses && ownedBusinesses.length > 0) {
      router.replace('/dashboard')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (profile?.role === 'business') {
      router.replace('/dashboard')
    } else {
      router.replace('/my-bookings')
    }
  }

  useEffect(() => {
    async function checkExistingSession() {
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        await redirectByRole(session.user.id)
        return
      }

      setCheckingSession(false)
    }

    if (!router.isReady) return
    checkExistingSession()
  }, [router.isReady])

  useEffect(() => {
    async function checkStaffInvite() {
      const cleanEmail = email.trim().toLowerCase()

      if (!cleanEmail || !cleanEmail.includes('@')) {
        setDetectedStaffInvite(null)
        return
      }

      const { data } = await supabase
        .from('staff_members')
        .select('id, business_id, name, email, invite_status')
        .eq('email', cleanEmail)
        .is('user_id', null)
        .limit(1)
        .maybeSingle()

      if (data) {
        setDetectedStaffInvite(data)
        setRole('staff')
      } else {
        setDetectedStaffInvite(null)
      }
    }

    const timeout = window.setTimeout(checkStaffInvite, 350)
    return () => window.clearTimeout(timeout)
  }, [email])

  async function onRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const cleanEmail = email.trim().toLowerCase()

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      setLoading(false)
      return
    }

    const staffInvite = role === 'staff'
      ? detectedStaffInvite
      : null

    if (role === 'staff' && !staffInvite) {
      setError('No open staff invite was found for this email. Ask the business owner to add your email in their staff setup first.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          role: role === 'staff' ? 'customer' : role,
          account_mode: role
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
            role: role === 'staff' ? 'customer' : role
          },
          { onConflict: 'id' }
        )

      if (profileError) {
        setError(profileError.message)
        setLoading(false)
        return
      }

      if (staffInvite) {
        const { error: staffLinkError } = await supabase
          .from('staff_members')
          .update({
            user_id: data.user.id,
            invite_status: 'linked'
          })
          .eq('id', staffInvite.id)

        if (staffLinkError) {
          setError(staffLinkError.message)
          setLoading(false)
          return
        }
      }
    }

    setLoading(false)

    setMessage(
      role === 'business'
        ? 'Business account created. Taking you to your Mirëbook dashboard setup.'
        : role === 'staff'
          ? 'Staff account linked. Taking you to your staff schedule.'
          : 'Customer account created. Taking you to your bookings.'
    )

    setTimeout(() => {
      router.replace(role === 'business' ? '/dashboard' : role === 'staff' ? '/staff' : '/my-bookings')
    }, 900)
  }

  if (checkingSession) {
    return (
      <main>
        <AuthNav />
        <section className="auth-wrap">
          <div className="card">
            <p className="muted">Checking your Mirëbook session...</p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main>
      <AuthNav />

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
            Join Mirëbook
          </h1>

          <p className="muted" style={{ marginBottom: '1.5rem' }}>
            Register as a customer to book appointments, as a business to manage services and staff, or as invited staff to access your own schedule.
          </p>

          <div className="register-role-grid">
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
              <p className="small muted">Book, reschedule and track appointments.</p>
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
              <p className="small muted">Manage services, staff, availability and booking approvals.</p>
            </button>

            <button
              type="button"
              onClick={() => setRole('staff')}
              style={{
                background: role === 'staff' ? 'var(--accent-dim)' : 'var(--surface-2)',
                border: role === 'staff' ? '1px solid rgba(255,107,53,0.45)' : '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--text)',
                padding: '1rem',
                textAlign: 'left'
              }}
            >
              <strong>Staff</strong>
              <p className="small muted">Join a business team using the email they added for you.</p>
            </button>
          </div>

          {detectedStaffInvite && (
            <div className="card" style={{ background: 'rgba(45,212,191,0.08)', borderColor: 'rgba(45,212,191,0.28)', marginBottom: '1rem' }}>
              <p className="small" style={{ color: 'var(--success)' }}>Staff invite found</p>
              <strong>{detectedStaffInvite.name}</strong>
              <p className="small muted" style={{ marginTop: '0.35rem' }}>
                This email is listed on a Mirëbook business staff profile. Registering as staff will link this account to that staff profile.
              </p>
            </div>
          )}

          {role === 'staff' && !detectedStaffInvite && email.trim().includes('@') && (
            <div className="card" style={{ background: 'rgba(255,190,11,0.08)', borderColor: 'rgba(255,190,11,0.28)', marginBottom: '1rem' }}>
              <p className="small" style={{ color: 'var(--warning)' }}>No staff invite found yet</p>
              <p className="small muted" style={{ marginTop: '0.35rem' }}>
                Ask the business owner to add this email in their Staff setup page before creating a staff account.
              </p>
            </div>
          )}

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
              {loading
                ? 'Creating account...'
                : role === 'business'
                  ? 'Create business account'
                  : role === 'staff'
                    ? 'Create staff account'
                    : 'Create customer account'}
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
            Already have an account? <Link href="/login" style={{ color: 'var(--accent)' }}>Login to Mirëbook</Link>
          </p>
        </div>
      </section>
      <style jsx>{`
        .register-role-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        @media (max-width: 760px) {
          .register-role-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  )
}