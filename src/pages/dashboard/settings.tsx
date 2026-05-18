import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/DashboardLayout'
import { supabase } from '@/lib/supabaseClient'

type Business = {
  id: string
  name: string
  published?: boolean | null
  auto_accept_bookings?: boolean | null
  booking_interval_minutes?: number | null
  min_notice_minutes?: number | null
  max_advance_days?: number | null
  buffer_before_minutes?: number | null
  buffer_after_minutes?: number | null
  cancellation_policy?: string | null
  reschedule_policy?: string | null
  timezone?: string | null
  currency?: string | null
}

const INTERVAL_OPTIONS = [15, 30, 45, 60]
const NOTICE_OPTIONS = [
  { label: 'No minimum notice', value: 0 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '4 hours', value: 240 },
  { label: '12 hours', value: 720 },
  { label: '24 hours', value: 1440 },
  { label: '48 hours', value: 2880 }
]
const ADVANCE_OPTIONS = [
  { label: '2 weeks', value: 14 },
  { label: '1 month', value: 30 },
  { label: '2 months', value: 60 },
  { label: '3 months', value: 90 },
  { label: '6 months', value: 180 }
]
const BUFFER_OPTIONS = [0, 5, 10, 15, 30, 45, 60]
const TIMEZONE_OPTIONS = [
  'Europe/London',
  'Europe/Tirane',
  'Europe/Rome',
  'Europe/Paris',
  'Europe/Berlin'
]
const CURRENCY_OPTIONS = [
  { label: 'GBP — British pound', value: 'GBP' },
  { label: 'EUR — Euro', value: 'EUR' },
  { label: 'ALL — Albanian lek', value: 'ALL' },
  { label: 'USD — US dollar', value: 'USD' }
]

function defaultSettings(business: Business): Business {
  return {
    ...business,
    auto_accept_bookings: business.auto_accept_bookings ?? false,
    booking_interval_minutes: business.booking_interval_minutes ?? 30,
    min_notice_minutes: business.min_notice_minutes ?? 120,
    max_advance_days: business.max_advance_days ?? 60,
    buffer_before_minutes: business.buffer_before_minutes ?? 0,
    buffer_after_minutes: business.buffer_after_minutes ?? 0,
    cancellation_policy:
      business.cancellation_policy ||
      'Customers can cancel by contacting the business. Online cancellation rules will be added soon.',
    reschedule_policy:
      business.reschedule_policy ||
      'Customers can request a new time from My Bookings. The business can accept or decline the request.',
    timezone: business.timezone || 'Europe/London',
    currency: business.currency || 'GBP'
  }
}

