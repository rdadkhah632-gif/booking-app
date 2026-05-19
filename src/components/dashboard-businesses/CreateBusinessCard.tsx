import { useI18n } from '@/lib/useI18n'

type Props = {
  value: string
  loading: boolean
  existingBusinessCount: number
  onChange: (value: string) => void
  onSubmit: (event: React.FormEvent) => void
}

export default function CreateBusinessCard({
  value,
  loading,
  existingBusinessCount,
  onChange,
  onSubmit
}: Props) {
  const { t } = useI18n()
  const hasExistingBusiness = existingBusinessCount > 0

  return (
    <form onSubmit={onSubmit} className="card business-create-card">
      <div>
        <p className="small muted">
          {hasExistingBusiness
            ? t('dashboardBusinesses.create.extraKicker', 'Additional business')
            : t('dashboardBusinesses.create.kicker', 'Create profile')}
        </p>

        <h3>
          {hasExistingBusiness
            ? t('dashboardBusinesses.create.extraTitle', 'Add another business')
            : t('dashboardBusinesses.create.title', 'Add your business')}
        </h3>

        <p className="muted small" style={{ marginTop: '0.35rem' }}>
          {hasExistingBusiness
            ? t(
                'dashboardBusinesses.create.extraBody',
                'Only add another business if it is a separate location, brand or trading profile. Most owners should manage one business profile.'
              )
            : t(
                'dashboardBusinesses.create.body',
                'Create the business first, then add profile details, a business image, services, staff, working hours and publish when it is ready for customers.'
              )}
        </p>
      </div>

      <div className="business-create-row">
        <input
          placeholder={t('dashboardBusinesses.create.placeholder', 'Business name')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />

        <button className="btn btn-accent" disabled={loading} type="submit">
          {loading
            ? t('dashboardBusinesses.create.adding', 'Adding...')
            : hasExistingBusiness
              ? t('dashboardBusinesses.create.addAnother', 'Add another business')
              : t('dashboardBusinesses.create.addFirst', 'Add business to Mirëbook')}
        </button>
      </div>

      <style jsx>{`
        .business-create-card {
          display: grid;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .business-create-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 0.75rem;
        }

        @media (max-width: 640px) {
          .business-create-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </form>
  )
}