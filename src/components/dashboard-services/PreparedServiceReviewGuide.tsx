import { CalendarClock, CheckCircle2, UsersRound } from "lucide-react";
import { useI18n } from "@/lib/useI18n";

type Props = {
  reviewCount: number;
  groupCount: number;
  appointmentCount: number;
  onReviewNext: () => void;
};

export default function PreparedServiceReviewGuide({
  reviewCount,
  groupCount,
  appointmentCount,
  onReviewNext,
}: Props) {
  const { t } = useI18n();

  if (reviewCount === 0) return null;

  return (
    <section
      className="card prepared-review-guide"
      aria-labelledby="prepared-review-title"
    >
      <div className="prepared-review-heading">
        <div>
          <p className="eyebrow">
            {t("dashboardServices.assisted.kicker", "Prepared profile")}
          </p>
          <h2 id="prepared-review-title">
            {t(
              "dashboardServices.assisted.title",
              "Review your prepared services",
            )}
          </h2>
          <p className="muted">
            {t(
              "dashboardServices.assisted.body",
              "Nothing is visible yet. Check each prepared service, correct anything that changed, then save it.",
            )}
          </p>
        </div>
        <span className="review-count" aria-label={`${reviewCount}`}>
          {reviewCount}
        </span>
      </div>

      <div className="prepared-paths">
        <div>
          <CheckCircle2 size={19} aria-hidden="true" />
          <span>
            <strong>
              {t(
                "dashboardServices.assisted.checkDetails",
                "Check the details",
              )}
            </strong>
            <small>
              {t(
                "dashboardServices.assisted.checkDetailsHint",
                "Confirm the duration, price, description and booking format.",
              )}
            </small>
          </span>
        </div>

        {groupCount > 0 && (
          <div>
            <UsersRound size={19} aria-hidden="true" />
            <span>
              <strong>
                {t(
                  "dashboardServices.assisted.groupNext",
                  "Shared trips or classes",
                )}
              </strong>
              <small>
                {t(
                  "dashboardServices.assisted.groupNextHint",
                  "Save the service, then add the real departure dates, times and seats.",
                )}
              </small>
            </span>
          </div>
        )}

        {appointmentCount > 0 && (
          <div>
            <CalendarClock size={19} aria-hidden="true" />
            <span>
              <strong>
                {t(
                  "dashboardServices.assisted.appointmentNext",
                  "One-at-a-time appointments",
                )}
              </strong>
              <small>
                {t(
                  "dashboardServices.assisted.appointmentNextHint",
                  "Save the service, then assign staff and the hours customers can choose.",
                )}
              </small>
            </span>
          </div>
        )}
      </div>

      <div className="prepared-review-action">
        <p className="small muted">
          {t(
            "dashboardServices.assisted.remaining",
            "{count} still need your review.",
          ).replace("{count}", String(reviewCount))}
        </p>
        <button type="button" className="btn btn-accent" onClick={onReviewNext}>
          {t("dashboardServices.assisted.reviewNext", "Review next service")}
        </button>
      </div>

      <style jsx>{`
        .prepared-review-guide {
          display: grid;
          gap: 1rem;
          margin-bottom: 1rem;
          border-color: rgba(20, 125, 112, 0.28);
          background: linear-gradient(
            180deg,
            rgba(20, 125, 112, 0.07),
            var(--surface)
          );
        }

        .prepared-review-heading,
        .prepared-review-action {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }

        .prepared-review-heading h2,
        .prepared-review-heading p,
        .prepared-review-action p {
          margin: 0;
        }

        .prepared-review-heading > div {
          display: grid;
          gap: 0.35rem;
        }

        .review-count {
          display: grid;
          place-items: center;
          min-width: 42px;
          min-height: 42px;
          border-radius: 50%;
          background: rgba(20, 125, 112, 0.13);
          color: #147d70;
          font-weight: 850;
        }

        .prepared-paths {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 0.75rem;
          padding-block: 0.9rem;
          border-block: 1px solid var(--border);
        }

        .prepared-paths > div {
          display: flex;
          gap: 0.65rem;
          align-items: flex-start;
          min-width: 0;
        }

        .prepared-paths :global(svg) {
          flex: 0 0 auto;
          color: #147d70;
          margin-top: 0.1rem;
        }

        .prepared-paths span {
          display: grid;
          gap: 0.2rem;
        }

        .prepared-paths small {
          color: var(--text-muted);
          line-height: 1.45;
        }

        @media (max-width: 620px) {
          .prepared-review-heading,
          .prepared-review-action {
            align-items: stretch;
            flex-direction: column;
          }

          .review-count {
            align-self: flex-start;
          }

          .prepared-review-action :global(.btn) {
            width: 100%;
            min-height: 48px;
            justify-content: center;
          }
        }
      `}</style>
    </section>
  );
}
