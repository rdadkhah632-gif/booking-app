import { useI18n } from '@/lib/useI18n'

type Props = {
  onApplyWeekdayPreset: () => void
  onApplyExtendedPreset: () => void
  onCloseAllDays: () => void
}

export default function AvailabilityPresetsCard({
  onApplyWeekdayPreset,
  onApplyExtendedPreset,
  onCloseAllDays
}: Props) {
  const { t } = useI18n()

  return (
    <div className="card" style={{ marginBottom: '1.25rem' }}>
      <div className="availability-preset-row">
        <div>
          <p className="small muted">{t('dashboardAvailability.presets.kicker', 'Quick presets')}</p>

          <h3 style={{ marginTop: '0.25rem' }}>
            {t('dashboardAvailability.presets.title', 'Set common business hours')}
          </h3>

          <p className="small muted" style={{ marginTop: '0.35rem' }}>
            {t(
              'dashboardAvailability.presets.body',
              'Presets update the table below. You still need to click Save working hours before customers see the change.'
            )}
          </p>
        </div>

        <div className="availability-preset-actions">
          <button type="button" onClick={onApplyWeekdayPreset} className="btn btn-ghost">
            {t('dashboardAvailability.presets.weekday', 'Mon-Fri 9-5')}
          </button>

          <button type="button" onClick={onApplyExtendedPreset} className="btn btn-ghost">
            {t('dashboardAvailability.presets.extended', 'Mon-Sat 9-7')}
          </button>

          <button type="button" onClick={onCloseAllDays} className="btn btn-danger">
            {t('dashboardAvailability.presets.closeAll', 'Close all days')}
          </button>
        </div>
      </div>

      <style jsx>{`
        .availability-preset-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .availability-preset-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        @media (max-width: 640px) {
          .availability-preset-actions,
          .availability-preset-actions :global(.btn),
          .availability-preset-actions button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}