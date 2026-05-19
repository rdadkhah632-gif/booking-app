import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'
import { AvailabilityRow, StaffMember } from './dashboardStaffTypes'

type Props = {
  staff: StaffMember
  availabilityRows: AvailabilityRow[]
}

export default function StaffAvailabilitySummary({
  staff,
  availabilityRows
}: Props) {
  const { t } = useI18n()

  const staffRows = availabilityRows.filter((row) => row.staff_member_id === staff.id)
  const openRows = staffRows.filter((row) => !row.is_closed)

  return (
    <div className="card" style={{ background: 'var(--surface-2)' }}>
      <p className="small muted">{t('dashboardStaff.availability.kicker', 'Staff availability')}</p>

      <h3 style={{ marginTop: '0.25rem' }}>
        {openRows.length > 0
          ? `${openRows.length} ${t('dashboardStaff.availability.openRows', 'open availability rows')}`
          : t('dashboardStaff.availability.notSet', 'Availability not set')}
      </h3>

      <p className="small muted" style={{ marginTop: '0.35rem' }}>
        {openRows.length > 0
          ? t('dashboardStaff.availability.bodyReady', 'This staff member has availability rows. Check exact times in the availability page.')
          : t('dashboardStaff.availability.bodyMissing', 'Set staff availability so Mirëbook can calculate exact bookable slots.')}
      </p>

      <Link href={`/dashboard/availability?businessId=${staff.business_id}&staffId=${staff.id}`} className="btn btn-ghost" style={{ marginTop: '0.85rem' }}>
        {t('dashboardStaff.availability.openCta', 'Open availability')}
      </Link>
    </div>
  )
}