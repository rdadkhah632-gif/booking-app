import { Check } from "lucide-react";
import { Service } from "./publicBusinessTypes";
import { useI18n } from "@/lib/useI18n";

type Props = {
  services: Service[];
  selectedServiceId: string;
  bookableServiceCount: number;
  totalServiceCount?: number;
  onSelectService: (serviceId: string) => void;
  formatServicePrice: (price: number) => string;
  serviceImageBackground: (service: Service) => string | undefined;
};

export default function PublicBusinessServices({
  services,
  selectedServiceId,
  bookableServiceCount,
  totalServiceCount = services.length,
  onSelectService,
  formatServicePrice,
  serviceImageBackground,
}: Props) {
  const { t } = useI18n();

  return (
    <section className="public-business-section public-business-services-section">
      <div className="public-business-section-head">
        <div className="public-business-section-heading-copy">
          <div>
            <p className="public-business-step-kicker">
              {t("publicBusiness.services.step", "Step 1")}
            </p>
            <h2>{t("publicBusiness.services.title")}</h2>
          </div>
        </div>
        {bookableServiceCount > 0 && (
          <span className="small public-business-pill-muted">
            {bookableServiceCount}{" "}
            {bookableServiceCount === 1
              ? t("common.service", "Service").toLowerCase()
              : t("explore.card.servicePlural", "services")}
          </span>
        )}
      </div>

      <div className="public-business-service-list">
        {services.length === 0 && (
          <div className="public-business-empty-state">
            <p className="muted">{t("publicBusiness.services.none")}</p>
          </div>
        )}

        {services.map((service) => {
          const selected = selectedServiceId === service.id;

          return (
            <button
              key={service.id}
              type="button"
              onClick={() => onSelectService(service.id)}
              className={`public-business-service-card${selected ? " selected" : ""}`}
              aria-pressed={selected}
            >
              <div
                className={
                  service.image_url
                    ? "public-business-service-image has-image"
                    : "public-business-service-image no-image"
                }
                style={{ backgroundImage: serviceImageBackground(service) }}
                aria-hidden="true"
              >
                {!service.image_url && (
                  <span>{service.name[0]?.toUpperCase() || "M"}</span>
                )}
              </div>

              <div className="public-business-service-copy">
                <strong>{service.name}</strong>

                {service.booking_type === "group" && (
                  <span className="small public-business-group-label">
                    {t(
                      "publicBusiness.services.scheduledGroup",
                      "Scheduled group trip",
                    )}
                  </span>
                )}

                {service.description && (
                  <p className="small muted public-business-service-description">
                    {service.description}
                  </p>
                )}

                <p className="small muted public-business-service-meta">
                  {service.duration_minutes} {t("common.minutes", "minutes")}
                  {Number(service.price || 0) > 0 && (
                    <>
                      {" · "}
                      {formatServicePrice(service.price)}
                      {service.booking_type === "group" && (
                        <>
                          {" "}
                          {t("publicBusiness.services.perGuest", "per guest")}
                        </>
                      )}
                    </>
                  )}
                </p>
              </div>

              <span
                className={
                  selected
                    ? "public-business-service-action selected"
                    : "public-business-service-action"
                }
              >
                {selected && <Check size={15} aria-hidden="true" />}
                {selected ? t("common.selected") : t("common.choose")}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
