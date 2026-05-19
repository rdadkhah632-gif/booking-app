import { useI18n } from '@/lib/useI18n'
import { AvailabilityRow } from './dashboardAvailabilityTypes'

type Props = {
  row: AvailabilityRow
  index: number
  dayLabel: string
  updateRow: (index: number, field: keyof AvailabilityRow, value: string | boolean) => void
}

export default function AvailabilityDayRow({
  row,
  index,
  dayLabel,
  updateRow
}: Props) {
  const { t } = useI18n()
  const invalid = !row.is_closed && row.start_time >= row.end_time

  return (
    <div
      className="card availability-day-row"
      style={{
        borderColor: invalid ? 'rgba(255,77,109,0.35)' : row.is_closed ? 'rgba(255,190,11,0.20)' : 'var(--border)',
        opacity: row.is_closed ? 0.76 : 1
      }}
    >
      <div>
        <strong>{dayLabel}</strong>
        <p
          className="small"
          style={{
            color: invalid ? 'var(--danger)' : row.is_closed ? 'var(--warning)' : 'var(--success)',
            marginTop: '0.25rem'
          }}
        >
          {invalid
            ? t('dashboardAvailability.day.invalid', 'Invalid time range')
            : row.is_closed
              ? t('dashboardAvailability.day.closed', 'Closed')
              : t('dashboardAvailability.day.open', 'Open')}
        </p>
      </div>

      <label className="small muted" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          type="checkbox"
          checked={row.is_closed}
          onChange={(e) => updateRow(index, 'is_closed', e.target.checked)}
        />
        {t('dashboardAvailability.day.closed', 'Closed')}
      </label>

      <label className="small muted">
        {t('dashboardAvailability.day.start', 'Start')}
        <input
          type="time"
          value={row.start_time}
          disabled={row.is_closed}
          onChange={(e) => updateRow(index, 'start_time', e.target.value)}
          style={{ marginTop: '0.25rem' }}
        />
      </label>

      <label className="small muted">
        {t('dashboardAvailability.day.end', 'End')}
        <input
          type="time"
          value={row.end_time}
          disabled={row.is_closed}
          onChange={(e) => updateRow(index, 'end_time', e.target.value)}
          style={{ marginTop: '0.25rem' }}
        />
      </label>

      <style jsx>{`
        .availability-day-row {
          display: grid;
          grid-template-columns: 1.2fr 1fr 1fr 1fr;
          gap: 0.75rem;
          align-items: center;
        }

        @media (max-width: 760px) {
          .availability-day-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}