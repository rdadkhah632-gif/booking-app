import { UsersRound } from "lucide-react";
import { StaffMember } from "./publicBusinessTypes";
import { useI18n } from "@/lib/useI18n";
import { publicStaffInitial, publicStaffName } from "./publicStaffDisplay";

type Props = {
  staffMembers: StaffMember[];
  selectedStaffId: string;
  onSelectStaff: (staffId: string) => void;
  availableStaffForSelectedService: StaffMember[];
};

export default function PublicBusinessStaffPicker({
  staffMembers,
  selectedStaffId,
  onSelectStaff,
  availableStaffForSelectedService,
}: Props) {
  const { t } = useI18n();
  return (
    <section className="public-business-section public-business-staff-step">
      <div className="public-business-section-heading-copy">
        <div>
          <p className="public-business-step-kicker">
            {t("publicBusiness.staff.step", "Step 2")}
          </p>
          <h2>{t("publicBusiness.staff.title", "Choose staff")}</h2>
          <p className="small muted public-business-section-subtitle">
            {t(
              "publicBusiness.staff.subtitle",
              "Choose Any available staff or select a specific person.",
            )}
          </p>
        </div>
      </div>

      <div className="public-business-staff-list">
        {availableStaffForSelectedService.length > 0 && (
          <button
            type="button"
            onClick={() => onSelectStaff("any")}
            className={`public-business-staff-card${selectedStaffId === "any" ? " selected" : ""}`}
            aria-pressed={selectedStaffId === "any"}
          >
            <div className="public-business-staff-avatar any-staff">
              <UsersRound size={20} aria-hidden="true" />
            </div>
            <div>
              <strong>
                {t("publicBusiness.staff.any", "Any available staff")}
              </strong>
              <p className="small muted">
                {t(
                  "publicBusiness.staff.anyBody",
                  "Mirëbook will show slots for anyone who can perform the selected service.",
                )}
              </p>
            </div>
          </button>
        )}

        {availableStaffForSelectedService.map((staff) => {
          const displayName = publicStaffName(
            staff,
            t("publicBusiness.staff.memberFallback", "Staff member"),
          );

          return (
            <button
              key={staff.id}
              type="button"
              onClick={() => onSelectStaff(staff.id)}
              className={`public-business-staff-card${selectedStaffId === staff.id ? " selected" : ""}`}
              aria-pressed={selectedStaffId === staff.id}
            >
              <div className="public-business-staff-avatar">
                {staff.image_url ? (
                  <span
                    style={{ backgroundImage: `url(${staff.image_url})` }}
                  />
                ) : (
                  publicStaffInitial(staff)
                )}
              </div>

              <div>
                <strong>{displayName}</strong>
                <p className="small muted" style={{ marginTop: "0.25rem" }}>
                  {staff.role_title ||
                    t("publicBusiness.staff.memberFallback", "Staff member")}
                </p>
              </div>
            </button>
          );
        })}

        {availableStaffForSelectedService.length === 0 && (
          <div className="public-business-empty-state">
            <p className="small muted">
              {staffMembers.length === 0
                ? t(
                    "publicBusiness.staff.none",
                    "No active staff are available for this service yet.",
                  )
                : t(
                    "publicBusiness.staff.noneAssigned",
                    "No active staff are assigned to this service yet. Choose another service or contact the business.",
                  )}
            </p>
          </div>
        )}
      </div>
      <style jsx>{`
        .public-business-staff-step {
          display: grid;
          gap: 1rem;
        }
      `}</style>
    </section>
  );
}
