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
  const [preferredLanguage, setPreferredLanguage] = useState<Locale>(() => {
    if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('sq')) return 'sq'
    return 'en'
  })
  const [role, setRole] = useState<'customer' | 'business' | 'staff'>('customer')
  const [businessName, setBusinessName] = useState('')
  const [businessPhone, setBusinessPhone] = useState('')
  const [businessCategory, setBusinessCategory] = useState('')
  const [businessCity, setBusinessCity] = useState('')
  const [businessCountry, setBusinessCountry] = useState('Albania')
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
    if (locale) {
      setPreferredLanguage(locale)
      return
    }

    if (navigator.language.toLowerCase().startsWith('sq')) {
      setPreferredLanguage('sq')
      setLocale('sq')
    }
  }, [locale, setLocale])

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
      setError(t('register.passwordTooShort', 'Password must be at least 6 characters.'))
      setLoading(false)
      return
    }

    const staffInvite = role === 'staff'
      ? detectedStaffInvite
      : null

    if (role === 'staff' && !staffInvite) {
      setError(t('register.noStaffInvite', 'This staff account needs a valid staff invite before it can be created.'))
      setLoading(false)
      return
    }

    if (role === 'business') {
      if (!businessName.trim()) {
        setError(t('register.business.nameRequired', 'Business name is required.'))
        setLoading(false)
        return
      }

      if (!businessPhone.trim()) {
        setError(t('register.business.phoneRequired', 'Business phone is required.'))
        setLoading(false)
        return
      }

      if (!businessCategory.trim()) {
        setError(t('register.business.categoryRequired', 'Business category is required.'))
        setLoading(false)
        return
      }

      if (!businessCity.trim()) {
        setError(t('register.business.cityRequired', 'Business city is required.'))
        setLoading(false)
        return
      }

      if (!businessCountry.trim()) {
        setError(t('register.business.countryRequired', 'Business country is required.'))
        setLoading(false)
        return
      }
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

      if (role === 'business') {
        const { error: businessError } = await supabase
          .from('businesses')
          .insert({
            user_id: data.user.id,
            name: businessName.trim(),
            phone: businessPhone.trim(),
            category: businessCategory.trim(),
            city: businessCity.trim(),
            country: businessCountry.trim(),
            published: false
          })

        if (businessError) {
          setError(businessError.message)
          setLoading(false)
          return
        }
      }
    }

    setLoading(false)

    setMessage(
      role === 'business'
        ? t('register.success.business', 'Business account created. Redirecting to your dashboard...')
        : role === 'staff'
          ? t('register.success.staff', 'Staff account created. Redirecting to your staff area...')
          : t('register.success.customer', 'Customer account created. Redirecting to your bookings...')
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
            <p className="muted">{t('register.checkingSession', 'Checking your account...')}</p>
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
            {t('register.kicker', 'Create account')}
          </p>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '2rem',
            marginBottom: 8
          }}>
            {t('register.title', 'Create your Mirëbook account')}
          </h1>

          <p className="muted" style={{ marginBottom: '1.5rem' }}>
            {t('register.subtitle', 'Choose the account type that fits how you will use Mirëbook.')}
          </p>

          <div className="register-role-grid register-role-grid-top">
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
              <strong>{t('register.role.customer', 'Customer')}</strong>
              <p className="small muted">{t('register.role.customerBody', 'Book and manage appointments.')}</p>
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
              <strong>{t('register.role.business', 'Business')}</strong>
              <p className="small muted">{t('register.role.businessBody', 'Create services, staff and bookings.')}</p>
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
              <strong>{t('register.role.staff', 'Staff')}</strong>
              <p className="small muted">{t('register.role.staffBody', 'Join a business you have been invited to.')}</p>
            </button>
          </div>

          {detectedStaffInvite && (
            <div className="card" style={{ background: 'rgba(45,212,191,0.08)', borderColor: 'rgba(45,212,191,0.28)', marginBottom: '1rem' }}>
              <p className="small" style={{ color: 'var(--success)' }}>{t('register.staffInviteFound', 'Staff invite found')}</p>
              <strong>{detectedStaffInvite.name}</strong>
              <p className="small muted" style={{ marginTop: '0.35rem' }}>
                {t('register.staffInviteBody', 'This email matches a staff invite. Your account will be linked after registration.')}
              </p>
            </div>
          )}

          {role === 'staff' && !detectedStaffInvite && email.trim().includes('@') && (
            <div className="card" style={{ background: 'rgba(255,190,11,0.08)', borderColor: 'rgba(255,190,11,0.28)', marginBottom: '1rem' }}>
              <p className="small" style={{ color: 'var(--warning)' }}>{t('register.noStaffInviteTitle', 'No staff invite found')}</p>
              <p className="small muted" style={{ marginTop: '0.35rem' }}>
                {t('register.noStaffInviteBody', 'Ask the business to add your email to their staff list first.')}
              </p>
            </div>
          )}

          <form onSubmit={onRegister} className="form-grid">
            <input
              type="email"
              placeholder={t('register.emailPlaceholder', 'Email address')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <input
              type="password"
              placeholder={t('register.passwordPlaceholder', 'Password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <div className="register-role-mobile">
              <label className="small muted" style={{ display: 'grid', gap: '0.4rem' }}>
                {t('register.accountType', 'Account type')}
                <select value={role} onChange={(e) => setRole(e.target.value as 'customer' | 'business' | 'staff')}>
                  <option value="customer">{t('register.role.customer', 'Customer')}</option>
                  <option value="business">{t('register.role.business', 'Business')}</option>
                  <option value="staff">{t('register.role.staff', 'Staff')}</option>
                </select>
              </label>
            </div>

            <label className="small muted" style={{ display: 'grid', gap: '0.4rem' }}>
              {t('register.preferredLanguage', 'Preferred language')}
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

            {role === 'business' && (
              <div className="register-business-fields">
                <div>
                  <p className="small muted">{t('register.business.kicker', 'Business quick setup')}</p>
                  <h3>{t('register.business.title', 'Tell us about your business')}</h3>
                  <p className="small muted" style={{ marginTop: '0.35rem' }}>
                    {t('register.business.body', 'These details create your starter business profile. You can complete services, staff, images and opening hours after signing in.')}
                  </p>
                </div>

                <input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder={t('register.business.namePlaceholder', 'Business name')}
                  required={role === 'business'}
                />

                <input
                  value={businessPhone}
                  onChange={(e) => setBusinessPhone(e.target.value)}
                  placeholder={t('register.business.phonePlaceholder', 'Business phone')}
                  required={role === 'business'}
                />

                <select
                  value={businessCategory}
                  onChange={(e) => setBusinessCategory(e.target.value)}
                  required={role === 'business'}
                >
                  <option value="">{t('register.business.categoryPlaceholder', 'Choose business category')}</option>
                  <option value="Barber">{t('categories.barber', 'Barber')}</option>
                  <option value="Hair salon">{t('categories.hairSalon', 'Hair salon')}</option>
                  <option value="Nails">{t('categories.nails', 'Nails')}</option>
                  <option value="Beauty">{t('categories.beauty', 'Beauty')}</option>
                  <option value="Tattoo">{t('categories.tattoo', 'Tattoo')}</option>
                  <option value="Pet grooming">{t('categories.petGrooming', 'Pet grooming')}</option>
                  <option value="Other">{t('categories.other', 'Other')}</option>
                </select>

                <div className="register-business-location-grid">
                  <input
                    value={businessCity}
                    onChange={(e) => setBusinessCity(e.target.value)}
                    placeholder={t('register.business.cityPlaceholder', 'City')}
                    required={role === 'business'}
                  />

                  <input
                    value={businessCountry}
                    onChange={(e) => setBusinessCountry(e.target.value)}
                    placeholder={t('register.business.countryPlaceholder', 'Country')}
                    required={role === 'business'}
                  />
                </div>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-accent">
              {loading
                ? t('register.creating', 'Creating account...')
                : role === 'business'
                  ? t('register.createBusiness', 'Create business account')
                  : role === 'staff'
                    ? t('register.createStaff', 'Create staff account')
                    : t('register.createCustomer', 'Create customer account')}
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
            {t('register.alreadyHaveAccount', 'Already have an account?')} <Link href="/login" style={{ color: 'var(--accent)' }}>{t('register.loginLink', 'Login')}</Link>
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

        .register-role-mobile {
          display: none;
        }

        .register-business-fields {
          display: grid;
          gap: 0.85rem;
          padding: 1rem;
          border: 1px solid rgba(255,107,53,0.22);
          border-radius: var(--radius);
          background: rgba(255,107,53,0.06);
        }

        .register-business-fields h3 {
          font-family: var(--font-display);
        }

        .register-business-location-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
        }

        @media (max-width: 760px) {
          .register-role-grid-top {
            display: none;
          }

          .register-role-mobile {
            display: block;
          }

          .register-business-location-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  )
}