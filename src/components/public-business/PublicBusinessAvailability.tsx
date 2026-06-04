import { TimeSlot } from './publicBusinessTypes'
import { useI18n } from '@/lib/useI18n'

type Props = {
  selectedServiceName?: string | null
  selectedStaffLabel?: string | null
  selectedDate: string
  availableSlots: TimeSlot[]
  selectedSlot: TimeSlot | null
  loadingSlots: boolean
  canPickDate?: boolean
  noSlotsMessage?: string
  onDateChange: (date: string) => void
  onSelectSlot: (slot: TimeSlot) => void
}

export default function PublicBusinessAvailability({
  selectedServiceName,
  selectedStaffLabel,
  selectedDate,
  availableSlots,
  selectedSlot,
  loadingSlots,
  canPickDate = true,
  noSlotsMessage,
  onDateChange,
  onSelectSlot
}: Props) {
  const { t } = useI18n()
  return (
    <div className="card">
      <div>
        <p className="small muted">{t('publicBusiness.availability.step', 'Step 3')}</p>
        <h2 style={{ fontFamily: 'var(--font-display)' }}>{t('publicBusiness.availability.title', 'Choose a time')}</h2>
        <p className="small muted" style={{ marginTop: '0.35rem' }}>
          {t('publicBusiness.availability.subtitle', 'Pick a date and choose one of the available booking times.')}
        </p>
        {(selectedServiceName || selectedStaffLabel) && (
          <p className="small muted" style={{ marginTop: '0.35rem' }}>
            {[selectedServiceName, selectedStaffLabel].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      <label className="small muted" style={{ display: 'block', marginTop: '1rem' }}>
        {t('publicBusiness.availability.date', 'Date')}
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          disabled={!canPickDate}
          style={{ marginTop: '0.4rem' }}
        />
      </label>

      <div className="public-business-slot-grid">
        {loadingSlots && (
          <p className="small muted">{t('publicBusiness.availability.loading', 'Checking available times...')}</p>
        )}

        {!loadingSlots && availableSlots.length === 0 && (
          <div className="card" style={{ background: 'var(--surface-2)', gridColumn: '1 / -1' }}>
            <p className="muted">{noSlotsMessage || t('publicBusiness.availability.none', 'No available times for this date. Try another date or staff member.')}</p>
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
