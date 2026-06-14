import { useI18n } from '@/lib/useI18n'

export default function ExploreTrustSection() {
  const { t } = useI18n()

  return (
    <section className="container explore-trust-section">
      <div className="explore-brand-panel">
        <p className="small muted">
          {t('explore.brand.kicker', 'Mirëbook')}
        </p>

        <h2>
          {t(
            'explore.brand.title',
            'Find local services and keep every appointment clear'
          )}
        </h2>

        <p className="muted explore-brand-description">
          {t(
            'explore.brand.description',
            'Browse bookable businesses, choose a service and available time, then track requests and confirmed appointments in one place.'
          )}
        </p>

        <div className="explore-category-pills">
          <span>💈 {t('explore.categories.barbers')}</span>
          <span>✂️ {t('explore.categories.salons')}</span>
          <span>💅 {t('explore.categories.nails')}</span>
          <span>🖋️ {t('explore.categories.tattoos')}</span>
          <span>🐾 {t('explore.categories.petGrooming')}</span>
          <span>🏋️ {t('explore.categories.fitness')}</span>
          <span>🦷 {t('explore.categories.dental')}</span>
          <span>🏄 {t('explore.categories.activities')}</span>
          <span>🚤 {t('explore.categories.experiences')}</span>
          <span>📅 {t('explore.categories.appointments')}</span>
        </div>

        <p className="explore-brand-footer">
          {t(
            'explore.brand.footer',
            'Clear booking status from request to completed appointment.'
          )}
        </p>
      </div>

      <style jsx>{`
        .explore-brand-panel {
          padding: 2.5rem;
          border-radius: 24px;
          border: 1px solid rgba(255, 107, 53, 0.2);

          background:
            radial-gradient(
              circle at top right,
              rgba(255, 107, 53, 0.16),
              transparent 40%
            ),
            linear-gradient(
              135deg,
              rgba(255, 107, 53, 0.08),
              rgba(45, 212, 191, 0.04)
            );

          overflow: hidden;
        }

        .explore-brand-panel h2 {
          margin-top: 0.5rem;
          font-size: clamp(1.8rem, 3vw, 2.6rem);
          line-height: 1.1;
        }

        .explore-brand-description {
          max-width: 760px;
          margin-top: 1rem;
          font-size: 1rem;
          line-height: 1.7;
        }

        .explore-category-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-top: 1.5rem;
        }

        .explore-category-pills span {
          padding: 0.65rem 1rem;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(10px);
          font-size: 0.92rem;
          font-weight: 600;
        }

        .explore-brand-footer {
          margin-top: 1.5rem;
          color: var(--text-muted);
        }

        @media (max-width: 700px) {
          .explore-brand-panel {
            padding: 1.5rem;
          }

          .explore-category-pills span {
            font-size: 0.85rem;
          }
        }
      `}</style>
    </section>
  )
}
