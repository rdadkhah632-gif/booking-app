export default function SupportEntryStyles() {
  return (
    <style jsx global>{`
      .support-operator-container {
        padding-top: 42px;
        padding-bottom: 72px;
      }

      .support-entry-surface .support-shell {
        max-width: 1120px;
        gap: 2rem;
      }

      .support-entry-surface .support-entry-header {
        display: grid;
        gap: 0.7rem;
        max-width: 760px;
        padding-top: 0.4rem;
      }

      .support-entry-surface .support-entry-kicker,
      .support-entry-surface .support-route-eyebrow {
        margin: 0;
        color: var(--accent-strong);
        font-size: 0.75rem;
        font-weight: 800;
        letter-spacing: 0;
        text-transform: uppercase;
      }

      .support-entry-surface .support-entry-header .page-sub {
        margin: 0;
        font-size: 1.05rem;
      }

      .support-entry-surface .support-entry-layout {
        display: grid;
        grid-template-columns: minmax(0, 1.12fr) minmax(360px, 0.88fr);
        overflow: hidden;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 18px 44px rgba(20, 24, 32, 0.07);
      }

      .support-entry-surface .support-primary-route {
        display: flex;
        flex-direction: column;
        min-width: 0;
        min-height: 350px;
        padding: 2rem;
        border-right: 1px solid var(--border);
        color: var(--text);
        background: linear-gradient(145deg, #fff 55%, #fff7f2 100%);
        transition:
          background-color 0.18s ease,
          box-shadow 0.18s ease;
      }

      .support-entry-surface .support-primary-route:hover {
        background: #fff8f4;
        box-shadow: inset 4px 0 0 var(--accent);
      }

      .support-entry-surface .support-route-icon {
        display: inline-grid;
        flex: 0 0 auto;
        width: 42px;
        height: 42px;
        place-items: center;
        border: 1px solid var(--border);
        border-radius: 50%;
        color: var(--text);
        background: #fff;
      }

      .support-entry-surface .support-route-icon-primary {
        width: 48px;
        height: 48px;
        border-color: rgba(237, 90, 42, 0.2);
        color: var(--accent-strong);
        background: var(--accent-soft);
      }

      .support-entry-surface .support-primary-copy {
        display: grid;
        gap: 0.7rem;
        max-width: 32rem;
        margin-top: 2.2rem;
      }

      .support-entry-surface .support-primary-copy > strong {
        font-size: clamp(1.7rem, 4vw, 2.35rem);
        line-height: 1.05;
      }

      .support-entry-surface .support-primary-copy > span:last-child {
        color: var(--text-muted);
        font-size: 1rem;
        line-height: 1.6;
      }

      .support-entry-surface .support-work-routes {
        display: grid;
        align-content: start;
        gap: 1.15rem;
        padding: 2rem;
        background: var(--surface-2);
      }

      .support-entry-surface .support-work-routes > header {
        display: grid;
        gap: 0.45rem;
      }

      .support-entry-surface .support-work-routes h2 {
        margin: 0;
        font-size: 1.35rem;
      }

      .support-entry-surface .support-work-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.75rem;
      }

      .support-entry-surface .support-work-link {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: 0.85rem;
        align-items: center;
        min-height: 108px;
        padding: 1rem;
        border: 1px solid var(--border);
        border-radius: 8px;
        color: var(--text);
        background: #fff;
        transition:
          border-color 0.18s ease,
          transform 0.18s ease,
          box-shadow 0.18s ease;
      }

      .support-entry-surface .support-work-link:hover {
        border-color: rgba(237, 90, 42, 0.35);
        box-shadow: 0 9px 24px rgba(20, 24, 32, 0.06);
        transform: translateY(-1px);
      }

      .support-entry-surface .support-work-copy {
        display: grid;
        gap: 0.25rem;
        min-width: 0;
      }

      .support-entry-surface .support-work-copy strong {
        line-height: 1.3;
      }

      .support-entry-surface .support-work-copy small {
        color: var(--text-muted);
        line-height: 1.45;
      }

      .support-entry-surface .support-route-cta {
        display: inline-flex;
        align-items: center;
        align-self: flex-start;
        gap: 0.75rem;
        margin-top: auto;
        padding-top: 2rem;
        color: var(--accent-strong);
        font-weight: 800;
      }

      .support-entry-surface .support-entry-footer {
        display: flex;
        align-items: center;
        gap: 1.25rem;
        padding-top: 0.1rem;
        color: var(--text-muted);
        font-size: 0.9rem;
      }

      .support-entry-surface .support-entry-footer a:hover {
        color: var(--text);
      }

      .support-entry-surface .support-primary-route:focus-visible,
      .support-entry-surface .support-work-link:focus-visible,
      .support-entry-surface .support-entry-footer a:focus-visible {
        outline: 3px solid rgba(237, 90, 42, 0.24);
        outline-offset: -3px;
      }

      @media (max-width: 860px) {
        .support-entry-surface .support-entry-layout {
          grid-template-columns: 1fr;
        }

        .support-entry-surface .support-primary-route {
          min-height: 300px;
          border-right: 0;
          border-bottom: 1px solid var(--border);
        }

        .support-entry-surface .support-work-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .support-entry-surface .support-work-link {
          grid-template-columns: auto minmax(0, 1fr);
          align-content: start;
        }

        .support-entry-surface .support-work-link > svg:last-child {
          display: none;
        }
      }

      @media (max-width: 640px) {
        .support-operator-container {
          padding-top: 24px;
          padding-bottom: 48px;
        }

        .support-entry-surface .support-shell {
          gap: 1.35rem;
        }

        .support-entry-surface .support-entry-header {
          gap: 0.55rem;
        }

        .support-entry-surface .support-entry-header .page-sub {
          font-size: 0.98rem;
        }

        .support-entry-surface .support-primary-route {
          min-height: 276px;
          padding: 1.25rem;
        }

        .support-entry-surface .support-primary-copy {
          gap: 0.55rem;
          margin-top: 1.35rem;
        }

        .support-entry-surface .support-primary-copy > strong {
          font-size: 1.65rem;
        }

        .support-entry-surface .support-route-cta {
          padding-top: 1.2rem;
        }

        .support-entry-surface .support-work-routes {
          padding: 1.25rem;
        }

        .support-entry-surface .support-work-grid {
          grid-template-columns: 1fr;
        }

        .support-entry-surface .support-work-link {
          min-height: 96px;
        }

        .support-entry-surface .support-entry-footer {
          flex-wrap: wrap;
          gap: 0.75rem 1.1rem;
        }
      }
    `}</style>
  );
}
