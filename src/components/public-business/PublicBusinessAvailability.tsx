import { TimeSlot } from './publicBusinessTypes'
import { useI18n } from '@/lib/useI18n'

type Props = {
  selectedDate: string
  availableSlots: TimeSlot[]
  selectedSlot: TimeSlot | null
  loadingSlots: boolean
  onDateChange: (date: string) => void
  onSelectSlot: (slot: TimeSlot) => void
}

export default function PublicBusinessAvailability({
  selectedDate,
  availableSlots,
  selectedSlot,
  loadingSlots,
  onDateChange,
  onSelectSlot
}: Props) {
  const { t } = useI18n()
  return (
    <div className="card">
      <div>
        <p className="small muted">{t('publicBusiness.availability.step')}</p>
        <h2 style={{ fontFamily: 'var(--font-display)' }}>{t('publicBusiness.availability.title')}</h2>
        <p className="small muted" style={{ marginTop: '0.35rem' }}>
          {t('publicBusiness.availability.subtitle')}
        </p>
      </div>

      <label className="small muted" style={{ display: 'block', marginTop: '1rem' }}>
        {t('publicBusiness.availability.date')}
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          style={{ marginTop: '0.4rem' }}
        />
      </label>

      <div className="public-business-slot-grid">
        {loadingSlots && (
          <p className="small muted">{t('publicBusiness.availability.loading')}</p>
        )}

        {!loadingSlots && availableSlots.length === 0 && (
          <div className="card" style={{ background: 'var(--surface-2)', gridColumn: '1 / -1' }}>
            <p className="muted">{t('publicBusiness.availability.none')}</p>
          </div>
        )}

        {!loadingSlots && availableSlots.map((slot) => {
          const selected = selectedSlot?.startAt === slot.startAt && selectedSlot?.staffMemberId === slot.staffMemberId

          return (
            <button
              key={`${slot.startAt}-${slot.staffMemberId || 'any'}`}
              type="button"
              onClick={() => onSelectSlot(slot)}
              className={selected ? 'btn btn-accent' : 'btn btn-ghost'}
            >
              {slot.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}