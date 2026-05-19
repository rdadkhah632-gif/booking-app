import { useI18n } from '@/lib/useI18n'
import { Business, UpdateBusinessSetting } from './dashboardSettingsTypes'
import {
  ADVANCE_OPTIONS,
  BUFFER_OPTIONS,
  INTERVAL_OPTIONS,
  NOTICE_OPTIONS
} from './settingsOptions'

type Props = {
  settings: Business
  updateSetting: UpdateBusinessSetting
}

export default function BookingRuleSettings({
  settings,
  updateSetting
}: Props) {
  const { t } = useI18n()

  return (
    <>
      <div className="card settings-card">
        <div>
          <p className="small muted">
            {t('dashboardSettings.slot.kicker', 'Slot interval')}
          </p>

          <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
            {t('dashboardSettings.slot.title', 'Booking slot size')}
          </h2>

          <p className="muted small" style={{ marginTop: '0.35rem' }}>
            {t('dashboardSettings.slot.body', 'This controls the time grid customers see when choosing appointment slots.')}
          </p>
        </div>

        <select
          value={settings.booking_interval_minutes || 30}
          onChange={(e) => updateSetting('booking_interval_minutes', Number(e.target.value))}
        >
          {INTERVAL_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} {t('common.minutes', 'minutes')}
            </option>
          ))}
        </select>
      </div>

      <div className="card settings-card">
        <div>
          <p className="small muted">
            {t('dashboardSettings.notice.kicker', 'Minimum notice')}
          </p>

          <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
            {t('dashboardSettings.notice.title', 'How soon customers can book')}
          </h2>

          <p className="muted small" style={{ marginTop: '0.35rem' }}>
            {t('dashboardSettings.notice.body', 'Prevents last-minute bookings if your business needs preparation time.')}
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
          <p className="small muted">
            {t('dashboardSettings.advance.kicker', 'Advance booking window')}
          </p>

          <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
            {t('dashboardSettings.advance.title', 'How far ahead customers can book')}
          </h2>

          <p className="muted small" style={{ marginTop: '0.35rem' }}>
            {t('dashboardSettings.advance.body', 'Useful for businesses that only want to expose a limited future calendar.')}
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
          <p className="small muted">
            {t('dashboardSettings.buffers.kicker', 'Buffers')}
          </p>

          <h2 style={{ fontFamily: 'var(--font-display)', marginTop: '0.25rem' }}>
            {t('dashboardSettings.buffers.title', 'Time around appointments')}
          </h2>

          <p className="muted small" style={{ marginTop: '0.35rem' }}>
            {t('dashboardSettings.buffers.body', 'Buffers block extra time before or after appointments for clean-up, travel, admin or setup.')}
          </p>
        </div>

        <div className="settings-two-column">
          <label className="small muted">
            {t('dashboardSettings.buffers.before', 'Before')}
            <select
              value={settings.buffer_before_minutes ?? 0}
              onChange={(e) => updateSetting('buffer_before_minutes', Number(e.target.value))}
              style={{ marginTop: '0.35rem' }}
            >
              {BUFFER_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} {t('common.minutes', 'minutes')}
                </option>
              ))}
            </select>
          </label>

          <label className="small muted">
            {t('dashboardSettings.buffers.after', 'After')}
            <select
              value={settings.buffer_after_minutes ?? 0}
              onChange={(e) => updateSetting('buffer_after_minutes', Number(e.target.value))}
              style={{ marginTop: '0.35rem' }}
            >
              {BUFFER_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} {t('common.minutes', 'minutes')}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </>
  )
}