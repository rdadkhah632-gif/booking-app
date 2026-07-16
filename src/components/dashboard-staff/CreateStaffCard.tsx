import { useI18n } from "@/lib/useI18n";

type Props = {
  loading: boolean;
  formExpanded: boolean;
  name: string;
  roleTitle: string;
  email: string;
  phone: string;
  imagePreviewUrl: string;
  uploadingImage: boolean;
  setFormExpanded: (value: boolean | ((previous: boolean) => boolean)) => void;
  setName: (value: string) => void;
  setRoleTitle: (value: string) => void;
  setEmail: (value: string) => void;
  setPhone: (value: string) => void;
  onImageChange: (file: File | null) => void;
  clearImage: () => void;
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
  imagePreviewUrl,
  uploadingImage,
  setFormExpanded,
  setName,
  setRoleTitle,
  setEmail,
  setPhone,
  onImageChange,
  clearImage,
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
          <div className="staff-photo-field">
            <div
              className="staff-photo-preview"
              style={
                imagePreviewUrl
                  ? { backgroundImage: `url(${imagePreviewUrl})` }
                  : undefined
              }
              aria-hidden="true"
            >
              {!imagePreviewUrl && (name.trim().charAt(0).toUpperCase() || "+")}
            </div>

            <div className="staff-photo-copy">
              <strong>
                {t("dashboardStaff.image.photoLabel", "Staff photo")}
              </strong>
              <span className="small muted">
                {t(
                  "dashboardStaff.image.photoOptional",
                  "Optional. Shown when customers choose a provider.",
                )}
              </span>
            </div>

            <div className="staff-photo-actions">
              <label className="btn btn-ghost staff-photo-upload">
                {uploadingImage
                  ? t("dashboardStaff.image.uploading", "Uploading...")
                  : imagePreviewUrl
                    ? t("dashboardStaff.image.change", "Change photo")
                    : t("dashboardStaff.image.choose", "Choose photo")}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(event) =>
                    onImageChange(event.target.files?.[0] || null)
                  }
                  disabled={loading || uploadingImage}
                />
              </label>

              {imagePreviewUrl && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={clearImage}
                  disabled={loading || uploadingImage}
                >
                  {t("dashboardStaff.image.remove", "Remove photo")}
                </button>
              )}
            </div>
          </div>

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

        .staff-photo-field {
          display: grid;
          grid-template-columns: 3.25rem minmax(180px, 1fr) auto;
          gap: 0.75rem;
          align-items: center;
          padding-bottom: 0.9rem;
          border-bottom: 1px solid var(--border);
        }

        .staff-photo-preview {
          display: grid;
          place-items: center;
          width: 3.25rem;
          height: 3.25rem;
          border: 1px solid var(--border);
          border-radius: 50%;
          background-color: var(--surface-2);
          background-position: center;
          background-size: cover;
          color: var(--text-muted);
          font-size: 1.1rem;
          font-weight: 800;
        }

        .staff-photo-copy {
          display: grid;
          gap: 0.18rem;
          min-width: 0;
        }

        .staff-photo-actions {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .staff-photo-upload {
          position: relative;
          overflow: hidden;
          cursor: pointer;
        }

        .staff-photo-upload input {
          position: absolute;
          width: 1px;
          height: 1px;
          opacity: 0;
          pointer-events: none;
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
          .staff-photo-field {
            grid-template-columns: 3rem minmax(0, 1fr);
          }

          .staff-photo-preview {
            width: 3rem;
            height: 3rem;
          }

          .staff-photo-actions {
            grid-column: 1 / -1;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .staff-photo-actions :global(.btn) {
            width: 100%;
            justify-content: center;
          }

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
