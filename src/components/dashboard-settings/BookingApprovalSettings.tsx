import { useI18n } from '@/lib/useI18n'
import { Business, UpdateBusinessSetting } from './dashboardSettingsTypes'

type Props = {
  settings: Business
  approvalModeLabel: string
  updateSetting: UpdateBusinessSetting
}

export default function BookingApprovalSettings({
  settings,
  approvalModeLabel,
  updateSetting
}: Props) {
  const { t } = useI18n()

  return (
    <div className="card settings-card settings-approval-card">
      <div>
        <p className="small muted">
          {t('dashboardSettings.approval.kicker', 'Booking approval')}
        </p>

        <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
          {t('dashboardSettings.approval.title', 'Confirmation mode')}
        </h2>

        <p className="muted small" style={{ marginTop: '0.35rem' }}>
          {t('dashboardSettings.approval.body', 'Choose whether customers are confirmed instantly or whether each booking needs business approval first.')}
        </p>
      </div>

      <div className="settings-mode-grid" role="radiogroup" aria-label="Booking confirmation mode">
        <button
          type="button"
          className={settings.auto_accept_bookings ? 'settings-mode-card settings-mode-card-active' : 'settings-mode-card'}
          onClick={() => updateSetting('auto_accept_bookings', true)}
        >
          <span className="settings-mode-title">
            {t('dashboardSettings.approval.instantTitle', 'Instant confirmation')}
          </span>
          <span className="small muted">
            {t('dashboardSettings.approval.instantBody', 'Customers get a confirmed booking as soon as they pick an available slot.')}
          </span>
        </button>

        <button
          type="button"
          className={!settings.auto_accept_bookings ? 'settings-mode-card settings-mode-card-active' : 'settings-mode-card'}
          onClick={() => updateSetting('auto_accept_bookings', false)}
        >
          <span className="settings-mode-title">
            {t('dashboardSettings.approval.manualTitle', 'Manual approval')}
          </span>
          <span className="small muted">
            {t('dashboardSettings.approval.manualBody', 'New bookings appear in Needs action until the business accepts or declines them.')}
          </span>
        </button>
      </div>

      <div className="settings-current-mode">
        <p className="small muted">
          {t('dashboardSettings.approval.currentMode', 'Current mode')}
        </p>
        <strong>{approvalModeLabel}</strong>
      </div>
    </div>
  )
}