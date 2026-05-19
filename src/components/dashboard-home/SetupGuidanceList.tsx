import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'
import { SetupWarning } from './dashboardHomeTypes'

type Props = {
  warnings: SetupWarning[]
}

export default function SetupGuidanceList({ warnings }: Props) {
  const { t } = useI18n()

  if (warnings.length === 0) {
    return (
      <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'rgba(45,212,191,0.28)' }}>
        <p className="small" style={{ color: 'var(--success)' }}>
          {t('dashboardHome.guidance.readyKicker', 'Setup complete')}
        </p>
        <h3 style={{ marginTop: '0.25rem' }}>
          {t('dashboardHome.guidance.readyTitle', 'Your business setup is ready')}
        </h3>
        <p className="small muted" style={{ marginTop: '0.45rem' }}>
          {t('dashboardHome.guidance.readyBody', 'Customers can use the public booking flow based on your services, staff and availability.')}
        </p>
      </div>
    )
  }

  return (
    <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'rgba(255,107,53,0.35)' }}>
      <p className="small" style={{ color: 'var(--accent)' }}>
        {t('dashboardHome.guidance.kicker', 'Setup guidance')}
      </p>

      <h3 style={{ marginTop: '0.25rem' }}>
        {t('dashboardHome.guidance.title', 'Finish these before going live')}
      </h3>

      <p className="small muted" style={{ marginTop: '0.45rem' }}>
        {t('dashboardHome.guidance.body', 'These checks help avoid customers seeing incomplete business information or unavailable booking slots.')}
      </p>

      <div className="dashboard-guidance-list">
        {warnings.map((warning) => (
          <div key={warning.title} className="dashboard-guidance-row">
            <div>
              <strong>{warning.title}</strong>
              <p className="small muted">{warning.body}</p>
            </div>

            <Link href={warning.href} className="btn btn-ghost">
              {warning.cta}
            </Link>
          </div>
        ))}
      </div>

      <style jsx>{`
        .dashboard-guidance-list {
          display: grid;
          gap: 0.8rem;
          margin-top: 1rem;
        }

        .dashboard-guidance-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          padding: 0.9rem;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          background: var(--surface-2);
        }

        @media (max-width: 640px) {
          .dashboard-guidance-row {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>
    </div>
  )
}