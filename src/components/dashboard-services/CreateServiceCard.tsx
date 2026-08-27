import { useI18n } from "@/lib/useI18n";
import ServiceImageUpload from "./ServiceImageUpload";
import ServicePreviewCard from "./ServicePreviewCard";

function normalizeBookingHint(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function suggestsScheduledGroup(name: string, category?: string | null) {
  const value = ` ${normalizeBookingHint(`${name} ${category || ""}`)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
  const groupTerms = [
    "tour",
    "tours",
    "trip",
    "trips",
    "cruise",
    "cruises",
    "excursion",
    "excursions",
    "boat",
    "boats",
    "charter",
    "charters",
    "safari",
    "rafting",
    "kayak",
    "kayaking",
    "workshop",
    "workshops",
    "class",
    "classes",
    "course",
    "courses",
    "retreat",
    "retreats",
    "experience",
    "experiences",
    "activity",
    "activities",
    "event",
    "events",
    "udhetim",
    "udhetime",
    "lundrim",
    "lundrime",
    "ekskursion",
    "ekskursione",
    "varke",
    "varka",
    "anije",
    "kurs",
    "kurse",
    "klase",
  ];

  return groupTerms.some((term) => value.includes(` ${term} `));
}

type Props = {
  formExpanded: boolean;
  loading: boolean;
  uploadingImage: boolean;
  name: string;
  description: string;
  imageUrl: string;
  imagePreviewUrl: string;
  imageFile: File | null;
  duration: number;
  price: number;
  bookingType: "appointment" | "group";
  groupCapacity: number;
  privateBookingEnabled: boolean;
  privatePrice: number;
  businessCategory?: string | null;
  currency?: string | null;
  durationOptions: () => number[];
  setFormExpanded: (value: boolean | ((previous: boolean) => boolean)) => void;
  setName: (value: string) => void;
  setDescription: (value: string) => void;
  setDuration: (value: number) => void;
  setPrice: (value: number) => void;
  setBookingType: (value: "appointment" | "group") => void;
  setGroupCapacity: (value: number) => void;
  setPrivateBookingEnabled: (value: boolean) => void;
  setPrivatePrice: (value: number) => void;
  handleCreateImageChange: (file: File | null) => void;
  clearCreateImage: () => void;
  resetForm: () => void;
  addService: (event: React.FormEvent) => void;
};

export default function CreateServiceCard({
  formExpanded,
  loading,
  uploadingImage,
  name,
  description,
  imageUrl,
  imagePreviewUrl,
  imageFile,
  duration,
  price,
  bookingType,
  groupCapacity,
  privateBookingEnabled,
  privatePrice,
  businessCategory,
  currency,
  durationOptions,
  setFormExpanded,
  setName,
  setDescription,
  setDuration,
  setPrice,
  setBookingType,
  setGroupCapacity,
  setPrivateBookingEnabled,
  setPrivatePrice,
  handleCreateImageChange,
  clearCreateImage,
  resetForm,
  addService,
}: Props) {
  const { t } = useI18n();
  const showGroupSuggestion =
    bookingType === "appointment" &&
    suggestsScheduledGroup(name, businessCategory);

  return (
    <div
      className="card create-service-card"
      style={{ marginBottom: "1.25rem" }}
    >
      <div className="services-form-header">
        <div className="services-form-copy">
          <h3>{t("dashboardServices.create.title", "Add a new service")}</h3>
        </div>

        <button
          type="button"
          onClick={() => setFormExpanded((prev) => !prev)}
          className="btn btn-ghost"
          aria-label={
            formExpanded
              ? t("dashboardServices.create.collapse", "Collapse form")
              : t("dashboardServices.create.addService", "Add service")
          }
        >
          {formExpanded
            ? t("dashboardServices.create.collapse", "Collapse form")
            : t("dashboardServices.create.addService", "Add service")}
        </button>
      </div>

      {formExpanded && (
        <form onSubmit={addService} className="services-create-form">
          <div className="services-create-fields">
            <input
              placeholder={t(
                "dashboardServices.create.namePlaceholder",
                "Service name e.g. Haircut, Dental Checkup",
              )}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            {bookingType === "group" && (
              <div className="service-format-active">
                <div>
                  <strong>
                    {t(
                      "dashboardServices.bookingType.groupActive",
                      "Shared departure with seats",
                    )}
                  </strong>
                  <p className="small muted">
                    {t(
                      "dashboardServices.bookingType.groupActiveHint",
                      "Several customers can reserve places on the same fixed date and start time.",
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setBookingType("appointment")}
                >
                  {t(
                    "dashboardServices.bookingType.useAppointment",
                    "Use one-at-a-time appointments",
                  )}
                </button>
              </div>
            )}

            {showGroupSuggestion && (
              <div className="service-format-suggestion">
                <div>
                  <strong>
                    {t(
                      "dashboardServices.bookingType.suggestionTitle",
                      "Will different customers share one start time?",
                    )}
                  </strong>
                  <p className="small muted">
                    {t(
                      "dashboardServices.bookingType.suggestionBody",
                      "Tours, classes and shared activities use departures with a seat limit. Haircuts, consultations and private time slots stay as appointments.",
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setBookingType("group")}
                >
                  {t(
                    "dashboardServices.bookingType.useGroup",
                    "Set up shared departures",
                  )}
                </button>
              </div>
            )}

            <div className="services-create-small-grid">
              <label className="small muted">
                {t("dashboardServices.create.duration", "Duration")}
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                >
                  {durationOptions().map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} {t("common.minutes", "minutes")}
                    </option>
                  ))}
                </select>
              </label>

              <label className="small muted">
                {bookingType === "group"
                  ? t(
                      "dashboardServices.create.pricePerGuest",
                      "Price per guest",
                    )
                  : t("dashboardServices.create.price", "Price")}{" "}
                ({currency || "GBP"})
                <input
                  type="number"
                  placeholder={t(
                    "dashboardServices.create.pricePlaceholder",
                    "Price",
                  )}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  min={0}
                  step="0.01"
                  required
                />
              </label>
            </div>

            {bookingType === "group" && (
              <div className="group-service-settings">
                <label className="small muted">
                  {t(
                    "dashboardServices.group.capacity",
                    "Seats on each departure",
                  )}
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={groupCapacity}
                    onChange={(event) =>
                      setGroupCapacity(Number(event.target.value))
                    }
                    required
                  />
                </label>
                <label className="group-private-toggle">
                  <input
                    type="checkbox"
                    checked={privateBookingEnabled}
                    onChange={(event) =>
                      setPrivateBookingEnabled(event.target.checked)
                    }
                  />
                  <span>
                    <strong>
                      {t(
                        "dashboardServices.group.privateEnabled",
                        "Allow private trip booking",
                      )}
                    </strong>
                    <small>
                      {t(
                        "dashboardServices.group.privateHint",
                        "One customer reserves the whole departure while every seat is still free.",
                      )}
                    </small>
                  </span>
                </label>
                {privateBookingEnabled && (
                  <label className="small muted">
                    {t(
                      "dashboardServices.group.privatePrice",
                      "Private trip price",
                    )}{" "}
                    ({currency || "GBP"})
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={privatePrice}
                      onChange={(event) =>
                        setPrivatePrice(Number(event.target.value))
                      }
                      required
                    />
                  </label>
                )}
              </div>
            )}

            <details className="services-more-details">
              <summary>
                {t("dashboardServices.create.moreDetails", "More details")}
              </summary>

              {bookingType === "appointment" && !showGroupSuggestion && (
                <div className="service-format-optional">
                  <div>
                    <strong>
                      {t(
                        "dashboardServices.bookingType.optionalTitle",
                        "Tour, class or shared trip?",
                      )}
                    </strong>
                    <p className="small muted">
                      {t(
                        "dashboardServices.bookingType.optionalBody",
                        "Use shared departures only when different customers can reserve seats on the same fixed date and start time.",
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setBookingType("group")}
                  >
                    {t(
                      "dashboardServices.bookingType.useGroup",
                      "Set up shared departures",
                    )}
                  </button>
                </div>
              )}

              <div className="services-create-grid">
                <div className="services-create-fields">
                  <textarea
                    placeholder={t(
                      "dashboardServices.create.descriptionPlaceholder",
                      "Short description shown to customers optional",
                    )}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />

                  <ServiceImageUpload
                    mode="create"
                    imageUrl={imageUrl}
                    imagePreviewUrl={imagePreviewUrl}
                    imageFile={imageFile}
                    uploading={uploadingImage}
                    onCreateImageChange={handleCreateImageChange}
                    onClearCreate={clearCreateImage}
                  />
                </div>

                <ServicePreviewCard
                  name={name}
                  duration={duration}
                  price={price}
                  currency={currency}
                  description={description}
                  imageUrl={imagePreviewUrl || imageUrl}
                />
              </div>
            </details>
          </div>

          <div className="services-create-actions">
            <button
              type="submit"
              disabled={loading || uploadingImage}
              className="btn btn-accent"
            >
              {uploadingImage
                ? t("dashboardServices.image.uploading", "Uploading...")
                : loading
                  ? t("dashboardServices.create.adding", "Adding...")
                  : t("dashboardServices.create.addService", "Add service")}
            </button>

            <button type="button" onClick={resetForm} className="btn btn-ghost">
              {t("dashboardServices.create.clearForm", "Clear form")}
            </button>
          </div>
        </form>
      )}

      <style jsx>{`
        .create-service-card {
          display: grid;
          gap: 0.85rem;
        }

        .services-form-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          align-items: flex-start;
          margin-bottom: 0;
        }

        .services-form-copy {
          display: grid;
          gap: 0.25rem;
        }

        .services-form-copy h3 {
          margin-top: 0;
        }

        .services-create-form,
        .services-create-fields {
          display: grid;
          gap: 1rem;
        }

        .services-create-form {
          gap: 1.35rem;
        }

        .services-create-fields {
          gap: 0.75rem;
        }

        .service-format-active,
        .service-format-suggestion,
        .service-format-optional {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.85rem;
          padding: 0.8rem 0.9rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-2);
        }

        .service-format-active {
          border-color: rgba(20, 184, 166, 0.42);
          background: rgba(20, 184, 166, 0.08);
        }

        .service-format-suggestion {
          border-color: rgba(255, 107, 53, 0.32);
          background: rgba(255, 107, 53, 0.08);
        }

        .service-format-active p,
        .service-format-suggestion p,
        .service-format-optional p {
          margin: 0.2rem 0 0;
        }

        .group-private-toggle span {
          display: grid;
          gap: 0.15rem;
        }

        .group-private-toggle small {
          color: var(--text-muted);
          line-height: 1.35;
        }

        .group-service-settings {
          display: grid;
          grid-template-columns:
            minmax(150px, 0.55fr) minmax(240px, 1.45fr)
            minmax(170px, 0.7fr);
          gap: 0.75rem;
          align-items: end;
          padding: 0.8rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-2);
        }

        .group-service-settings label {
          display: grid;
          gap: 0.35rem;
        }

        .group-private-toggle {
          grid-template-columns: auto minmax(0, 1fr) !important;
          align-items: center;
          cursor: pointer;
        }

        .services-create-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(240px, 0.8fr);
          gap: 1rem;
          align-items: start;
        }

        .services-create-small-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 0.75rem;
        }

        .services-create-small-grid input,
        .services-create-small-grid select {
          margin-top: 0.35rem;
        }

        .services-more-details {
          margin-top: 0.15rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.025);
        }

        .services-more-details summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          color: var(--text);
          cursor: pointer;
          font-size: 0.88rem;
          font-weight: 800;
          list-style: none;
          padding: 0.8rem 0.9rem;
        }

        .services-more-details summary::-webkit-details-marker {
          display: none;
        }

        .services-more-details summary::after {
          content: "+";
          color: var(--accent);
          font-weight: 900;
        }

        .services-more-details[open] summary {
          border-bottom: 1px solid var(--border);
          color: var(--text);
        }

        .services-more-details[open] summary::after {
          content: "-";
        }

        .services-more-details .services-create-grid {
          padding: 0.9rem;
        }

        .service-format-optional {
          margin: 0.9rem 0.9rem 0;
        }

        .services-create-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          align-items: center;
          justify-content: flex-end;
          padding-top: 0.95rem;
          border-top: 1px solid var(--border);
        }

        @media (max-width: 860px) {
          .services-create-grid {
            grid-template-columns: 1fr;
          }

          .group-service-settings {
            grid-template-columns: 1fr;
            align-items: stretch;
          }

          .services-create-actions,
          .services-create-actions :global(.btn) {
            width: 100%;
            justify-content: center;
          }

          .service-format-active,
          .service-format-suggestion,
          .service-format-optional {
            align-items: stretch;
            flex-direction: column;
          }

          .service-format-active :global(.btn),
          .service-format-suggestion :global(.btn),
          .service-format-optional :global(.btn) {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
