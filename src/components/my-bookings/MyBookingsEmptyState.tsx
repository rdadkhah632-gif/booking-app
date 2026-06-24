import Link from "next/link";
import { useI18n } from "@/lib/useI18n";

export default function MyBookingsEmptyState() {
  const { t } = useI18n();

  return (
    <div className="card">
      <h3>{t("myBookings.empty.title", "No bookings yet")}</h3>
      <p className="muted" style={{ marginTop: "0.5rem" }}>
        {t(
          "myBookings.empty.body",
          "Explore services to make your first booking.",
        )}
      </p>

      <div className="my-booking-empty-actions">
        <Link href="/explore" className="btn btn-accent">
          {t("home.cta.explore", "Explore businesses")}
        </Link>
      </div>

      <style jsx>{`
        .my-booking-empty-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-top: 1rem;
        }

        @media (max-width: 640px) {
          .my-booking-empty-actions :global(.btn),
          .my-booking-empty-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
