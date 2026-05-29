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
                {t('login.promoBody', 'Sign in and Mirëbook will take you to the right workspace for your account: customer, staff, business or operator.')}
              </p>
            </div>

            <div className="login-proof-list">
              <div className="card login-proof-card">
                <strong>{t('login.proof.customerTitle', 'Customers')}</strong>
                <span>{t('login.proof.customerBody', 'View bookings, requests and appointment history.')}</span>
              </div>
              <div className="card login-proof-card">
                <strong>{t('login.proof.staffTitle', 'Staff')}</strong>
                <span>{t('login.proof.staffBody', 'Open your schedule, calendar, availability and updates.')}</span>
              </div>
              <div className="card login-proof-card">
                <strong>{t('login.proof.businessTitle', 'Businesses')}</strong>
                <span>{t('login.proof.businessBody', 'Manage setup, services, staff, bookings and publishing.')}</span>
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

            <p className="muted login-subtitle">
              {t('login.subtitle', 'Use one login. Mirëbook detects whether this account is a customer, staff member, business owner or operator.')}
            </p>

            <div className="login-role-strip">
              <span>{t('nav.role.customer', 'Customer')}</span>
              <span>{t('nav.role.staff', 'Staff')}</span>
              <span>{t('nav.role.business', 'Business')}</span>
            </div>

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

              <button type="submit" disabled={loading} className="btn btn-accent login-submit-button">
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

            <div className="login-bottom-actions">
              <p className="small muted">
                {t('login.noAccount', 'No account yet?')} <Link href="/register" style={{ color: 'var(--accent)' }}>{t('login.createAccount', 'Create account')}</Link>
              </p>
              <p className="small muted">
                {t('login.staffHint', 'Staff invited by a business should sign in or register using the invited email address.')}
              </p>
            </div>
          </div>
        </div>
      </section>
      <style jsx>{`
        .login-shell {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(380px, 480px);
          max-width: 980px;
          width: 100%;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 22px 70px rgba(0,0,0,0.22);
        }

        .login-promo-panel {
          background: linear-gradient(145deg, #13121e 0%, #1f1d30 100%);
          padding: 44px 40px;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 500px;
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

        .login-proof-card {
          background: rgba(255,255,255,0.04);
          display: grid;
          gap: 0.25rem;
        }

        .login-proof-card strong {
          color: var(--text);
        }

        .login-proof-card span {
          color: var(--text-muted);
          font-size: 0.85rem;
          line-height: 1.4;
        }

        .login-form-panel {
          padding: 40px;
          align-self: center;
        }

        .login-subtitle {
          margin-bottom: 1rem;
        }

        .login-role-strip {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-bottom: 1.5rem;
        }

        .login-role-strip span {
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 0.25rem 0.6rem;
          color: var(--text-muted);
          font-size: 0.78rem;
          background: var(--surface-2);
        }

        .login-submit-button {
          width: 100%;
          justify-content: center;
        }

        .login-bottom-actions {
          display: grid;
          gap: 0.65rem;
          margin-top: 1.5rem;
        }

        @media (max-width: 860px) {
          .login-shell {
            grid-template-columns: 1fr;
            max-width: 560px;
          }

          .login-form-panel {
            order: 1;
          }

          .login-promo-panel {
            order: 2;
            min-height: auto;
            padding: 20px 22px;
            gap: 0.75rem;
          }

          .login-promo-logo {
            display: none;
          }

          .login-proof-list {
            display: none;
          }
        }

        @media (max-width: 520px) {
          .login-shell {
            border-radius: 18px;
          }

          .login-form-panel {
            padding: 22px 18px;
          }

          .login-form-panel h2 {
            font-size: 1.55rem !important;
          }

          .login-role-strip {
            margin-bottom: 1rem;
          }

          .login-promo-panel {
            display: none;
          }
        }
      `}</style>
    </main>
  )
}