import { StaffMember } from './publicBusinessTypes'

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
  return (
    <div className="card">
      <div>
        <p className="small muted">Step 2</p>
        <h2 style={{ fontFamily: 'var(--font-display)' }}>Choose staff</h2>
        <p className="small muted" style={{ marginTop: '0.35rem' }}>
          Choose Any available staff or select a specific person.
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
            <strong>Any available staff</strong>
            <p className="small muted" style={{ marginTop: '0.25rem' }}>
              Mirëbook will show slots for anyone who can perform the selected service.
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
                {staff.role_title || 'Staff member'}
              </p>
            </div>
          </button>
        ))}

        {staffMembers.length === 0 && (
          <p className="small muted">No active staff are available yet.</p>
        )}
      </div>
    </div>
  )
}