import Link from 'next/link'
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

  if (hasExistingBusiness) {
    return (
      <div className="card business-create-card">
        <div>
          <p className="small muted">
            {t('dashboardBusinesses.create.extraKicker', 'Additional business')}
          </p>

          <h3>{t('dashboardBusinesses.create.extraTitle', 'Need another business or location?')}</h3>

          <p className="muted small" style={{ marginTop: '0.35rem' }}>
            {t(
              'dashboardBusinesses.create.extraBody',
              'Your account is currently set up for one business profile. If you need another location, brand or trading profile, contact Mirëbook support so it can be added properly.'
            )}
          </p>
        </div>

        <div className="business-create-row single-action">
          <Link href="/support/business" className="btn btn-ghost">
            {t('dashboardBusinesses.create.requestAnother', 'Request another business')}
          </Link>
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

          .single-action {
            grid-template-columns: auto;
            justify-content: flex-start;
          }

          @media (max-width: 640px) {
            .business-create-row {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="card business-create-card">
      <div>
        <p className="small muted">
          {t('dashboardBusinesses.create.kicker', 'Create profile')}
        </p>

        <h3>{t('dashboardBusinesses.create.title', 'Add your business')}</h3>

        <p className="muted small" style={{ marginTop: '0.35rem' }}>
          {t(
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