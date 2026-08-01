import MarketplaceSurfaceStyles from "@/components/MarketplaceSurfaceStyles";

export default function CustomerLegalStyles() {
  return (
    <>
      <MarketplaceSurfaceStyles />
      <style jsx global>{`
        .customer-legal-surface {
          min-height: 100vh;
          min-height: 100dvh;
          background: #fff;
          color: var(--text);
        }

        .customer-legal-surface .customer-legal-container {
          width: min(100%, 860px);
          margin: 0 auto;
          padding: 3rem 24px 6rem;
        }

        .customer-legal-surface .legal-shell {
          display: grid;
          max-width: none;
          margin: 0;
          gap: 1.5rem;
        }

        .customer-legal-surface .legal-shell .legal-hero {
          padding: 0 0 1.5rem;
          border: 0;
          border-bottom: 1px solid var(--border);
          border-radius: 0;
          background: transparent;
        }

        .customer-legal-surface .legal-hero .page-title {
          margin: 0.25rem 0 0;
          font-family: var(--font-body);
          font-size: clamp(2.25rem, 6vw, 3.4rem);
          font-weight: 850;
          line-height: 1.03;
          letter-spacing: 0;
        }

        .customer-legal-surface .legal-shell .legal-note {
          padding: 1rem;
          border: 1px solid rgba(168, 112, 16, 0.22);
          border-radius: 8px;
          background: rgba(168, 112, 16, 0.06);
        }

        .customer-legal-surface .legal-shell .legal-content {
          gap: 0;
          padding: 0;
          border: 0;
          background: transparent;
        }

        .customer-legal-surface .legal-shell .legal-content h2 {
          margin: 2rem 0 0.55rem;
          padding-top: 2rem;
          border-top: 1px solid var(--border);
          font-family: var(--font-body);
          font-size: 1.25rem;
          font-weight: 800;
          letter-spacing: 0;
        }

        .customer-legal-surface .legal-shell .legal-content h2:first-child {
          margin-top: 0;
          padding-top: 0;
          border-top: 0;
        }

        .customer-legal-surface .legal-shell .legal-content p {
          max-width: 74ch;
          margin: 0.55rem 0 0;
          color: var(--text-muted);
          line-height: 1.75;
        }

        .customer-legal-surface .legal-shell .legal-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-top: 2.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--border);
        }

        .customer-legal-surface .legal-shell .legal-actions .btn {
          min-height: 46px;
          border-radius: 6px;
        }

        @media (max-width: 640px) {
          .customer-legal-surface .customer-legal-container {
            padding: 1.75rem 14px 4.5rem;
          }

          .customer-legal-surface .legal-shell {
            gap: 1.1rem;
          }

          .customer-legal-surface .legal-shell .legal-content h2 {
            margin-top: 1.5rem;
            padding-top: 1.5rem;
          }

          .customer-legal-surface .legal-shell .legal-actions,
          .customer-legal-surface .legal-shell .legal-actions .btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </>
  );
}
