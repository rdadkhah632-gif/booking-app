import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'
import { Business } from './dashboardSettingsTypes'

type Props = {
  selectedBusiness: Business | null
  publicHref: string
  saving: boolean
  onSave: () => void
}

export default function BusinessSettingsHeader({
  selectedBusiness,
  publicHref,
  saving,
  onSave
}: Props) {
  const { t } = useI18n()

  return (
    <div className="settings-hero card">
      <div>
        <p className="small" style={{ color: 'var(--accent)' }}>
          {t('dashboardSettings.kicker', 'Business settings')}
        </p>

        <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
          {t('dashboardSettings.title', 'Manage business rules')}
        </h2>

        <p className="muted" style={{ marginTop: '0.5rem' }}>
          {selectedBusiness
            ? `${t('dashboardSettings.subtitleSelected', 'Control booking approval, rules and customer policies for')} ${selectedBusiness.name}.`
            : t('dashboardSettings.subtitle', 'Control booking approval, rules and customer policies.')}
        </p>
      </div>

      <div className="settings-hero-actions">
        <Link href="/dashboard/businesses" className="btn btn-ghost">
          {t('dashboardSettings.setupHub', 'Setup hub')}
        </Link>

        <Link href="/dashboard/notifications" className="btn btn-ghost">
          {t('account.needsAction', 'Needs action')}
        </Link>

        <Link href="/dashboard/billing" className="btn btn-ghost">
          {t('home.trust.billing', 'Billing')}
        </Link>

        {selectedBusiness && (
          <Link href={publicHref} className="btn btn-ghost">
            {t('account.publicPage', 'Public page')}
          </Link>
        )}

        <button className="btn btn-accent" onClick={onSave} disabled={saving || !selectedBusiness}>
          {saving ? t('account.saving', 'Saving...') : t('dashboardSettings.saveSettings', 'Save settings')}
        </button>
      </div>
    </div>
  )
}