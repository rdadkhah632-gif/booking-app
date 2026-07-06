import { useI18n } from "@/lib/useI18n";

type SummarySection = "pending" | "upcoming" | "changes" | "history";
type SummaryItem = {
  section: SummarySection;
  label: string;
  count: number;
};

type Props = {
  pendingCount: number;
  upcomingCount: number;
  changeCount: number;
  historyCount: number;
  onJump: (section: SummarySection) => void;
  statCardStyle: (isActive: boolean) => React.CSSProperties;
};

export default function MyBookingsStats({
  pendingCount,
  upcomingCount,
  changeCount,
  historyCount,
  onJump,
  statCardStyle,
}: Props) {
  const { t } = useI18n();
  const summaryItems = (
    [
      {
        section: "pending",
        label: t("myBookings.stats.waitingApproval", "Request sent"),
        count: pendingCount,
      },
      {
        section: "upcoming",
        label: t("myBookings.stats.upcoming", "Upcoming"),
        count: upcomingCount,
      },
      {
        section: "changes",
        label: t("myBookings.stats.changes", "Change requests"),
        count: changeCount,
      },
      {
        section: "history",
        label: t("dashboardBookings.summary.history", "History"),
        count: historyCount,
      },
    ] satisfies SummaryItem[]
  ).filter((item) => item.count > 0);

  if (summaryItems.length === 0) return null;

  return (
    <div className="my-bookings-summary-grid">
      {summaryItems.map((item) => (
        <button
          key={item.section}
          type="button"
          className="my-bookings-summary-item"
          onClick={() => onJump(item.section)}
          style={statCardStyle(true)}
        >
          <p className="small muted">{item.label}</p>
          <h3>{item.count}</h3>
        </button>
      ))}
      <style jsx>{`
        .my-bookings-summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 0.5rem;
          margin-bottom: 0.9rem;
          padding: 0.35rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: rgba(24, 23, 34, 0.66);
        }

        .my-bookings-summary-item {
          min-width: 0;
          display: flex;
          flex-direction: row-reverse;
          justify-content: space-between;
          align-items: center;
          gap: 0.5rem;
          padding: 0.7rem 0.75rem;
          border: 1px solid transparent;
          border-radius: calc(var(--radius) - 4px);
          font: inherit;
        }

        .my-bookings-summary-grid h3,
        .my-bookings-summary-grid p {
          margin-top: 0;
        }

        .my-bookings-summary-grid h3 {
          font-size: 1.15rem;
        }

        @media (max-width: 760px) {
          .my-bookings-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 420px) {
          .my-bookings-summary-item {
            display: grid;
            gap: 0.15rem;
          }
        }
      `}</style>
    </div>
  );
}
