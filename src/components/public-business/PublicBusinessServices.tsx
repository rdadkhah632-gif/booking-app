import { Service } from './publicBusinessTypes'
import { useI18n } from '@/lib/useI18n'

type Props = {
  services: Service[]
  selectedServiceId: string
  bookableServiceCount: number
  onSelectService: (serviceId: string) => void
  formatServicePrice: (price: number) => string
  serviceImageBackground: (service: Service) => string | undefined
}

export default function PublicBusinessServices({
  services,
  selectedServiceId,
  bookableServiceCount,
  onSelectService,
  formatServicePrice,
  serviceImageBackground
}: Props) {
  const { t } = useI18n()
  return (
    <div className="card">
      <div>
        <p className="small muted">{t('publicBusiness.services.step')}</p>
        <h2 style={{ fontFamily: 'var(--font-display)' }}>{t('publicBusiness.services.title')}</h2>
        <p className="small muted" style={{ marginTop: '0.35rem' }}>
          {bookableServiceCount} {t('common.service').toLowerCase()}{bookableServiceCount === 1 ? '' : 's'} {t('publicBusiness.services.bookableCount')}.
        </p>
      </div>

      <div className="public-business-service-list">
        {services.length === 0 && (
          <div className="card" style={{ background: 'var(--surface-2)' }}>
            <p className="muted">{t('publicBusiness.services.none')}</p>
          </div>
        )}

        {services.map((service) => {
          const selected = selectedServiceId === service.id

          return (
            <button
              key={service.id}
              type="button"
              onClick={() => onSelectService(service.id)}
              className="public-business-service-card"
              style={{
                borderColor: selected ? 'rgba(255,107,53,0.55)' : 'var(--border)',
                background: selected ? 'rgba(255,107,53,0.08)' : 'var(--surface-2)'
              }}
            >
              {service.image_url && (
                <div
                  className="public-business-service-image"
                  style={{ backgroundImage: serviceImageBackground(service) }}
                />
              )}

              <div style={{ flex: 1 }}>
                <strong>{service.name}</strong>

                {service.description && (
                  <p className="small muted" style={{ marginTop: '0.35rem' }}>
                    {service.description}
                  </p>
                )}

                <p className="small muted" style={{ marginTop: '0.45rem' }}>
                  {service.duration_minutes} minutes · {formatServicePrice(service.price)}
                </p>
              </div>

              <span className={selected ? 'btn btn-accent' : 'btn btn-ghost'}>
                {selected ? t('common.selected') : t('common.choose')}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}