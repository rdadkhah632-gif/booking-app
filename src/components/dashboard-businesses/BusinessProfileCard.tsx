import Link from "next/link";
import { useI18n } from "@/lib/useI18n";
import {
  Business,
  Readiness,
  UpdateBusinessField,
} from "./dashboardBusinessesTypes";
import BusinessImageUpload from "./BusinessImageUpload";
import BusinessLocationVerification from "./BusinessLocationVerification";

type Props = {
  business: Business;
  readiness: Readiness;
  savingBusinessId: string | null;
  publishingBusinessId: string | null;
  uploadingBusinessId: string | null;
  locationRefreshKey: number;
  showPublishingAction: boolean;
  updateLocalBusiness: UpdateBusinessField;
  onSave: (business: Business) => void;
  onTogglePublished: (business: Business) => void;
  onUploadImage: (business: Business, file: File | null) => void;
  onRemoveImage: (business: Business) => void;
};

export default function BusinessProfileCard({
  business,
  readiness,
  savingBusinessId,
  publishingBusinessId,
  uploadingBusinessId,
  locationRefreshKey,
  showPublishingAction,
  updateLocalBusiness,
  onSave,
  onTogglePublished,
  onUploadImage,
  onRemoveImage,
}: Props) {
  const { t } = useI18n();
  const isSaving = savingBusinessId === business.id;
  const isPublishing = publishingBusinessId === business.id;

  return (
    <div
      className="card business-profile-card"
      style={{
        display: "grid",
        gap: "1rem",
        borderColor: readiness.publicListingReady
          ? "rgba(45,212,191,0.25)"
          : readiness.bookingReady
            ? "rgba(255,107,53,0.25)"
            : "var(--border)",
      }}
    >
      <div
        className={`business-profile-card-top${
          showPublishingAction ? "" : " without-publishing-action"
        }`}
      >
        <div
          className="business-profile-image-preview"
          style={{
            height: 112,
            borderRadius: "var(--radius)",
            background: business.image_url
              ? `linear-gradient(rgba(11,18,32,0.05), rgba(11,18,32,0.55)), url(${business.image_url})`
              : "linear-gradient(135deg, rgba(255,107,53,0.16), rgba(45,212,191,0.10))",
            backgroundSize: "cover",
            backgroundPosition: "center",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "2rem",
          }}
        >
          {!business.image_url && "✨"}
        </div>

        <div>
          <h3 style={{ marginBottom: "0.25rem" }}>
            {business.name ||
              t("dashboardBusinesses.untitledBusiness", "Untitled business")}
          </h3>

          <p className="small muted">
            {[business.category, business.city, business.country]
              .filter(Boolean)
              .join(" · ") ||
              t(
                "dashboardBusinesses.addCategoryLocation",
                "Add category and location before publishing",
              )}
          </p>

          <div className="business-status-pills">
            <span
              className="small"
              style={{
                background: business.published
                  ? "rgba(45,212,191,0.12)"
                  : "rgba(255,190,11,0.12)",
                color: business.published ? "var(--success)" : "var(--warning)",
                padding: "0.2rem 0.55rem",
                borderRadius: 999,
              }}
            >
              {business.published
                ? t("dashboardBusinesses.liveOnMirebook", "Live on Mirëbook")
                : t("dashboardBusinesses.hidden", "Hidden")}
            </span>

            <span
              className="small"
              style={{
                background:
                  (business.auto_accept_bookings ?? true)
                    ? "rgba(45,212,191,0.12)"
                    : "rgba(255,107,53,0.12)",
                color:
                  (business.auto_accept_bookings ?? true)
                    ? "var(--success)"
                    : "var(--accent)",
                padding: "0.2rem 0.55rem",
                borderRadius: 999,
              }}
            >
              {(business.auto_accept_bookings ?? true)
                ? t("dashboardBusinesses.autoAccept", "Book instantly")
                : t(
                    "dashboardSettings.approval.manualTitle",
                    "Manual approval",
                  )}
            </span>

            <span
              className="small"
              style={{
                background: readiness.bookingReady
                  ? "rgba(45,212,191,0.12)"
                  : "rgba(255,190,11,0.12)",
                color: readiness.bookingReady
                  ? "var(--success)"
                  : "var(--warning)",
                padding: "0.2rem 0.55rem",
                borderRadius: 999,
              }}
            >
              {readiness.bookingReady
                ? t("dashboardBusinesses.readyToBook", "Ready to take bookings")
                : t("dashboardBusinesses.setupIncomplete", "Needs setup")}
            </span>

            <span
              className="small"
              style={{
                background: readiness.profileComplete
                  ? "rgba(45,212,191,0.12)"
                  : "var(--surface-2)",
                color: readiness.profileComplete
                  ? "var(--success)"
                  : "var(--text-muted)",
                padding: "0.2rem 0.55rem",
                borderRadius: 999,
              }}
            >
              {readiness.profileComplete
                ? t("dashboardBusinesses.profileComplete", "Profile ready")
                : t(
                    "dashboardBusinesses.profileNeedsPolish",
                    "Add profile details",
                  )}
            </span>
          </div>
        </div>

        {showPublishingAction ? (
          <button
            type="button"
            onClick={() => onTogglePublished(business)}
            className={business.published ? "btn btn-ghost" : "btn btn-accent"}
            disabled={isPublishing}
          >
            {isPublishing
              ? t("common.updating", "Updating...")
              : business.published
                ? t(
                    "dashboardBusinesses.hideMarketplace",
                    "Hide from marketplace",
                  )
                : readiness.bookingReady
                  ? t("dashboardBusinesses.publish", "Publish to Mirëbook")
                  : t("dashboardBusinesses.finishSetup", "Finish setup first")}
          </button>
        ) : null}
      </div>

      <div className="business-detail-grid">
        <div className="card" style={{ background: "var(--surface-2)" }}>
          <p className="small muted">
            {t("dashboardBusinesses.profile.kicker", "Customer-facing profile")}
          </p>

          <h3 style={{ marginTop: "0.25rem" }}>
            {t("dashboardBusinesses.profile.title", "Profile details")}
          </h3>

          <p className="small muted" style={{ marginTop: "0.35rem" }}>
            {t(
              "dashboardBusinesses.profile.body",
              "These details appear on the public page customers use to decide and book.",
            )}
          </p>

          <div className="business-profile-input-grid">
            <label className="business-profile-field">
              <span>
                {t("dashboardBusinesses.profile.nameLabel", "Business name")}
              </span>
              <input
                placeholder={t(
                  "dashboardBusinesses.create.placeholder",
                  "Example: Studio Mira",
                )}
                value={business.name || ""}
                onChange={(e) =>
                  updateLocalBusiness(business.id, "name", e.target.value)
                }
              />
            </label>

            <label className="business-profile-field">
              <span>
                {t("dashboardBusinesses.profile.categoryLabel", "Category")}
              </span>
              <input
                placeholder={t(
                  "dashboardBusinesses.profile.categoryPlaceholder",
                  "Example: Barber or salon",
                )}
                value={business.category || ""}
                onChange={(e) =>
                  updateLocalBusiness(business.id, "category", e.target.value)
                }
              />
            </label>

            <label className="business-profile-field">
              <span>{t("dashboardBusinesses.profile.cityLabel", "City")}</span>
              <input
                placeholder={t(
                  "dashboardBusinesses.profile.cityPlaceholder",
                  "Example: Tirana",
                )}
                value={business.city || ""}
                onChange={(e) =>
                  updateLocalBusiness(business.id, "city", e.target.value)
                }
              />
            </label>

            <label className="business-profile-field">
              <span>
                {t("dashboardBusinesses.profile.countryLabel", "Country")}
              </span>
              <input
                placeholder={t(
                  "dashboardBusinesses.profile.countryPlaceholder",
                  "Example: Albania",
                )}
                value={business.country || ""}
                onChange={(e) =>
                  updateLocalBusiness(business.id, "country", e.target.value)
                }
              />
            </label>

            <label className="business-profile-field">
              <span>
                {t("dashboardBusinesses.profile.addressLabel", "Address")}
              </span>
              <input
                placeholder={t(
                  "dashboardBusinesses.profile.addressPlaceholder",
                  "Street and area",
                )}
                value={business.address || ""}
                onChange={(e) =>
                  updateLocalBusiness(business.id, "address", e.target.value)
                }
              />
            </label>

            <label className="business-profile-field">
              <span>
                {t("dashboardBusinesses.profile.phoneLabel", "Phone")}
              </span>
              <input
                placeholder={t(
                  "dashboardBusinesses.profile.phonePlaceholder",
                  "Customer contact number",
                )}
                value={business.phone || ""}
                onChange={(e) =>
                  updateLocalBusiness(business.id, "phone", e.target.value)
                }
              />
            </label>
          </div>

          <BusinessLocationVerification
            businessId={business.id}
            address={business.address}
            city={business.city}
            country={business.country}
            refreshKey={locationRefreshKey}
          />

          <BusinessImageUpload
            business={business}
            uploadingBusinessId={uploadingBusinessId}
            onUpload={onUploadImage}
            onRemove={onRemoveImage}
          />

          <label
            className="business-profile-field"
            style={{ marginTop: "0.75rem" }}
          >
            <span>
              {t(
                "dashboardBusinesses.profile.descriptionLabel",
                "Business description",
              )}
            </span>
            <textarea
              placeholder={t(
                "dashboardBusinesses.profile.descriptionPlaceholder",
                "Tell customers what you offer and what to expect",
              )}
              value={business.description || ""}
              onChange={(e) =>
                updateLocalBusiness(business.id, "description", e.target.value)
              }
              rows={4}
            />
          </label>
        </div>
      </div>

      <div
        className="card"
        style={{
          background: "var(--surface-2)",
          borderColor: "var(--border)",
          padding: "1rem",
        }}
      >
        <div className="booking-approval-row">
          <div style={{ flex: 1, minWidth: 240 }}>
            <p className="small muted">
              {t("dashboardSettings.approval.kicker", "Booking approval")}
            </p>

            <h3 style={{ marginTop: "0.25rem" }}>
              {(business.auto_accept_bookings ?? true)
                ? t(
                    "dashboardBusinesses.autoAcceptBookings",
                    "Auto-accept customer bookings",
                  )
                : t(
                    "dashboardBusinesses.manualApproveBookings",
                    "Manually approve customer bookings",
                  )}
            </h3>

            <p className="small muted" style={{ marginTop: "0.35rem" }}>
              {t(
                "dashboardBusinesses.bookingApprovalBody",
                "Choose whether bookings confirm instantly or wait for business approval.",
              )}
            </p>
          </div>

          <label className="btn btn-ghost booking-approval-toggle">
            <input
              type="checkbox"
              checked={business.auto_accept_bookings ?? true}
              onChange={(e) =>
                updateLocalBusiness(
                  business.id,
                  "auto_accept_bookings",
                  e.target.checked,
                )
              }
            />
            {t(
              "dashboardBusinesses.autoAcceptNewBookings",
              "Auto-accept new bookings",
            )}
          </label>
        </div>
      </div>

      <div className="business-profile-actions">
        <button
          type="button"
          onClick={() => onSave(business)}
          className="btn btn-accent"
          disabled={isSaving}
        >
          {isSaving
            ? t("account.saving", "Saving...")
            : t("dashboardBusinesses.saveSetup", "Save setup")}
        </button>

        <Link href={`/explore/${business.id}`} className="btn btn-ghost">
          {t("account.publicPage", "Public page")}
        </Link>
      </div>

      <style jsx>{`
        .business-profile-card-top {
          display: grid;
          grid-template-columns: 150px minmax(0, 1fr) minmax(170px, auto);
          gap: 1rem;
          align-items: start;
        }

        .business-profile-card-top.without-publishing-action {
          grid-template-columns: 150px minmax(0, 1fr);
        }

        .business-status-pills,
        .business-profile-actions {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-top: 0.7rem;
        }

        .business-profile-input-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .business-profile-field {
          display: grid;
          gap: 0.42rem;
          color: var(--text);
          font-size: 0.86rem;
          font-weight: 700;
        }

        .business-profile-field :global(input),
        .business-profile-field :global(textarea) {
          font-weight: 400;
        }

        .booking-approval-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .booking-approval-toggle {
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        @media (max-width: 860px) {
          .business-profile-card-top {
            grid-template-columns: 1fr;
          }

          .business-profile-image-preview {
            min-height: 160px;
            height: auto;
          }
        }

        @media (max-width: 640px) {
          .business-profile-actions,
          .business-profile-actions :global(.btn),
          .business-profile-actions a,
          .business-profile-actions button,
          .booking-approval-toggle {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
