import Link from "next/link";
import { useI18n } from "@/lib/useI18n";

type Props = {
  pendingActionCount: number;
  bookingsLinkForView: (
    view: string,
    status?: string,
    businessId?: string,
  ) => string;
};

export default function PriorityQueueCard({
  pendingActionCount,
  bookingsLinkForView: _bookingsLinkForView,
}: Props) {
  const { t } = useI18n();

  if (pendingActionCount <= 0) return null;

  return (
    <div
      className="card priority-queue-card"
      style={{
        marginBottom: "1.25rem",
        borderColor: "rgba(255,107,53,0.35)",
      }}
    >
      <div className="priority-queue-layout">
        <div className="priority-queue-copy">
          <h3>
            {t(
              "dashboardHome.priority.hasActions",
              "You have customer actions to review",
            )}
          </h3>
          <p className="small muted">
            {t(
              "dashboardHome.priority.body",
              "Pending booking approvals and reschedule requests should be handled quickly so customers know where they stand.",
            )}
          </p>
        </div>
        <div className="priority-queue-actions">
          <Link href="/dashboard/notifications" className="btn btn-accent">
            {t("account.needsAction", "Needs action")}
          </Link>
        </div>
      </div>
      <style jsx>{`
        .priority-queue-card {
          display: grid;
          gap: 0.75rem;
        }

        .priority-queue-layout {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          align-items: flex-start;
        }

        .priority-queue-copy {
          flex: 1;
          min-width: 260px;
          display: grid;
          gap: 0.55rem;
        }

        .priority-queue-copy h3,
        .priority-queue-copy p {
          margin-top: 0;
        }

        .priority-queue-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          align-items: center;
          justify-content: flex-end;
        }

        @media (max-width: 700px) {
          .priority-queue-layout,
          .priority-queue-actions {
            display: grid;
          }

          .priority-queue-actions,
          .priority-queue-actions :global(.btn) {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
