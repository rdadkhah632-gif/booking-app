import { useI18n } from "@/lib/useI18n";
import { Business } from "./publicBusinessTypes";

type Props = {
  business: Business;
  heroBackgroundImage: () => string | undefined;
  locationLabel: () => string;
  bookingModeText: () => string;
};

function businessInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function PublicBusinessHero({
  business,
  heroBackgroundImage,
  locationLabel,
  bookingModeText,
}: Props) {
  const { t } = useI18n();
  const backgroundImage = heroBackgroundImage();

  return (
    <div className="card public-business-hero">
      <div
        className="public-business-hero-image"
        style={{
          backgroundImage,
          backgroundColor: "var(--accent-dim)",
        }}
      >
        {!backgroundImage && (
          <span className="public-business-hero-fallback" aria-hidden="true">
            {businessInitials(business.name) || "M"}
          </span>
        )}
      </div>

      <div className="public-business-hero-content">
        <div className="public-business-hero-tags">
          {business.category && (
            <span className="small public-business-pill-accent">
              {business.category}
            </span>
          )}
          <span className="small public-business-pill-muted">
            {bookingModeText()}
          </span>
        </div>

        <h1 className="page-title">{business.name}</h1>

        {business.description && (
          <p className="page-sub public-business-hero-description">
            {business.description}
          </p>
        )}

        <div className="public-business-contact-row">
          <span>{locationLabel()}</span>
          {business.phone && <span>{business.phone}</span>}
        </div>
      </div>
    </div>
  );
}
