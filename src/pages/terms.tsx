import Link from 'next/link'
import AuthNav from '@/components/AuthNav'
import { useI18n } from '@/lib/useI18n'

export default function TermsPage() {
  const { t } = useI18n()
  return (
    <main>
      <AuthNav />

      <section className="container" style={{ paddingTop: 42, paddingBottom: 72 }}>
        <div className="legal-shell">
          <div className="card legal-hero">
            <p className="small" style={{ color: 'var(--accent)' }}>{t('legal.kicker')}</p>
            <h1 className="page-title">{t('terms.title')}</h1>
            <p className="page-sub" style={{ marginTop: '0.6rem' }}>
              {t('terms.subtitle')}
            </p>
            <p className="small muted" style={{ marginTop: '0.75rem' }}>
              {t('legal.lastUpdated')}
            </p>
          </div>

          <div className="card legal-note">
            <p className="small" style={{ color: 'var(--warning)' }}>{t('legal.important')}</p>
            <p className="muted" style={{ marginTop: '0.35rem' }}>
              {t('terms.importantBody')}
            </p>
          </div>

          <div className="card legal-content">
            <h2>{t('terms.section1.title')}</h2>
            <p>
              {t('terms.section1.body')}
            </p>

            <h2>{t('terms.section2.title')}</h2>
            <p>
              {t('terms.section2.body')}
            </p>

            <h2>{t('terms.section3.title')}</h2>
            <p>
              {t('terms.section3.body1')}
            </p>
            <p>
              {t('terms.section3.body2')}
            </p>

            <h2>{t('terms.section4.title')}</h2>
            <p>
              {t('terms.section4.body1')}
            </p>
            <p>
              {t('terms.section4.body2')}
            </p>

            <h2>{t('terms.section5.title')}</h2>
            <p>
              {t('terms.section5.body')}
            </p>

            <h2>{t('terms.section6.title')}</h2>
            <p>
              {t('terms.section6.body1')}
            </p>
            <p>
              {t('terms.section6.body2')}
            </p>

            <h2>{t('terms.section7.title')}</h2>
            <p>
              {t('terms.section7.body1')}
            </p>
            <p>
              {t('terms.section7.body2')}
            </p>

            <h2>{t('terms.section8.title')}</h2>
            <p>
              {t('terms.section8.body')}
            </p>

            <h2>{t('terms.section9.title')}</h2>
            <p>
              {t('terms.section9.body')}
            </p>

            <h2>{t('terms.section10.title')}</h2>
            <p>
              {t('terms.section10.body')}
            </p>

            <h2>{t('terms.section11.title')}</h2>
            <p>
              {t('terms.section11.body')}
            </p>

            <h2>{t('terms.section12.title')}</h2>
            <p>
              {t('terms.section12.body')}
            </p>

            <h2>{t('terms.section13.title')}</h2>
            <p>
              {t('terms.section13.body')}
            </p>

            <div className="legal-actions">
              <Link href="/support" className="btn btn-accent">
                {t('account.contactSupport')}
              </Link>

              <Link href="/privacy" className="btn btn-ghost">
                {t('common.privacy')}
              </Link>

              <Link href="/explore" className="btn btn-ghost">
                {t('home.cta.explore')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .legal-shell {
          max-width: 900px;
          margin: 0 auto;
          display: grid;
          gap: 1rem;
        }

        .legal-hero {
          background: linear-gradient(135deg, rgba(255,107,53,0.12), rgba(45,212,191,0.08));
          border-color: rgba(255,107,53,0.25);
        }

        .legal-note {
          border-color: rgba(255,190,11,0.28);
          background: rgba(255,190,11,0.06);
        }

        .legal-content {
          display: grid;
          gap: 1rem;
        }

        .legal-content h2 {
          font-family: var(--font-display);
          margin-top: 0.75rem;
        }

        .legal-content p {
          color: var(--text-muted);
          line-height: 1.7;
        }

        .legal-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-top: 1rem;
        }

        @media (max-width: 640px) {
          .legal-actions,
          .legal-actions :global(.btn),
          .legal-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  )
}