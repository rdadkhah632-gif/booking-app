import { useI18n } from '@/lib/useI18n'
import { formatCurrencyAmount } from '@/lib/currency'

type Props = {
  name: string
  duration: number
  price: number
  currency?: string | null
  description: string
  imageUrl: string
}

export default function ServicePreviewCard({
  name,
  duration,
  price,
  currency,
  description,
  imageUrl
}: Props) {
  const { locale, t } = useI18n()

  return (
    <div className="card" style={{ background: 'var(--surface-2)' }}>
      <p className="small muted">{t('dashboardServices.preview.kicker', 'Customer preview')}</p>

      <div
        style={{
          minHeight: 130,
          borderRadius: 'var(--radius)',
          margin: '0.75rem 0',
          border: '1px solid var(--border)',
          background: imageUrl
            ? `linear-gradient(rgba(11,18,32,0.05), rgba(11,18,32,0.65)), url(${imageUrl})`
            : 'linear-gradient(135deg, rgba(255,107,53,0.16), rgba(45,212,191,0.10))',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem'
        }}
      >
        {!imageUrl && '✨'}
      </div>

      <h3>{name || t('dashboardServices.preview.serviceName', 'Service name')}</h3>

      <p className="small muted" style={{ marginTop: '0.35rem' }}>
        {duration || 0} {t('common.minutes', 'minutes')} · {formatCurrencyAmount(Number(price || 0), currency, locale)}
      </p>

      <p className="small muted" style={{ marginTop: '0.45rem' }}>
        {description || t('dashboardServices.preview.descriptionFallback', 'Add a short description to help customers understand this service.')}
      </p>
    </div>
  )
}
