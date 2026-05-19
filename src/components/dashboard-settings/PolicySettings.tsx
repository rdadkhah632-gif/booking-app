import { useI18n } from '@/lib/useI18n'
import { Business, UpdateBusinessSetting } from './dashboardSettingsTypes'

type Props = {
  settings: Business
  updateSetting: UpdateBusinessSetting
}

export default function PolicySettings({
  settings,
  updateSetting
}: Props) {
  const { t } = useI18n()

  return (
    <div className="grid-2" style={{ marginTop: '1.5rem' }}>
      <div className="card settings-card">
        <div>
          <p className="small muted">
            {t('dashboardSettings.cancellation.kicker', 'Cancellation policy')}
          </p>

          <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
            {t('dashboardSettings.cancellation.title', 'Customer cancellation wording')}
          </h2>

          <p className="muted small" style={{ marginTop: '0.35rem' }}>
            {t('dashboardSettings.cancellation.body', 'This wording can be shown on booking, confirmation and account pages.')}
          </p>
        </div>

        <textarea
          value={settings.cancellation_policy || ''}
          onChange={(e) => updateSetting('cancellation_policy', e.target.value)}
          rows={5}
          placeholder={t('dashboardSettings.cancellation.placeholder', 'Example: Customers can cancel up to 24 hours before their appointment.')}
        />
      </div>

      <div className="card settings-card">
        <div>
          <p className="small muted">
            {t('dashboardSettings.reschedule.kicker', 'Reschedule policy')}
          </p>

          <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
            {t('dashboardSettings.reschedule.title', 'Customer reschedule wording')}
          </h2>

          <p className="muted small" style={{ marginTop: '0.35rem' }}>
            {t('dashboardSettings.reschedule.body', 'Keep this clear so customers know whether requests need business approval.')}
          </p>
        </div>

        <textarea
          value={settings.reschedule_policy || ''}
          onChange={(e) => updateSetting('reschedule_policy', e.target.value)}
          rows={5}
          placeholder={t('dashboardSettings.reschedule.placeholder', 'Example: Customers can request a new time. The business must approve the change.')}
        />
      </div>
    </div>
  )
}