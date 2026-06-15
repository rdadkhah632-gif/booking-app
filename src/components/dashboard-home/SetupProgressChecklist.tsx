import Link from "next/link";
import { useI18n } from "@/lib/useI18n";
import { SetupStep } from "./dashboardHomeTypes";

type Props = {
  steps: SetupStep[];
  completedCount: number;
  previewHref?: string;
};

export default function SetupProgressChecklist({
  steps,
  completedCount,
  previewHref,
}: Props) {
  const { t } = useI18n();
  const total = steps.length;
  const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  return (
    <section className="setup-progress">
      <div className="setup-progress-header">
        <div>
          <h2>{t("dashboardHome.setup.title", "Get ready to take bookings")}</h2>
          <p className="small muted">
            {t("dashboardHome.setup.progress", "{{done}} of {{total}} setup steps complete")
              .replace("{{done}}", String(completedCount))
              .replace("{{total}}", String(total))}
          </p>
        </div>

        <div className="setup-progress-meter" aria-label={`${percent}%`}>
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="setup-step-list">
        {steps.map((step) => (
          <Link
            key={step.key}
            href={step.href}
            className={step.complete ? "setup-step complete" : "setup-step"}
          >
            <span className="setup-step-status" aria-hidden="true">
              {step.complete ? "OK" : ""}
            </span>
            <span className="setup-step-copy">
              <strong>{step.label}</strong>
              <small>{step.complete ? t("common.done", "Done") : step.cta}</small>
            </span>
          </Link>
        ))}
      </div>

      {previewHref && (
        <Link href={previewHref} className="btn btn-ghost setup-preview-link">
          {t("dashboardHome.setup.preview", "See what customers see")}
        </Link>
      )}

      <style jsx>{`
        .setup-progress {
          display: grid;
          gap: 0.9rem;
          margin-bottom: 1.25rem;
          padding: 1rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface);
        }

        .setup-progress-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: center;
        }

        .setup-progress h2,
        .setup-progress p {
          margin-top: 0;
        }

        .setup-progress-meter {
          width: min(180px, 34vw);
          height: 0.55rem;
          overflow: hidden;
          border-radius: 999px;
          background: var(--surface-2);
          border: 1px solid var(--border);
        }

        .setup-progress-meter span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: var(--accent);
        }

        .setup-step-list {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 0.5rem;
        }

        .setup-step {
          display: flex;
          gap: 0.55rem;
          align-items: center;
          min-width: 0;
          padding: 0.7rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface-2);
          color: var(--text);
          text-decoration: none;
        }

        .setup-step.complete {
          border-color: rgba(45, 212, 191, 0.24);
          background: rgba(45, 212, 191, 0.07);
        }

        .setup-step-status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 1.45rem;
          height: 1.45rem;
          flex: 0 0 auto;
          border-radius: 50%;
          background: var(--accent-dim);
          color: var(--accent);
          font-weight: 900;
        }

        .setup-step.complete .setup-step-status {
          background: rgba(45, 212, 191, 0.14);
          color: var(--success);
        }

        .setup-step-copy {
          display: grid;
          gap: 0.1rem;
          min-width: 0;
        }

        .setup-step-copy strong,
        .setup-step-copy small {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .setup-step-copy small {
          color: var(--text-muted);
        }

        .setup-preview-link {
          width: fit-content;
        }

        @media (max-width: 1080px) {
          .setup-step-list {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .setup-progress-header,
          .setup-step-list {
            grid-template-columns: 1fr;
          }

          .setup-progress-header {
            display: grid;
          }

          .setup-progress-meter,
          .setup-preview-link {
            width: 100%;
          }

          .setup-step-list {
            display: grid;
          }
        }
      `}</style>
    </section>
  );
}
