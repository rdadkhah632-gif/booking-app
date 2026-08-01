import Link from "next/link";
import { useI18n } from "@/lib/useI18n";
import type { DiscoveryKind } from "./exploreTypes";

type Props = {
  type: "error" | "no-businesses" | "no-results";
  error?: string | null;
  onRetry?: () => void;
  onClearFilters?: () => void;
  kind?: DiscoveryKind;
  onShowPlaces?: () => void;
};

export default function ExploreEmptyState({
  type,
  error,
  onRetry,
  onClearFilters,
  kind,
  onShowPlaces,
}: Props) {
  const { t } = useI18n();

  if (type === "error") {
    return (
      <div
        className="card"
        style={{ marginBottom: "1.5rem", borderColor: "rgba(255,77,109,0.35)" }}
      >
        <h3 style={{ color: "var(--danger)" }}>
          {t("explore.empty.errorTitle")}
        </h3>
        <p className="muted small" style={{ marginTop: "0.5rem" }}>
          {t("explore.empty.errorBody")}
        </p>
        {error && (
          <pre
            style={{
              whiteSpace: "pre-wrap",
              marginTop: "0.75rem",
              color: "var(--danger)",
            }}
          >
            {error}
          </pre>
        )}
        <div className="explore-empty-actions">
          {onRetry && (
            <button type="button" onClick={onRetry} className="btn btn-accent">
              {t("explore.empty.retryMarketplace")}
            </button>
          )}

          <Link href="/support/customer" className="btn btn-ghost">
            {t("nav.customerSupport")}
          </Link>
        </div>
      </div>
    );
  }

  if (type === "no-businesses") {
    return (
      <div className="card">
        <h3>
          {t("explore.discovery.emptyTitle", "More of Albania is coming")}
        </h3>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          {t(
            "explore.discovery.emptyBody",
            "Reviewed places and bookable businesses will appear here as they are added.",
          )}
        </p>
      </div>
    );
  }

  if (kind === "bookable") {
    return (
      <div className="card">
        <h3>
          {t(
            "explore.discovery.noBookableTitle",
            "Online bookings are opening soon",
          )}
        </h3>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          {t(
            "explore.discovery.noBookableBody",
            "There are no businesses taking Mirëbook appointments in this search yet. You can still discover reviewed local places.",
          )}
        </p>
        <div className="explore-empty-actions">
          {onShowPlaces && (
            <button
              type="button"
              onClick={onShowPlaces}
              className="btn btn-accent"
            >
              {t("explore.discovery.showPlaces", "Explore local places")}
            </button>
          )}
          {onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="btn btn-ghost"
            >
              {t("explore.filters.clear")}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>
        {t("explore.discovery.noResultsTitle", "No places match these filters")}
      </h3>
      <p className="muted" style={{ marginTop: "0.5rem" }}>
        {t(
          "explore.discovery.noResultsBody",
          "Try another category, city or search.",
        )}
      </p>
      <div className="explore-empty-actions">
        {onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="btn btn-accent"
          >
            {t("explore.filters.clear")}
          </button>
        )}
      </div>
    </div>
  );
}
