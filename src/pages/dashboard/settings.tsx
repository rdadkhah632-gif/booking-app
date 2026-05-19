import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/DashboardLayout'
import BusinessSettingsActions from '@/components/dashboard-settings/BusinessSettingsActions'
import BusinessSettingsBusinessPicker from '@/components/dashboard-settings/BusinessSettingsBusinessPicker'
import BusinessSettingsHeader from '@/components/dashboard-settings/BusinessSettingsHeader'
import BusinessSettingsSummary from '@/components/dashboard-settings/BusinessSettingsSummary'
import BookingApprovalSettings from '@/components/dashboard-settings/BookingApprovalSettings'
import BookingRuleSettings from '@/components/dashboard-settings/BookingRuleSettings'
import PolicySettings from '@/components/dashboard-settings/PolicySettings'
import RegionSettings from '@/components/dashboard-settings/RegionSettings'
import { Business } from '@/components/dashboard-settings/dashboardSettingsTypes'
import { defaultSettings } from '@/components/dashboard-settings/settingsOptions'
import { useI18n } from '@/lib/useI18n'
import { supabase } from '@/lib/supabaseClient'

export default function DashboardSettingsPage() {
  const router = useRouter()
  const { t } = useI18n()

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

  const approvalModeLabel = settings?.auto_accept_bookings
    ? t('dashboardSettings.approval.instantTitle', 'Instant confirmation')
    : t('dashboardSettings.approval.manualTitle', 'Manual approval')

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
      setError(err.message || t('dashboardSettings.error.load', 'Could not load business settings.'))
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

    setSuccess(
      `${settings.name} ${t('dashboardSettings.success.saved', 'settings saved.')} ${
        settings.auto_accept_bookings
          ? t('dashboardSettings.success.instant', 'New bookings will confirm instantly.')
          : t('dashboardSettings.success.manual', 'New bookings will go to Needs action for approval.')
      }`
    )
    await loadSettings()
  }

  function settingSummary() {
    if (!settings) return t('dashboardSettings.chooseBusiness', 'Choose a business to manage its booking settings.')

    return `${approvalModeLabel} · ${settings.booking_interval_minutes || 30} ${t('dashboardSettings.summary.minuteSlots', 'minute slots')} · ${settings.min_notice_minutes || 0} ${t('dashboardSettings.summary.minuteNotice', 'minute notice')} · ${settings.max_advance_days || 60} ${t('dashboardSettings.summary.daysAhead', 'days ahead')}`
  }

  return (
    <DashboardLayout
      title={t('dashboardSettings.pageTitle', 'Business settings')}
      subtitle={selectedBusiness ? `${t('dashboardSettings.subtitleSelected', 'Control booking approval, rules and policies for')} ${selectedBusiness.name}.` : t('dashboardSettings.subtitle', 'Control booking approval, rules and policies.')}
    >
      {loading && (
        <div className="card">
          <p className="muted">{t('dashboardSettings.loading', 'Loading Mirëbook business settings...')}</p>
        </div>
      )}

      {!loading && businesses.length === 0 && (
        <div className="card">
          <p className="small" style={{ color: 'var(--warning)' }}>{t('dashboardSettings.empty.kicker', 'No business profile found')}</p>
          <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.35rem' }}>
            {t('dashboardSettings.empty.title', 'Create a business first')}
          </h2>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            {t('dashboardSettings.empty.body', 'Business settings become available after you create a Mirëbook business profile.')}
          </p>
          <Link href="/dashboard/businesses" className="btn btn-accent" style={{ marginTop: '1rem' }}>
            {t('dashboardSettings.setupHub', 'Open setup hub')}
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

          <BusinessSettingsHeader
            selectedBusiness={selectedBusiness}
            publicHref={selectedBusinessPublicHref}
            saving={saving}
            onSave={saveSettings}
          />

          <BusinessSettingsSummary
            selectedBusiness={selectedBusiness}
            settings={settings}
            settingsReadyScore={settingsReadyScore}
            approvalModeLabel={approvalModeLabel}
            settingSummary={settingSummary()}
          />

          <BusinessSettingsBusinessPicker
            businesses={businesses}
            selectedBusinessId={selectedBusinessId}
            onSelectBusiness={selectBusiness}
          />

          <div className="settings-grid">
            <BookingApprovalSettings
              settings={settings}
              approvalModeLabel={approvalModeLabel}
              updateSetting={updateSetting}
            />

            <BookingRuleSettings
              settings={settings}
              updateSetting={updateSetting}
            />

            <RegionSettings
              settings={settings}
              updateSetting={updateSetting}
            />
          </div>

          <PolicySettings
            settings={settings}
            updateSetting={updateSetting}
          />

          <BusinessSettingsActions
            selectedBusiness={selectedBusiness}
            publicHref={selectedBusinessPublicHref}
            saving={saving}
            onSave={saveSettings}
          />
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