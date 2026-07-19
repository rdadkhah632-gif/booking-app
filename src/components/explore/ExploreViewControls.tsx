import {
  List,
  LoaderCircle,
  LocateFixed,
  Map,
  X,
} from "lucide-react";
import { useI18n } from "@/lib/useI18n";
import { ExploreView } from "./exploreTypes";

export type LocationState =
  | "idle"
  | "loading"
  | "active"
  | "denied"
  | "unavailable";

type Props = {
  view: ExploreView;
  locationState: LocationState;
  onViewChange: (view: ExploreView) => void;
  onUseLocation: () => void;
  onClearLocation: () => void;
};

export default function ExploreViewControls({
  view,
  locationState,
  onViewChange,
  onUseLocation,
  onClearLocation,
}: Props) {
  const { t } = useI18n();
  const locationActive = locationState === "active";

  return (
    <div className="explore-view-controls">
      <div
        className="explore-view-segment"
        role="group"
        aria-label={t("explore.view.label", "Result view")}
      >
        <button
          type="button"
          className={view === "list" ? "is-active" : ""}
          aria-pressed={view === "list"}
          onClick={() => onViewChange("list")}
        >
          <List size={17} aria-hidden="true" />
          {t("explore.view.list", "List")}
        </button>
        <button
          type="button"
          className={view === "map" ? "is-active" : ""}
          aria-pressed={view === "map"}
          onClick={() => onViewChange("map")}
        >
          <Map size={17} aria-hidden="true" />
          {t("explore.view.map", "Map")}
        </button>
      </div>

      <button
        type="button"
        className={locationActive ? "location-button is-active" : "location-button"}
        onClick={locationActive ? onClearLocation : onUseLocation}
        disabled={locationState === "loading"}
      >
        {locationState === "loading" ? (
          <LoaderCircle className="location-spinner" size={17} aria-hidden="true" />
        ) : locationActive ? (
          <X size={17} aria-hidden="true" />
        ) : (
          <LocateFixed size={17} aria-hidden="true" />
        )}
        {locationState === "loading"
          ? t("explore.location.finding", "Finding you...")
          : locationActive
            ? t("explore.location.clear", "Clear nearby")
            : t("explore.location.use", "Use my location")}
      </button>

      {(locationState === "denied" || locationState === "unavailable") && (
        <span className="location-note" role="status">
          {locationState === "denied"
            ? t(
                "explore.location.denied",
                "Location was not shared. Search by city instead.",
              )
            : t(
                "explore.location.unavailable",
                "Location is unavailable. Search by city instead.",
              )}
        </span>
      )}

      <style jsx>{`
        .explore-view-controls {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          flex-wrap: wrap;
          margin-bottom: 0.85rem;
        }

        .explore-view-segment {
          display: inline-grid;
          grid-template-columns: 1fr 1fr;
          padding: 3px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
        }

        .explore-view-segment button,
        .location-button {
          min-height: 38px;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: var(--text-muted);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.42rem;
          font: inherit;
          font-size: 0.84rem;
          font-weight: 700;
          cursor: pointer;
        }

        .explore-view-segment button {
          padding: 0.45rem 0.8rem;
        }

        .explore-view-segment button.is-active {
          background: var(--surface-2);
          color: var(--text);
          box-shadow: inset 0 0 0 1px var(--border-2);
        }

        .location-button {
          padding: 0.45rem 0.75rem;
          border: 1px solid var(--border);
          background: var(--surface);
        }

        .location-button:hover,
        .location-button.is-active {
          border-color: rgba(255, 107, 53, 0.45);
          color: var(--text);
        }

        .location-button:disabled {
          cursor: wait;
          opacity: 0.72;
        }

        .location-note {
          flex: 1 1 240px;
          color: var(--text-muted);
          font-size: 0.78rem;
        }

        :global(.location-spinner) {
          animation: explore-spin 0.9s linear infinite;
        }

        @keyframes explore-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 520px) {
          .explore-view-segment,
          .location-button {
            flex: 1 1 0;
          }

          .location-button {
            min-width: 0;
          }

          .location-note {
            flex-basis: 100%;
          }
        }
      `}</style>
    </div>
  );
}
