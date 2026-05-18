import Link from 'next/link'
import { useI18n } from '@/lib/useI18n'

type Props = {
  issues: string[]
}

export default function PublicBusinessSetupWarning({ issues }: Props) {
  const { t } = useI18n()
  if (issues.length === 0) return null

  return (
    <div className="card" style={{ borderColor: 'rgba(255,190,11,0.3)', background: 'rgba(255,190,11,0.06)', marginTop: '1rem' }}>
      <p className="small" style={{ color: 'var(--warning)' }}>{t('publicBusiness.warning.kicker')}</p>
      <h3 style={{ marginTop: '0.25rem' }}>{t('publicBusiness.warning.title')}</h3>

      <ul style={{ marginTop: '0.75rem', paddingLeft: '1.2rem', color: 'var(--text-muted)' }}>
        {issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>

      <div className="booking-action-row compact">
        <Link href="/support/customer" className="btn btn-ghost">
          {t('nav.customerSupport')}
        </Link>

        <Link href="/explore" className="btn btn-ghost">
          {t('publicBusiness.hero.backToMarketplace')}
        </Link>
      </div>
    </div>
  )
}