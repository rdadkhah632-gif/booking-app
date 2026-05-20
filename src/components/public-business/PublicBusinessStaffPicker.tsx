import { StaffMember } from './publicBusinessTypes'
import { useI18n } from '@/lib/useI18n'

type Props = {
  staffMembers: StaffMember[]
  selectedStaffId: string
  onSelectStaff: (staffId: string) => void
  availableStaffForSelectedService: StaffMember[]
}

export default function PublicBusinessStaffPicker({
  staffMembers,
  selectedStaffId,
  onSelectStaff,
  availableStaffForSelectedService
}: Props) {
  const { t } = useI18n()
  return (
    <div className="card">
      <div>
        <p className="small muted">{t('publicBusiness.staff.step', 'Step 2')}</p>
        <h2 style={{ fontFamily: 'var(--font-display)' }}>{t('publicBusiness.staff.title', 'Choose staff')}</h2>
        <p className="small muted" style={{ marginTop: '0.35rem' }}>
          {t('publicBusiness.staff.subtitle', 'Choose a specific staff member, or let the business assign anyone available for the selected time.')}
        </p>
      </div>

      <div className="public-business-staff-list">
        <button
          type="button"
          onClick={() => onSelectStaff('any')}
          className="public-business-staff-card"
          style={{
            borderColor: selectedStaffId === 'any' ? 'rgba(255,107,53,0.55)' : 'var(--border)',
            background: selectedStaffId === 'any' ? 'rgba(255,107,53,0.08)' : 'var(--surface-2)'
          }}
        >
          <div>
            <strong>{t('publicBusiness.staff.any', 'Any available staff')}</strong>
            <p className="small muted" style={{ marginTop: '0.25rem' }}>
              {t('publicBusiness.staff.anyBody', 'Mirëbook will use any staff member assigned to this service who is available at the chosen time.')}
            </p>
          </div>
        </button>

        {availableStaffForSelectedService.map((staff) => (
          <button
            key={staff.id}
            type="button"
            onClick={() => onSelectStaff(staff.id)}
            className="public-business-staff-card"
            style={{
              borderColor: selectedStaffId === staff.id ? 'rgba(255,107,53,0.55)' : 'var(--border)',
              background: selectedStaffId === staff.id ? 'rgba(255,107,53,0.08)' : 'var(--surface-2)'
            }}
          >
            <div className="public-business-staff-avatar">
              {staff.image_url ? (
                <span style={{ backgroundImage: `url(${staff.image_url})` }} />
              ) : (
                staff.name.slice(0, 1).toUpperCase()
              )}
            </div>

            <div>
              <strong>{staff.name}</strong>
              <p className="small muted" style={{ marginTop: '0.25rem' }}>
                {staff.role_title || t('publicBusiness.staff.memberFallback', 'Staff member')}
              </p>
            </div>
          </button>
        ))}

        {staffMembers.length === 0 && (
          <p className="small muted">{t('publicBusiness.staff.none', 'No active staff are available for this service yet.')}</p>
        )}
      </div>
    </div>
  )
}