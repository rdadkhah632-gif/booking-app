import AuthNav from '@/components/AuthNav'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import { useI18n } from '@/lib/useI18n'
import { Locale } from '@/lib/i18n'

export default function RegisterPage() {
  const router = useRouter()
  const { locale, setLocale, t } = useI18n()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [preferredLanguage, setPreferredLanguage] = useState<Locale>('en')
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
    setPreferredLanguage(locale)
  }, [locale])

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
    await setLocale(preferredLanguage)
    setLoading(true)
    setError(null)
    setMessage(null)

    const cleanEmail = email.trim().toLowerCase()

    if (password.length < 6) {
      setError(t('register.passwordTooShort'))
      setLoading(false)
      return
    }

    const staffInvite = role === 'staff'
      ? detectedStaffInvite
      : null

    if (role === 'staff' && !staffInvite) {
      setError(t('register.noStaffInvite'))
      setLoading(false)
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          role: role === 'staff' ? 'customer' : role,
          account_mode: role,
          preferred_language: preferredLanguage
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
            role: role === 'staff' ? 'customer' : role,
            preferred_language: preferredLanguage
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
        ? t('register.success.business')
        : role === 'staff'
          ? t('register.success.staff')
          : t('register.success.customer')
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
            <p className="muted">{t('register.checkingSession')}</p>
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
            {t('register.kicker')}
          </p>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '2rem',
            marginBottom: 8
          }}>
            {t('register.title')}
          </h1>

          <p className="muted" style={{ marginBottom: '1.5rem' }}>
            {t('register.subtitle')}
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
              <strong>{t('register.role.customer')}</strong>
              <p className="small muted">{t('register.role.customerBody')}</p>
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
              <strong>{t('register.role.business')}</strong>
              <p className="small muted">{t('register.role.businessBody')}</p>
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
              <strong>{t('register.role.staff')}</strong>
              <p className="small muted">{t('register.role.staffBody')}</p>
            </button>
          </div>

          {detectedStaffInvite && (
            <div className="card" style={{ background: 'rgba(45,212,191,0.08)', borderColor: 'rgba(45,212,191,0.28)', marginBottom: '1rem' }}>
              <p className="small" style={{ color: 'var(--success)' }}>{t('register.staffInviteFound')}</p>
              <strong>{detectedStaffInvite.name}</strong>
              <p className="small muted" style={{ marginTop: '0.35rem' }}>
                {t('register.staffInviteBody')}
              </p>
            </div>
          )}

          {role === 'staff' && !detectedStaffInvite && email.trim().includes('@') && (
            <div className="card" style={{ background: 'rgba(255,190,11,0.08)', borderColor: 'rgba(255,190,11,0.28)', marginBottom: '1rem' }}>
              <p className="small" style={{ color: 'var(--warning)' }}>{t('register.noStaffInviteTitle')}</p>
              <p className="small muted" style={{ marginTop: '0.35rem' }}>
                {t('register.noStaffInviteBody')}
              </p>
            </div>
          )}

          <form onSubmit={onRegister} className="form-grid">
            <input
              type="email"
              placeholder={t('register.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <input
              type="password"
              placeholder={t('register.passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <label className="small muted" style={{ display: 'grid', gap: '0.4rem' }}>
              {t('register.preferredLanguage')}
              <select
                value={preferredLanguage}
                onChange={(e) => {
                  const nextLanguage = e.target.value as Locale
                  setPreferredLanguage(nextLanguage)
                  setLocale(nextLanguage)
                }}
              >
                <option value="en">English</option>
                <option value="sq">Shqip</option>
              </select>
            </label>

            <button type="submit" disabled={loading} className="btn btn-accent">
              {loading
                ? t('register.creating')
                : role === 'business'
                  ? t('register.createBusiness')
                  : role === 'staff'
                    ? t('register.createStaff')
                    : t('register.createCustomer')}
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
            {t('register.alreadyHaveAccount')} <Link href="/login" style={{ color: 'var(--accent)' }}>{t('register.loginLink')}</Link>
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