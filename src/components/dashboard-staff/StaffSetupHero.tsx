import Link from "next/link";
import { useI18n } from "@/lib/useI18n";
import { Business } from "./dashboardStaffTypes";

type Props = {
  business: Business;
};

export default function StaffSetupHero({ business }: Props) {
  const { t } = useI18n();

  return (
    <div
      className="card staff-setup-hero"
      style={{
        marginBottom: "1.25rem",
        background:
          "linear-gradient(135deg, rgba(255,107,53,0.12), rgba(45,212,191,0.07))",
        borderColor: "rgba(255,107,53,0.22)",
      }}
    >
      <div className="staff-hero-row">
        <div className="staff-hero-copy">
          <h2>
            {t(
              "dashboardStaff.hero.title",
              "Make services bookable by assigning staff.",
            )}
          </h2>

          <p className="muted">
            {t(
              "dashboardStaff.hero.body",
              "Staff profiles control who can deliver services and when customers can book them. Add staff, connect their email if they need their own login, assign services and set availability.",
            )}
          </p>
        </div>

        <div className="staff-hero-actions">
          <Link
            href={`/dashboard/services?businessId=${business.id}`}
            className="btn btn-ghost"
          >
            {t("support.business.services", "Services")}
          </Link>

          <Link href={`/explore/${business.id}`} className="btn btn-accent">
            {t("dashboardServices.hero.previewPublic", "Preview public page")}
          </Link>
        </div>
      </div>

      <style jsx>{`
        .staff-setup-hero {
          display: grid;
          gap: 1rem;
        }

        .staff-hero-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          align-items: flex-start;
        }

        .staff-hero-copy {
          flex: 1;
          min-width: 260px;
          display: grid;
          gap: 0.55rem;
        }

        .staff-hero-copy h2 {
          font-family: var(--font-display);
          margin-top: 0;
        }

        .staff-hero-copy p {
          margin-top: 0;
        }

        .staff-hero-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: flex-end;
          align-items: center;
        }

        @media (max-width: 640px) {
          .staff-hero-actions,
          .staff-hero-actions :global(.btn),
          .staff-hero-actions a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
