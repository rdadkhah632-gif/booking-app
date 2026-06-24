import { useI18n } from "@/lib/useI18n";
import { Business } from "./publicBusinessTypes";

type Props = {
  business: Business;
  heroBackgroundImage: () => string | undefined;
  locationLabel: () => string;
  bookingModeText: () => string;
  bookingModeDescription: () => string;
};

export default function PublicBusinessHero({
  business,
  heroBackgroundImage,
  locationLabel,
  bookingModeText,
  bookingModeDescription,
}: Props) {
  const { t } = useI18n();

  return (
    <div className="card public-business-hero">
      <div
        className="public-business-hero-image"
        style={{
          backgroundImage: heroBackgroundImage(),
          backgroundColor: "var(--accent-dim)",
        }}
      />

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

        <div className="public-business-meta-grid">
          <p className="small muted">{locationLabel()}</p>

          {business.phone && <p className="small muted">{business.phone}</p>}

          <p className="small muted">{bookingModeDescription()}</p>
        </div>
      </div>
    </div>
  );
}
