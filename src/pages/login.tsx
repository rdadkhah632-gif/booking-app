import AuthNav from '@/components/AuthNav'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import { useI18n } from '@/lib/useI18n'

export default function LoginPage() {
  const router = useRouter()
  const { t } = useI18n()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  async function redirectByRole(userId: string, fallbackEmail?: string) {
    const cleanEmail = fallbackEmail?.trim().toLowerCase() || ''

    const { data: linkedStaffByUserId } = await supabase
      .from('staff_members')
      .select('id, business_id, email, invite_status')
      .eq('user_id', userId)
      .limit(1)

    if (linkedStaffByUserId && linkedStaffByUserId.length > 0) {
      router.replace('/staff')
      return
    }

    if (cleanEmail) {
      const { data: unlinkedStaffInvite } = await supabase
        .from('staff_members')
        .select('id, business_id, email, invite_status')
        .eq('email', cleanEmail)
        .is('user_id', null)
        .limit(1)
        .maybeSingle()

      if (unlinkedStaffInvite?.id) {
        const { error: linkStaffError } = await supabase
          .from('staff_members')
          .update({
            user_id: userId,
            invite_status: 'linked'
          })
          .eq('id', unlinkedStaffInvite.id)

        if (linkStaffError) {
          throw new Error(linkStaffError.message)
        }

        router.replace('/staff')
        return
      }
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

    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      const { data: { user } } = await supabase.auth.getUser()
      const metadataRole = user?.user_metadata?.role === 'business' ? 'business' : 'customer'

      const { data: createdProfile, error: createProfileError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: userId,
            email: fallbackEmail || user?.email || '',
            role: metadataRole
          },
          { onConflict: 'id' }
        )
        .select('role')
        .single()

      if (createProfileError || !createdProfile) {
        throw new Error('Could not load or create user profile')
      }

      profile = createdProfile
    }

    if (profile.role === 'business') {
      router.replace('/dashboard')
    } else {
      const redirectTo = typeof router.query.redirectTo === 'string' ? router.query.redirectTo : '/my-bookings'
      router.replace(redirectTo.startsWith('/') ? redirectTo : '/my-bookings')
    }
  }

  useEffect(() => {
    async function checkExistingSession() {
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        try {
          await redirectByRole(session.user.id, session.user.email || undefined)
          return
        } catch {
          setCheckingSession(false)
          return
        }
      }

      setCheckingSession(false)
    }

    if (!router.isReady) return
    checkExistingSession()
  }, [router.isReady])

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
      setError(t('login.failed', 'Login failed. Please try again.'))
      setLoading(false)
      return
    }

    try {
      await redirectByRole(user.id, cleanEmail)
    } catch (err: any) {
      setError(err.message || t('login.profileError', 'Could not load your profile. Please try again.'))
      setLoading(false)
      return
    }

    setLoading(false)
  }

  if (checkingSession) {
    return (
      <main>
        <AuthNav />
        <section className="auth-wrap">
          <div className="card">
            <p className="muted">{t('login.checkingSession', 'Checking your account...')}</p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main>
      <AuthNav />

      <section className="auth-wrap">
        <div className="login-shell">
          <div className="login-promo-panel">
            <div style={{
              position: 'absolute',
              top: '-30%',
              left: '-20%',
              width: 400,
              height: 400,
              background: 'radial-gradient(circle, rgba(255,107,53,0.18) 0%, transparent 70%)'
            }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="logo login-promo-logo">
                Mirë<span>book</span>
              </div>

              <h1 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '2.2rem',
                lineHeight: 1.15,
                letterSpacing: '-0.03em',
                marginBottom: 16
              }}>
                {t('login.promoTitle', 'Welcome back to Mirëbook')}
              </h1>

              <p className="muted">
                {t('login.promoBody', 'Sign in to manage bookings, services, staff and customer appointments from one place.')}
              </p>
            </div>

            <div className="login-proof-list">
              <div className="card" style={{ background: 'rgba(255,255,255,0.04)' }}>
                {t('login.proof.routing', 'Customers are routed to the right booking flow automatically.')}
              </div>
              <div className="card" style={{ background: 'rgba(255,255,255,0.04)' }}>
                {t('login.proof.availability', 'Availability, staff and services stay connected.')}
              </div>
              <div className="card" style={{ background: 'rgba(255,255,255,0.04)' }}>
                {t('login.proof.workflows', 'Approval, reschedule and cancellation workflows are built in.')}
              </div>
            </div>
          </div>

          <div className="login-form-panel">
            <p className="small muted" style={{ marginBottom: '0.5rem' }}>
              {t('login.kicker', 'Sign in')}
            </p>

            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2rem',
              marginBottom: 8
            }}>
              {t('login.title', 'Login to Mirëbook')}
            </h2>

            <p className="muted" style={{ marginBottom: '2rem' }}>
              {t('login.subtitle', 'Use the same login for customer, business or staff access.')}
            </p>

            <form onSubmit={onLogin} className="form-grid">
              <input
                type="email"
                placeholder={t('login.emailPlaceholder', 'Email address')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <input
                type="password"
                placeholder={t('login.passwordPlaceholder', 'Password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button type="submit" disabled={loading} className="btn btn-accent">
                {loading ? t('login.loading', 'Signing in...') : t('login.submit', 'Sign in')}
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
              {t('login.noAccount', 'No account yet?')} <Link href="/register" style={{ color: 'var(--accent)' }}>{t('login.createAccount', 'Create account')}</Link>
            </p>
          </div>
        </div>
      </section>
      <style jsx>{`
        .login-shell {
          display: grid;
          grid-template-columns: 1fr 480px;
          max-width: 960px;
          width: 100%;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 24px;
          overflow: hidden;
        }

        .login-promo-panel {
          background: linear-gradient(145deg, #13121e 0%, #1f1d30 100%);
          padding: 44px 40px;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 480px;
        }

        .login-promo-logo {
          margin-bottom: 2rem;
        }

        .login-proof-list {
          position: relative;
          z-index: 1;
          display: grid;
          gap: 12px;
        }

        .login-form-panel {
          padding: 40px;
        }

        @media (max-width: 860px) {
          .login-shell {
            grid-template-columns: 1fr;
          }

          .login-form-panel {
            order: 1;
          }

          .login-promo-panel {
            order: 2;
            min-height: auto;
            padding: 24px 22px;
            gap: 1rem;
          }

          .login-promo-logo {
            display: none;
          }

          .login-proof-list {
            display: none;
          }
        }

        @media (max-width: 520px) {
          .login-form-panel {
            padding: 24px 18px;
          }

          .login-form-panel h2 {
            font-size: 1.65rem !important;
          }

          .login-form-panel p[style] {
            margin-bottom: 1rem !important;
          }
        }
      `}</style>
    </main>
  )
}