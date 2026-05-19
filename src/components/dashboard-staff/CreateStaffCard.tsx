import { useI18n } from '@/lib/useI18n'

type Props = {
  loading: boolean
  formExpanded: boolean
  name: string
  roleTitle: string
  email: string
  phone: string
  setFormExpanded: (value: boolean | ((previous: boolean) => boolean)) => void
  setName: (value: string) => void
  setRoleTitle: (value: string) => void
  setEmail: (value: string) => void
  setPhone: (value: string) => void
  resetForm: () => void
  addStaff: (event: React.FormEvent) => void
}

export default function CreateStaffCard({
  loading,
  formExpanded,
  name,
  roleTitle,
  email,
  phone,
  setFormExpanded,
  setName,
  setRoleTitle,
  setEmail,
  setPhone,
  resetForm,
  addStaff
}: Props) {
  const { t } = useI18n()

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div className="staff-form-header" style={{ marginBottom: formExpanded ? '1rem' : 0 }}>
        <div>
          <p className="small muted">{t('dashboardStaff.create.kicker', 'Create staff')}</p>

          <h3 style={{ marginTop: '0.25rem' }}>
            {t('dashboardStaff.create.title', 'Add a staff member')}
          </h3>

          <p className="muted small" style={{ marginTop: '0.35rem' }}>
            {t(
              'dashboardStaff.create.body',
              'Add the person first, then assign services and availability. Add their email if they need their own staff login later.'
            )}
          </p>
        </div>

        <button type="button" onClick={() => setFormExpanded((prev) => !prev)} className="btn btn-ghost">
          {formExpanded
            ? t('dashboardStaff.create.collapse', 'Collapse form')
            : t('dashboardStaff.create.addStaff', 'Add staff')}
        </button>
      </div>

      {formExpanded && (
        <form onSubmit={addStaff} className="staff-create-grid">
          <input
            placeholder={t('dashboardStaff.create.namePlaceholder', 'Staff name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <input
            placeholder={t('dashboardStaff.create.rolePlaceholder', 'Role e.g. Barber, Stylist, Dentist')}
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
          />

          <input
            type="email"
            placeholder={t('dashboardStaff.create.emailPlaceholder', 'Email optional, used for staff login linking')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            placeholder={t('common.phone', 'Phone')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <div className="staff-create-actions">
            <button type="submit" disabled={loading} className="btn btn-accent">
              {loading ? t('dashboardStaff.create.adding', 'Adding...') : t('dashboardStaff.create.addStaff', 'Add staff')}
            </button>

            <button type="button" onClick={resetForm} className="btn btn-ghost">
              {t('dashboardServices.create.clearForm', 'Clear form')}
            </button>
          </div>
        </form>
      )}

      <style jsx>{`
        .staff-form-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          align-items: flex-start;
        }

        .staff-create-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 0.75rem;
        }

        .staff-create-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          grid-column: 1 / -1;
        }

        @media (max-width: 640px) {
          .staff-create-actions,
          .staff-create-actions :global(.btn),
          .staff-create-actions button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}