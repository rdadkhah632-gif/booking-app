import { useI18n } from "@/lib/useI18n";

type Props = {
  loading: boolean;
  formExpanded: boolean;
  name: string;
  roleTitle: string;
  email: string;
  phone: string;
  setFormExpanded: (value: boolean | ((previous: boolean) => boolean)) => void;
  setName: (value: string) => void;
  setRoleTitle: (value: string) => void;
  setEmail: (value: string) => void;
  setPhone: (value: string) => void;
  resetForm: () => void;
  addStaff: (event: React.FormEvent) => void;
};

export default function CreateStaffCard({
  loading,
  formExpanded,
  name,
  roleTitle,
  email,
  phone,
  setFormExpanded,
  setName,
  setRoleTitle,
  setEmail,
  setPhone,
  resetForm,
  addStaff,
}: Props) {
  const { t } = useI18n();

  return (
    <div className="card create-staff-card" style={{ marginBottom: "1.25rem" }}>
      <div className="staff-form-header">
        <div className="staff-form-copy">
          <h3>{t("dashboardStaff.create.title", "Add a staff member")}</h3>
        </div>

        <button
          type="button"
          onClick={() => setFormExpanded((prev) => !prev)}
          className="btn btn-ghost"
        >
          {formExpanded
            ? t("dashboardStaff.create.collapse", "Collapse form")
            : t("dashboardStaff.create.addStaff", "Add staff")}
        </button>
      </div>

      {formExpanded && (
        <form onSubmit={addStaff} className="staff-create-form">
          <div className="staff-create-grid">
            <input
              placeholder={t(
                "dashboardStaff.create.namePlaceholder",
                "Staff name",
              )}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <input
              placeholder={t(
                "dashboardStaff.create.rolePlaceholder",
                "Role e.g. Barber, Stylist, Dentist",
              )}
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
            />

            <input
              type="email"
              placeholder={t(
                "dashboardStaff.create.emailPlaceholder",
                "Email optional, used for staff login linking",
              )}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              placeholder={t("common.phone", "Phone")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="staff-create-actions">
            <button type="submit" disabled={loading} className="btn btn-accent">
              {loading
                ? t("dashboardStaff.create.adding", "Adding...")
                : t("dashboardStaff.create.addStaff", "Add staff")}
            </button>

            <button type="button" onClick={resetForm} className="btn btn-ghost">
              {t("dashboardServices.create.clearForm", "Clear form")}
            </button>
          </div>
        </form>
      )}

      <style jsx>{`
        .create-staff-card {
          display: grid;
          gap: 0.85rem;
        }

        .staff-form-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          align-items: flex-start;
          margin-bottom: 0;
        }

        .staff-form-copy {
          display: grid;
          gap: 0.25rem;
        }

        .staff-form-copy h3 {
          margin-top: 0;
        }

        .staff-create-form {
          display: grid;
          gap: 1rem;
        }

        .staff-create-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 0.75rem;
        }

        .staff-create-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          grid-column: 1 / -1;
          align-items: center;
        }

        @media (max-width: 640px) {
          .staff-create-actions,
          .staff-create-actions :global(.btn),
          .staff-create-actions button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
