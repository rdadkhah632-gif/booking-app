import { useI18n } from '@/lib/useI18n'

type Props = {
  status: string
}

export function statusColor(value: string) {
  if (value === 'pending') return 'var(--accent)'
  if (value === 'confirmed') return 'var(--success)'
  if (value === 'completed') return 'var(--success)'
  if (value === 'cancelled') return 'var(--warning)'
  return 'var(--text-muted)'
}

export function statusBackground(value: string) {
  if (value === 'pending') return 'rgba(255,107,53,0.12)'
  if (value === 'confirmed') return 'rgba(45,212,191,0.12)'
  if (value === 'completed') return 'rgba(45,212,191,0.12)'
  if (value === 'cancelled') return 'rgba(255,190,11,0.12)'
  return 'var(--surface-2)'
}

export function useBookingStatusLabel() {
  const { t } = useI18n()

  return (value: string) => {
    if (value === 'pending') return t('dashboardBookings.status.pendingApproval', 'Pending approval')
    if (value === 'confirmed') return t('dashboardBookings.status.confirmedAppointment', 'Confirmed appointment')
    if (value === 'completed') return t('dashboardBookings.status.completedAppointment', 'Completed appointment')
    if (value === 'cancelled') return t('dashboardBookings.status.cancelledBooking', 'Cancelled booking')
    return value
  }
}

export default function BookingStatusBadge({ status }: Props) {
  const statusLabel = useBookingStatusLabel()

  return (
    <span
      className="small"
      style={{
        background: statusBackground(status),
        color: statusColor(status),
        padding: '0.2rem 0.55rem',
        borderRadius: 999
      }}
    >
      {statusLabel(status)}
    </span>
  )
}