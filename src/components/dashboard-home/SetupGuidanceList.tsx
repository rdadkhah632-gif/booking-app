import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'
import { SetupWarning } from './dashboardHomeTypes'

type Props = {
  warnings: SetupWarning[]
}

export default function SetupGuidanceList({ warnings }: Props) {
  const { t } = useI18n()

  if (warnings.length === 0) {
    return null
  }

  return (
    <section className="dashboard-guidance">
      <h3>
        {t('dashboardHome.guidance.title', 'Finish these before going live')}
      </h3>

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
        .dashboard-guidance {
          display: grid;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
          padding-bottom: 1.25rem;
          border-bottom: 1px solid var(--border);
        }

        .dashboard-guidance h3 {
          margin: 0;
        }

        .dashboard-guidance-list {
          display: grid;
          gap: 0;
        }

        .dashboard-guidance-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
          padding: 0.75rem 0;
          border-top: 1px solid var(--border);
        }

        @media (max-width: 640px) {
          .dashboard-guidance-row {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>
    </section>
  )
}