export default function DashboardSettingsPage() {
  const router = useRouter()

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [selectedBusinessId, setSelectedBusinessId] = useState('')
  const [settings, setSettings] = useState<Business | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const selectedBusiness = useMemo(() => {
    return businesses.find((business) => business.id === selectedBusinessId) || null
  }, [businesses, selectedBusinessId])

  const settingsReadyScore = useMemo(() => {
    if (!settings) return 0

    const checks = [
      Boolean(settings.booking_interval_minutes),
      settings.min_notice_minutes !== null && settings.min_notice_minutes !== undefined,
      Boolean(settings.max_advance_days),
      settings.buffer_before_minutes !== null && settings.buffer_before_minutes !== undefined,
      settings.buffer_after_minutes !== null && settings.buffer_after_minutes !== undefined,
      Boolean(settings.cancellation_policy?.trim()),
      Boolean(settings.reschedule_policy?.trim()),
      Boolean(settings.timezone),
      Boolean(settings.currency)
    ]

    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [settings])

  const selectedBusinessPublicHref = settings ? `/explore/${settings.id}` : '/dashboard/businesses'

  const approvalModeLabel = settings?.auto_accept_bookings ? 'Instant confirmation' : 'Manual approval'

  async function loadSettings() {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login?redirectTo=/dashboard/settings')
        return
      }

      const { data, error } = await supabase
        .from('businesses')
        .select(`
          id,
          name,
          published,
          auto_accept_bookings,
          booking_interval_minutes,
          min_notice_minutes,
          max_advance_days,
          buffer_before_minutes,
          buffer_after_minutes,
          cancellation_policy,
          reschedule_policy,
          timezone,
          currency
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true })

      if (error) throw error

      const ownedBusinesses = (data || []) as Business[]
      setBusinesses(ownedBusinesses)

      const queryBusinessId = typeof router.query.businessId === 'string'
        ? router.query.businessId
        : ''

      const nextSelectedBusiness =
        ownedBusinesses.find((business) => business.id === queryBusinessId) ||
        ownedBusinesses[0] ||
        null

      if (nextSelectedBusiness) {
        setSelectedBusinessId(nextSelectedBusiness.id)
        setSettings(defaultSettings(nextSelectedBusiness))
      } else {
        setSelectedBusinessId('')
        setSettings(null)
      }

      setLoading(false)
    } catch (err: any) {
      setError(err.message || 'Could not load business settings.')
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!router.isReady) return
    loadSettings()
  }, [router.isReady])

  function selectBusiness(businessId: string) {
    const business = businesses.find((item) => item.id === businessId)
    if (!business) return

    setSelectedBusinessId(business.id)
    setSettings(defaultSettings(business))
    router.replace(`/dashboard/settings?businessId=${business.id}`, undefined, { shallow: true })
  }

  function updateSetting<K extends keyof Business>(key: K, value: Business[K]) {
    setSettings((current) => {
      if (!current) return current
      return {
        ...current,
        [key]: value
      }
    })
  }

  async function saveSettings() {
    if (!settings) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    const payload = {
      auto_accept_bookings: settings.auto_accept_bookings ?? false,
      booking_interval_minutes: settings.booking_interval_minutes ?? 30,
      min_notice_minutes: settings.min_notice_minutes ?? 120,
      max_advance_days: settings.max_advance_days ?? 60,
      buffer_before_minutes: settings.buffer_before_minutes ?? 0,
      buffer_after_minutes: settings.buffer_after_minutes ?? 0,
      cancellation_policy: settings.cancellation_policy?.trim() || null,
      reschedule_policy: settings.reschedule_policy?.trim() || null,
      timezone: settings.timezone || 'Europe/London',
      currency: settings.currency || 'GBP'
    }

    const { error } = await supabase
      .from('businesses')
      .update(payload)
      .eq('id', settings.id)

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess(`${settings.name} settings saved. ${settings.auto_accept_bookings ? 'New bookings will confirm instantly.' : 'New bookings will go to Needs action for approval.'}`)
    await loadSettings()
  }

  function settingSummary() {
    if (!settings) return 'Choose a business to manage its booking settings.'

    return `${approvalModeLabel} · ${settings.booking_interval_minutes || 30} minute slots · ${settings.min_notice_minutes || 0} minute notice · ${settings.max_advance_days || 60} days ahead`
  }

  return (
    <DashboardLayout
      title="Business settings"
      subtitle={selectedBusiness ? `Control booking approval, rules and policies for ${selectedBusiness.name}.` : 'Control booking approval, rules and policies.'}
    >
      {loading && (
        <div className="card">
          <p className="muted">Loading Mirëbook business settings...</p>
        </div>
      )}

      {!loading && businesses.length === 0 && (
        <div className="card">
          <p className="small" style={{ color: 'var(--warning)' }}>No business profile found</p>
          <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.35rem' }}>
            Create a business first
          </h2>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            Business settings become available after you create a Mirëbook business profile.
          </p>
          <Link href="/dashboard/businesses" className="btn btn-accent" style={{ marginTop: '1rem' }}>
            Open setup hub
          </Link>
        </div>
      )}

      {!loading && businesses.length > 0 && settings && (
        <>
          {error && (
            <div className="card" style={{ borderColor: 'rgba(255,77,109,0.35)', marginBottom: '1rem' }}>
              <p style={{ color: 'var(--danger)' }}>{error}</p>
            </div>
          )}

          {success && (
            <div className="card" style={{ borderColor: 'rgba(45,212,191,0.35)', background: 'rgba(45,212,191,0.06)', marginBottom: '1rem' }}>
              <p style={{ color: 'var(--success)' }}>{success}</p>
            </div>
          )}

          <div className="settings-hero card">
            <div>
              <p className="small" style={{ color: 'var(--accent)' }}>Mirëbook settings</p>
              <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                Booking rules and customer policies
              </h2>
              <p className="muted" style={{ marginTop: '0.5rem' }}>
                Set how bookings are approved, how far ahead customers can book, and what policy wording customers see before requesting changes.
              </p>
            </div>

            <div className="settings-hero-actions">
              <Link href="/dashboard/businesses" className="btn btn-ghost">
                Setup hub
              </Link>
              <Link href="/dashboard/notifications" className="btn btn-ghost">
                Needs action
              </Link>
              <Link href="/dashboard/billing" className="btn btn-ghost">
                Billing
              </Link>
              <Link href={selectedBusinessPublicHref} className="btn btn-ghost">
                View public page
              </Link>
              <button className="btn btn-accent" onClick={saveSettings} disabled={saving}>
                {saving ? 'Saving...' : 'Save settings'}
              </button>
            </div>
          </div>

          <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
            <div className="card">
              <p className="small muted">Selected business</p>
              <h3>{selectedBusiness?.name || 'Business'}</h3>
              <p className="muted small">
                {selectedBusiness?.published ? 'Published on Mirëbook' : 'Hidden / draft'}
              </p>
              <p className="muted small" style={{ marginTop: '0.35rem' }}>
                {approvalModeLabel}
              </p>
            </div>

            <div className="card">
              <p className="small muted">Settings readiness</p>
              <h3>{settingsReadyScore}%</h3>
              <p className="muted small">Booking rules and policies filled in</p>
            </div>

            <div className="card">
              <p className="small muted">Current rules</p>
              <h3 style={{ fontSize: '1rem' }}>{settingSummary()}</h3>
              <p className="muted small">Used by public booking and reschedule flows</p>
            </div>
          </div>

          {businesses.length > 1 && (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <p className="small muted">Manage another business</p>
              <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                Choose business settings
              </h2>

              <div className="settings-business-list">
                {businesses.map((business) => (
                  <button
                    key={business.id}
                    type="button"
                    className={business.id === selectedBusinessId ? 'settings-business-card settings-business-card-active' : 'settings-business-card'}
                    onClick={() => selectBusiness(business.id)}
                  >
                    <strong>{business.name}</strong>
                    <span>{business.published ? 'Published' : 'Hidden / draft'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="settings-grid">
            <div className="card settings-card settings-approval-card">
              <div>
                <p className="small muted">Booking approval</p>
                <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                  Confirmation mode
                </h2>
                <p className="muted small" style={{ marginTop: '0.35rem' }}>
                  Choose whether customers are confirmed instantly or whether each booking needs business approval first.
                </p>
              </div>

              <div className="settings-mode-grid" role="radiogroup" aria-label="Booking confirmation mode">
                <button
                  type="button"
                  className={settings.auto_accept_bookings ? 'settings-mode-card settings-mode-card-active' : 'settings-mode-card'}
                  onClick={() => updateSetting('auto_accept_bookings', true)}
                >
                  <span className="settings-mode-title">Instant confirmation</span>
                  <span className="small muted">Customers get a confirmed booking as soon as they pick an available slot.</span>
                </button>

                <button
                  type="button"
                  className={!settings.auto_accept_bookings ? 'settings-mode-card settings-mode-card-active' : 'settings-mode-card'}
                  onClick={() => updateSetting('auto_accept_bookings', false)}
                >
                  <span className="settings-mode-title">Manual approval</span>
                  <span className="small muted">New bookings appear in Needs action until the business accepts or declines them.</span>
                </button>
              </div>

              <div className="settings-current-mode">
                <p className="small muted">Current mode</p>
                <strong>{approvalModeLabel}</strong>
              </div>
            </div>

            <div className="card settings-card">
              <div>
                <p className="small muted">Slot interval</p>
                <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                  Booking slot size
                </h2>
                <p className="muted small" style={{ marginTop: '0.35rem' }}>
                  This controls the time grid customers see when choosing appointment slots.
                </p>
              </div>

              <select
                value={settings.booking_interval_minutes || 30}
                onChange={(e) => updateSetting('booking_interval_minutes', Number(e.target.value))}
              >
                {INTERVAL_OPTIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>{minutes} minutes</option>
                ))}
              </select>
            </div>

            <div className="card settings-card">
              <div>
                <p className="small muted">Minimum notice</p>
                <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                  How soon customers can book
                </h2>
                <p className="muted small" style={{ marginTop: '0.35rem' }}>
                  Prevents last-minute bookings if your business needs preparation time.
                </p>
              </div>

              <select
                value={settings.min_notice_minutes ?? 120}
                onChange={(e) => updateSetting('min_notice_minutes', Number(e.target.value))}
              >
                {NOTICE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="card settings-card">
              <div>
                <p className="small muted">Advance booking window</p>
                <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                  How far ahead customers can book
                </h2>
                <p className="muted small" style={{ marginTop: '0.35rem' }}>
                  Useful for businesses that only want to expose a limited future calendar.
                </p>
              </div>

              <select
                value={settings.max_advance_days ?? 60}
                onChange={(e) => updateSetting('max_advance_days', Number(e.target.value))}
              >
                {ADVANCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="card settings-card">
              <div>
                <p className="small muted">Buffers</p>
                <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                  Time around appointments
                </h2>
                <p className="muted small" style={{ marginTop: '0.35rem' }}>
                  Buffers block extra time before or after appointments for clean-up, travel, admin or setup.
                </p>
              </div>

              <div className="settings-two-column">
                <label className="small muted">
                  Before
                  <select
                    value={settings.buffer_before_minutes ?? 0}
                    onChange={(e) => updateSetting('buffer_before_minutes', Number(e.target.value))}
                    style={{ marginTop: '0.35rem' }}
                  >
                    {BUFFER_OPTIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>{minutes} minutes</option>
                    ))}
                  </select>
                </label>

                <label className="small muted">
                  After
                  <select
                    value={settings.buffer_after_minutes ?? 0}
                    onChange={(e) => updateSetting('buffer_after_minutes', Number(e.target.value))}
                    style={{ marginTop: '0.35rem' }}
                  >
                    {BUFFER_OPTIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>{minutes} minutes</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="card settings-card">
              <div>
                <p className="small muted">Region settings</p>
                <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                  Timezone and currency
                </h2>
                <p className="muted small" style={{ marginTop: '0.35rem' }}>
                  These defaults support UK, Albania and future international launches.
                </p>
              </div>

              <div className="settings-two-column">
                <label className="small muted">
                  Timezone
                  <select
                    value={settings.timezone || 'Europe/London'}
                    onChange={(e) => updateSetting('timezone', e.target.value)}
                    style={{ marginTop: '0.35rem' }}
                  >
                    {TIMEZONE_OPTIONS.map((timezone) => (
                      <option key={timezone} value={timezone}>{timezone}</option>
                    ))}
                  </select>
                </label>

                <label className="small muted">
                  Currency
                  <select
                    value={settings.currency || 'GBP'}
                    onChange={(e) => updateSetting('currency', e.target.value)}
                    style={{ marginTop: '0.35rem' }}
                  >
                    {CURRENCY_OPTIONS.map((currency) => (
                      <option key={currency.value} value={currency.value}>{currency.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </div>

          <div className="grid-2" style={{ marginTop: '1.5rem' }}>
            <div className="card settings-card">
              <div>
                <p className="small muted">Cancellation policy</p>
                <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                  Customer cancellation wording
                </h2>
                <p className="muted small" style={{ marginTop: '0.35rem' }}>
                  This wording can be shown on booking, confirmation and account pages.
                </p>
              </div>

              <textarea
                value={settings.cancellation_policy || ''}
                onChange={(e) => updateSetting('cancellation_policy', e.target.value)}
                rows={5}
                placeholder="Example: Customers can cancel up to 24 hours before their appointment."
              />
            </div>

            <div className="card settings-card">
              <div>
                <p className="small muted">Reschedule policy</p>
                <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
                  Customer reschedule wording
                </h2>
                <p className="muted small" style={{ marginTop: '0.35rem' }}>
                  Keep this clear so customers know whether requests need business approval.
                </p>
              </div>

              <textarea
                value={settings.reschedule_policy || ''}
                onChange={(e) => updateSetting('reschedule_policy', e.target.value)}
                rows={5}
                placeholder="Example: Customers can request a new time. The business must approve the change."
              />
            </div>
          </div>

          <div className="settings-final-actions">
            <Link href="/dashboard/businesses" className="btn btn-ghost">
              Back to setup hub
            </Link>

            <Link href={selectedBusinessPublicHref} className="btn btn-ghost">
              View public page
            </Link>

            <Link href="/dashboard/notifications" className="btn btn-ghost">
              Needs action
            </Link>

            <button className="btn btn-accent" onClick={saveSettings} disabled={saving}>
              {saving ? 'Saving...' : 'Save Mirëbook settings'}
            </button>
          </div>
        </>
      )}

      <style jsx>{`
        .settings-hero {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
          margin-bottom: 1.5rem;
          background: linear-gradient(135deg, rgba(255,107,53,0.12), rgba(45,212,191,0.08));
          border-color: rgba(255,107,53,0.25);
        }

        .settings-hero-actions,
        .settings-final-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1rem;
        }

        .settings-card {
          display: grid;
          gap: 1rem;
          align-content: start;
        }

        .settings-two-column {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 0.75rem;
        }

        .settings-business-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .settings-business-card {
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text);
          border-radius: var(--radius);
          padding: 1rem;
          text-align: left;
          cursor: pointer;
        }

        .settings-business-card span {
          display: block;
          color: var(--text-muted);
          font-size: 0.85rem;
          margin-top: 0.25rem;
        }

        .settings-business-card-active {
          border-color: rgba(255,107,53,0.45);
          background: var(--accent-dim);
        }

        .settings-approval-card {
          grid-column: 1 / -1;
        }

        .settings-mode-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 0.85rem;
        }

        .settings-mode-card {
          display: grid;
          gap: 0.45rem;
          text-align: left;
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text);
          border-radius: var(--radius);
          padding: 1rem;
          min-height: 130px;
        }

        .settings-mode-card-active {
          border-color: rgba(255,107,53,0.45);
          background: var(--accent-dim);
        }

        .settings-mode-title {
          font-weight: 800;
          font-size: 1rem;
        }

        .settings-current-mode {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 0.85rem;
        }

        .settings-final-actions {
          margin-top: 1.5rem;
          justify-content: flex-start;
        }

        @media (max-width: 640px) {
          .settings-hero,
          .settings-final-actions,
          .settings-mode-grid {
            display: grid;
          }

          .settings-hero-actions,
          .settings-final-actions,
          .settings-hero-actions :global(.btn),
          .settings-final-actions :global(.btn),
          .settings-hero-actions button,
          .settings-final-actions button,
          .settings-hero-actions a,
          .settings-final-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </DashboardLayout>
  )
}