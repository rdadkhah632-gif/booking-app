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
            'Built for businesses that run on bookings'
          )}
        </h2>

        <p className="muted explore-brand-description">
          {t(
            'explore.brand.description',
            'From salons and barbers to experiences, activities and specialist services, Mirëbook helps customers discover businesses, book appointments and stay organised.'
          )}
        </p>

        <div className="explore-category-pills">
          <span>💈 Barbers</span>
          <span>✂️ Salons</span>
          <span>💅 Nails</span>
          <span>🖋️ Tattoos</span>
          <span>🐾 Pet Grooming</span>
          <span>🏋️ Fitness</span>
          <span>🦷 Dental</span>
          <span>🏄 Activities</span>
          <span>🚤 Experiences</span>
          <span>📅 Appointments</span>
        </div>

        <p className="explore-brand-footer">
          {t(
            'explore.brand.footer',
            'Designed for independent businesses and their customers.'
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