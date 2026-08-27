import Link from "next/link";
import { useI18n } from "@/lib/useI18n";
import { Business, Service, StaffMember } from "./dashboardServicesTypes";
import ServiceImageUpload from "./ServiceImageUpload";
import ServiceStatusBadge from "./ServiceStatusBadge";
import { formatCurrencyAmount } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";

type Props = {
  business: Business;
  locale: Locale;
  service: Service;
  assignedStaff: StaffMember[];
  isEditing: boolean;
  isBookable: boolean;
  departureCount: number;
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
  locale,
  service,
  assignedStaff,
  isEditing,
  isBookable,
  departureCount,
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
          : !isBookable
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
            className="service-card-image"
            style={{
              backgroundImage: `linear-gradient(rgba(11,18,32,0.05), rgba(11,18,32,0.65)), url(${service.image_url})`,
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

                {service.owner_review_required && (
                  <ServiceStatusBadge
                    label={t(
                      "dashboardServices.assisted.reviewBadge",
                      "Needs your review",
                    )}
                    tone="warning"
                  />
                )}

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

                {service.booking_type === "group" && (
                  <ServiceStatusBadge
                    label={t(
                      "dashboardServices.card.scheduledGroup",
                      "Scheduled group",
                    )}
                    tone="success"
                  />
                )}
              </div>

              {!isEditing && (
                <>
                  <p className="small muted service-line">
                    {service.duration_minutes} {t("common.minutes", "minutes")}{" "}
                    ·{" "}
                    {service.owner_review_required
                      ? Number(service.price) === 0
                        ? t(
                            "dashboardServices.assisted.priceNeeded",
                            "Price to confirm",
                          )
                        : `${t(
                            "dashboardServices.assisted.estimatedPrice",
                            "Starter estimate",
                          )} · ${formatCurrencyAmount(
                            Number(service.price),
                            business.currency,
                            locale,
                          )}`
                      : formatCurrencyAmount(
                          Number(service.price),
                          business.currency,
                          locale,
                        )}
                    {service.booking_type === "group" && (
                      <> {t("dashboardServices.card.perGuest", "per guest")}</>
                    )}
                  </p>

                  {service.booking_type === "group" && (
                    <p className="small muted service-line">
                      {service.group_capacity || 0}{" "}
                      {t("dashboardServices.group.seats", "seats")} ·{" "}
                      {departureCount}{" "}
                      {t(
                        "dashboardServices.group.upcomingDepartures",
                        "upcoming departures",
                      )}
                    </p>
                  )}

                  {service.description && (
                    <p className="small muted service-line">
                      {service.description}
                    </p>
                  )}

                  <p
                    className={`small service-assignment ${isBookable ? "ready" : "needs-setup"}`}
                  >
                    {isBookable
                      ? service.booking_type === "group"
                        ? t(
                            "dashboardServices.group.ready",
                            "Customers can reserve seats on upcoming departures.",
                          )
                        : assignedStaff
                            .map(
                              (staff) =>
                                staff.name +
                                (staff.role_title
                                  ? " — " + staff.role_title
                                  : ""),
                            )
                            .join(", ")
                      : serviceReadinessText(service)}
                  </p>
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
                    <label>
                      <span>
                        {t("dashboardServices.create.duration", "Duration")}
                      </span>
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
                    </label>

                    <label>
                      <span>
                        {service.booking_type === "group"
                          ? t(
                              "dashboardServices.create.pricePerGuest",
                              "Price per guest",
                            )
                          : t(
                              "dashboardServices.create.pricePlaceholder",
                              "Price",
                            )}
                      </span>
                      <input
                        type="number"
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
                    </label>
                  </div>

                  {service.booking_type === "group" ? (
                    <div className="service-booking-format-active">
                      <div>
                        <strong>
                          {t(
                            "dashboardServices.bookingType.groupActive",
                            "Scheduled service with seats",
                          )}
                        </strong>
                        <p className="small muted service-line">
                          {departureCount > 0
                            ? t(
                                "dashboardServices.group.typeLocked",
                                "Booking type stays grouped once departures exist.",
                              )
                            : t(
                                "dashboardServices.bookingType.groupActiveHint",
                                "Customers choose a fixed departure and reserve one or more places.",
                              )}
                        </p>
                      </div>
                      {departureCount === 0 && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() =>
                            updateLocalService(
                              service.id,
                              "booking_type",
                              "appointment",
                            )
                          }
                        >
                          {t(
                            "dashboardServices.bookingType.useAppointment",
                            "Use standard appointments",
                          )}
                        </button>
                      )}
                    </div>
                  ) : (
                    <details className="service-booking-format-optional">
                      <summary>
                        {t(
                          "dashboardServices.bookingType.standardSummary",
                          "Booking format: standard appointment",
                        )}
                      </summary>
                      <div>
                        <p className="small muted service-line">
                          {t(
                            "dashboardServices.bookingType.optionalBody",
                            "Only use scheduled departures when several customers can reserve places on the same fixed time.",
                          )}
                        </p>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() =>
                            updateLocalService(
                              service.id,
                              "booking_type",
                              "group",
                            )
                          }
                        >
                          {t(
                            "dashboardServices.bookingType.useGroup",
                            "Use departures and seats",
                          )}
                        </button>
                      </div>
                    </details>
                  )}

                  {service.booking_type === "group" && (
                    <div className="service-edit-grid group-edit-grid">
                      <label>
                        <span>
                          {t(
                            "dashboardServices.group.capacity",
                            "Default seats",
                          )}
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={200}
                          value={service.group_capacity || 1}
                          onChange={(event) =>
                            updateLocalService(
                              service.id,
                              "group_capacity",
                              Number(event.target.value),
                            )
                          }
                        />
                      </label>
                      <label className="group-edit-toggle">
                        <input
                          type="checkbox"
                          checked={Boolean(service.private_booking_enabled)}
                          onChange={(event) =>
                            updateLocalService(
                              service.id,
                              "private_booking_enabled",
                              event.target.checked,
                            )
                          }
                        />
                        <span>
                          {t(
                            "dashboardServices.group.privateEnabled",
                            "Allow private trip booking",
                          )}
                        </span>
                      </label>
                      {service.private_booking_enabled && (
                        <label>
                          <span>
                            {t(
                              "dashboardServices.group.privatePrice",
                              "Private trip price",
                            )}
                          </span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={service.private_price || 0}
                            onChange={(event) =>
                              updateLocalService(
                                service.id,
                                "private_price",
                                Number(event.target.value),
                              )
                            }
                          />
                        </label>
                      )}
                    </div>
                  )}

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

            <div
              className={`service-card-actions ${isEditing ? "editing" : ""}`}
            >
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => saveService(service)}
                    className="btn btn-accent"
                    disabled={savingServiceId === service.id}
                  >
                    {savingServiceId === service.id
                      ? t("account.saving", "Saving...")
                      : t("dashboardServices.card.saveService", "Save service")}
                  </button>

                  <button
                    type="button"
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
                    type="button"
                    onClick={() => setEditingServiceId(service.id)}
                    className="btn btn-ghost"
                  >
                    {service.owner_review_required
                      ? t(
                          "dashboardServices.assisted.reviewAction",
                          "Review service",
                        )
                      : t("common.edit", "Edit")}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleService(service)}
                    className={
                      service.active ? "btn btn-ghost" : "btn btn-accent"
                    }
                  >
                    {service.active
                      ? t("dashboardServices.card.hideService", "Hide service")
                      : t("dashboardServices.card.showService", "Show service")}
                  </button>

                  {service.booking_type === "group" ? (
                    <Link
                      href={
                        "/dashboard/departures?businessId=" +
                        business.id +
                        "&serviceId=" +
                        service.id
                      }
                      className="btn btn-ghost"
                    >
                      {t(
                        "dashboardServices.group.manageDepartures",
                        "Manage departures",
                      )}
                    </Link>
                  ) : (
                    <Link
                      href={"/dashboard/staff?businessId=" + business.id}
                      className="btn btn-ghost"
                    >
                      {t("dashboardServices.hero.assignStaff", "Assign staff")}
                    </Link>
                  )}
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

        .service-card-image {
          min-height: 180px;
          background-position: center;
          background-size: cover;
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

        .service-assignment {
          position: relative;
          margin: 0.1rem 0 0;
          padding-left: 0.85rem;
          color: var(--text-muted);
        }

        .service-assignment::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0.56rem;
          width: 0.42rem;
          height: 0.42rem;
          border-radius: 50%;
          background: var(--warning);
        }

        .service-assignment.ready::before {
          background: var(--success);
        }

        .service-edit-form {
          display: grid;
          gap: 0.75rem;
          margin-top: 0.25rem;
        }

        .service-booking-format-active {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 0.75rem;
          border: 1px solid rgba(20, 184, 166, 0.42);
          border-radius: 8px;
          background: rgba(20, 184, 166, 0.08);
        }

        .service-booking-format-active p {
          margin-top: 0.2rem;
        }

        .service-booking-format-optional {
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-2);
        }

        .service-booking-format-optional summary {
          min-height: 44px;
          padding: 0.7rem 0.8rem;
          cursor: pointer;
          color: var(--text-muted);
          font-size: 0.8rem;
          font-weight: 750;
        }

        .service-booking-format-optional > div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 0 0.8rem 0.8rem;
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

        .service-edit-grid label {
          display: grid;
          gap: 0.35rem;
          color: var(--text-muted);
          font-size: 0.78rem;
          font-weight: 700;
        }

        .group-edit-grid {
          padding: 0.75rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-2);
        }

        .group-edit-toggle {
          display: flex !important;
          flex-direction: row;
          align-items: center;
          gap: 0.55rem;
          min-height: 44px;
        }

        @media (max-width: 860px) {
          .service-card-grid-with-image {
            grid-template-columns: 1fr;
          }

          .service-card-grid-with-image > div:first-child {
            border-right: 0;
            border-bottom: 1px solid var(--border);
          }

          .service-card-image {
            min-height: 132px;
          }
        }

        @media (max-width: 640px) {
          .service-card-image {
            min-height: 96px;
          }

          .service-card-content {
            padding: 0.8rem;
          }

          .service-card-top-row,
          .service-main-copy {
            gap: 0.5rem;
          }

          .service-main-copy {
            min-width: 0;
          }

          .service-card-actions {
            width: 100%;
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.4rem;
          }

          .service-card-actions.editing {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .service-booking-format-active,
          .service-booking-format-optional > div {
            align-items: stretch;
            flex-direction: column;
          }

          .service-booking-format-active :global(.btn),
          .service-booking-format-optional :global(.btn) {
            width: 100%;
            justify-content: center;
          }

          .service-card-actions :global(.btn),
          .service-card-actions a,
          .service-card-actions button {
            width: 100%;
            justify-content: center;
            min-width: 0;
            padding: 0.55rem 0.35rem;
            font-size: 0.76rem;
            line-height: 1.1;
            white-space: normal;
          }
        }
      `}</style>
    </div>
  );
}
