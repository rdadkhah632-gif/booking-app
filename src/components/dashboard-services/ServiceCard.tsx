import Link from "next/link";
import { useI18n } from "@/lib/useI18n";
import { Business, Service, StaffMember } from "./dashboardServicesTypes";
import ServiceImageUpload from "./ServiceImageUpload";
import ServiceStatusBadge from "./ServiceStatusBadge";

type Props = {
  business: Business;
  service: Service;
  assignedStaff: StaffMember[];
  isEditing: boolean;
  isBookable: boolean;
  savingServiceId: string | null;
  uploadingServiceId: string | null;
  durationOptions: () => number[];
  serviceReadinessText: (service: Service) => string;
  updateLocalService: (
    id: string,
    field: keyof Service,
    value: string | number | boolean,
  ) => void;
  saveService: (service: Service) => void;
  toggleService: (service: Service) => void;
  setEditingServiceId: (id: string | null) => void;
  loadData: () => void;
  uploadServiceImage: (service: Service, file: File | null) => void;
  removeServiceImage: (service: Service) => void;
};

export default function ServiceCard({
  business,
  service,
  assignedStaff,
  isEditing,
  isBookable,
  savingServiceId,
  uploadingServiceId,
  durationOptions,
  serviceReadinessText,
  updateLocalService,
  saveService,
  toggleService,
  setEditingServiceId,
  loadData,
  uploadServiceImage,
  removeServiceImage,
}: Props) {
  const { t } = useI18n();

  return (
    <div
      className="card service-card"
      style={{
        borderColor: !service.active
          ? "rgba(255,190,11,0.25)"
          : assignedStaff.length === 0
            ? "rgba(255,190,11,0.35)"
            : "rgba(45,212,191,0.16)",
        overflow: "hidden",
        padding: 0,
      }}
    >
      <div
        className={
          service.image_url
            ? "service-card-grid service-card-grid-with-image"
            : "service-card-grid"
        }
      >
        {service.image_url && (
          <div
            style={{
              minHeight: 180,
              backgroundImage: `linear-gradient(rgba(11,18,32,0.05), rgba(11,18,32,0.65)), url(${service.image_url})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        )}

        <div className="service-card-content">
          <div className="service-card-top-row">
            <div className="service-main-copy">
              <div className="service-title-row">
                <strong>
                  {service.name ||
                    t("dashboardServices.card.untitled", "Untitled service")}
                </strong>

                <ServiceStatusBadge
                  label={
                    service.active
                      ? t("dashboardServices.card.visible", "Visible")
                      : t("dashboardServices.card.hidden", "Hidden")
                  }
                  tone={service.active ? "success" : "warning"}
                />

                <ServiceStatusBadge
                  label={
                    isBookable
                      ? t("dashboardServices.card.bookable", "Bookable")
                      : t(
                          "dashboardServices.card.notBookable",
                          "Not bookable yet",
                        )
                  }
                  tone={isBookable ? "success" : "warning"}
                />

                {assignedStaff.length > 0 ? (
                  <ServiceStatusBadge
                    label={`${assignedStaff.length} ${t("dashboardServices.card.staffAssigned", "staff assigned")}`}
                    tone="success"
                  />
                ) : (
                  <ServiceStatusBadge
                    label={t(
                      "dashboardServices.card.noStaffAssigned",
                      "No staff assigned",
                    )}
                    tone="warning"
                  />
                )}
              </div>

              {!isEditing && (
                <>
                  <p className="small muted service-line">
                    {service.duration_minutes} {t("common.minutes", "minutes")}{" "}
                    · £{Number(service.price).toFixed(2)}
                  </p>

                  {service.description ? (
                    <p className="small muted service-line">
                      {service.description}
                    </p>
                  ) : (
                    <p className="small muted service-line">
                      {t(
                        "dashboardServices.card.noDescription",
                        "No description added yet.",
                      )}
                    </p>
                  )}

                  <div
                    className="card service-bookability-card"
                    style={{ background: "var(--surface-2)" }}
                  >
                    <strong>
                      {isBookable
                        ? t(
                            "dashboardServices.card.customersCanBook",
                            "Customers can book this service",
                          )
                        : t(
                            "dashboardServices.card.completeSetup",
                            "Complete setup before customers can book this service",
                          )}
                    </strong>

                    <p className="small muted service-line">
                      {serviceReadinessText(service)}
                    </p>

                    <p className="small muted service-line">
                      {t("support.business.staff", "Staff")}:{" "}
                      {assignedStaff.length > 0
                        ? assignedStaff
                            .map(
                              (staff) =>
                                `${staff.name}${staff.role_title ? ` — ${staff.role_title}` : ""}`,
                            )
                            .join(", ")
                        : t(
                            "dashboardServices.card.assignStaffHint",
                            "Assign active staff to make this service bookable.",
                          )}
                    </p>
                  </div>
                </>
              )}

              {isEditing && (
                <div className="service-edit-form">
                  <input
                    placeholder={t(
                      "dashboardServices.card.serviceNamePlaceholder",
                      "Service name",
                    )}
                    value={service.name || ""}
                    onChange={(e) =>
                      updateLocalService(service.id, "name", e.target.value)
                    }
                  />

                  <div className="service-edit-grid">
                    <input
                      type="number"
                      placeholder={t(
                        "dashboardServices.create.durationPlaceholder",
                        "Duration",
                      )}
                      value={service.duration_minutes}
                      onChange={(e) =>
                        updateLocalService(
                          service.id,
                          "duration_minutes",
                          Number(e.target.value),
                        )
                      }
                      min={5}
                    />

                    <select
                      value={service.duration_minutes}
                      onChange={(e) =>
                        updateLocalService(
                          service.id,
                          "duration_minutes",
                          Number(e.target.value),
                        )
                      }
                    >
                      {durationOptions().map((minutes) => (
                        <option key={minutes} value={minutes}>
                          {minutes} {t("common.minutes", "minutes")}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      placeholder={t(
                        "dashboardServices.create.pricePlaceholder",
                        "Price",
                      )}
                      value={service.price}
                      onChange={(e) =>
                        updateLocalService(
                          service.id,
                          "price",
                          Number(e.target.value),
                        )
                      }
                      min={0}
                      step="0.01"
                    />
                  </div>

                  <ServiceImageUpload
                    mode="edit"
                    service={service}
                    uploading={uploadingServiceId === service.id}
                    onUploadService={uploadServiceImage}
                    onRemoveService={removeServiceImage}
                  />

                  <textarea
                    placeholder={t(
                      "dashboardServices.card.descriptionPlaceholder",
                      "Service description optional",
                    )}
                    value={service.description || ""}
                    onChange={(e) =>
                      updateLocalService(
                        service.id,
                        "description",
                        e.target.value,
                      )
                    }
                    rows={3}
                  />

                  <label
                    className="card service-visibility-toggle"
                    style={{ background: "var(--surface-2)" }}
                  >
                    <div className="service-visibility-row">
                      <input
                        type="checkbox"
                        checked={service.active}
                        onChange={(e) =>
                          updateLocalService(
                            service.id,
                            "active",
                            e.target.checked,
                          )
                        }
                      />

                      <div>
                        <strong>
                          {t(
                            "dashboardServices.card.visibleToCustomers",
                            "Visible to customers",
                          )}
                        </strong>
                        <p className="small muted service-line">
                          {t(
                            "dashboardServices.card.hiddenHint",
                            "Hidden services stay saved but will not be offered for booking.",
                          )}
                        </p>
                      </div>
                    </div>
                  </label>
                </div>
              )}
            </div>

            <div className="service-card-actions">
              {isEditing ? (
                <>
                  <button
                    onClick={() => saveService(service)}
                    className="btn btn-accent"
                    disabled={savingServiceId === service.id}
                  >
                    {savingServiceId === service.id
                      ? t("account.saving", "Saving...")
                      : t("dashboardServices.card.saveService", "Save service")}
                  </button>

                  <button
                    onClick={() => {
                      setEditingServiceId(null);
                      loadData();
                    }}
                    className="btn btn-ghost"
                  >
                    {t("common.cancel", "Cancel")}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setEditingServiceId(service.id)}
                    className="btn btn-ghost"
                  >
                    {t("common.edit", "Edit")}
                  </button>

                  <button
                    onClick={() => toggleService(service)}
                    className={
                      service.active ? "btn btn-ghost" : "btn btn-accent"
                    }
                  >
                    {service.active
                      ? t("dashboardServices.card.hideService", "Hide service")
                      : t("dashboardServices.card.showService", "Show service")}
                  </button>

                  <Link
                    href={`/dashboard/staff?businessId=${business.id}`}
                    className="btn btn-ghost"
                  >
                    {t("dashboardServices.hero.assignStaff", "Assign staff")}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .service-card-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0;
        }

        .service-card-grid-with-image {
          grid-template-columns: 180px minmax(0, 1fr);
        }

        .service-card-grid-with-image > div:first-child {
          border-right: 1px solid var(--border);
        }

        .service-card-content {
          padding: 1.05rem;
        }

        .service-card-top-row {
          display: flex;
          justify-content: space-between;
          gap: 1.25rem;
          flex-wrap: wrap;
          align-items: flex-start;
        }

        .service-main-copy {
          flex: 1;
          min-width: 260px;
          display: grid;
          gap: 0.6rem;
        }

        .service-title-row {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .service-line {
          margin-top: 0;
        }

        .service-bookability-card {
          display: grid;
          gap: 0.45rem;
          padding: 0.85rem;
          margin-top: 0.25rem;
        }

        .service-bookability-card p {
          margin-top: 0;
        }

        .service-edit-form {
          display: grid;
          gap: 0.75rem;
          margin-top: 0.25rem;
        }

        .service-visibility-toggle {
          cursor: pointer;
        }

        .service-visibility-row {
          display: flex;
          gap: 0.6rem;
          align-items: center;
        }

        .service-visibility-row p {
          margin-top: 0;
        }

        .service-card-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: flex-end;
          align-items: center;
        }

        .service-edit-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 0.75rem;
        }

        @media (max-width: 860px) {
          .service-card-grid-with-image {
            grid-template-columns: 1fr;
          }

          .service-card-grid-with-image > div:first-child {
            border-right: 0;
            border-bottom: 1px solid var(--border);
          }
        }

        @media (max-width: 640px) {
          .service-card-actions,
          .service-card-actions :global(.btn),
          .service-card-actions a,
          .service-card-actions button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
