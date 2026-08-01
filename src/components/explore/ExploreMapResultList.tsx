import Link from "next/link";
import { ArrowRight, CalendarCheck, MapPin } from "lucide-react";
import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/useI18n";
import type { DiscoveryMapItem } from "./exploreTypes";

type Props = {
  items: DiscoveryMapItem[];
  selectedId: string;
  onSelect: (itemId: string) => void;
};

export default function ExploreMapResultList({
  items,
  selectedId,
  onSelect,
}: Props) {
  const { t } = useI18n();
  const selectedRowRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [selectedId]);

  return (
    <section
      className="explore-map-results-panel"
      aria-label={t("explore.map.resultsPanel", "Map results")}
    >
      <header className="map-results-header">
        <div>
          <strong>
            {items.length === 1
              ? t("explore.discovery.oneResult", "1 result")
              : t("explore.discovery.resultCount", "{count} results").replace(
                  "{count}",
                  String(items.length),
                )}
          </strong>
          <span>
            {t(
              "explore.map.resultsHint",
              "Select a place to find it on the map.",
            )}
          </span>
        </div>
      </header>

      <div className="map-results-list">
        {items.map((item) => {
          const selected = item.id === selectedId;
          return (
            <article
              key={item.id}
              ref={selected ? selectedRowRef : undefined}
              className={`map-result-row ${selected ? "is-selected" : ""}`}
            >
              <button
                type="button"
                className="map-result-select"
                onClick={() => onSelect(item.id)}
                aria-pressed={selected}
              >
                <span className="map-result-media" aria-hidden="true">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" loading="lazy" />
                  ) : item.resultType === "business" ? (
                    <CalendarCheck size={22} />
                  ) : (
                    <MapPin size={22} />
                  )}
                </span>
                <span className="map-result-copy">
                  <span className={`map-result-type is-${item.resultType}`}>
                    {item.resultType === "business"
                      ? t("directory.map.bookableBusiness", "Bookable business")
                      : t("directory.card.type", "Local place")}
                  </span>
                  <strong>{item.name}</strong>
                  <span>{item.category}</span>
                  <span className="map-result-location">
                    <MapPin size={13} aria-hidden="true" />
                    {item.locationLabel}
                  </span>
                </span>
              </button>

              {item.href && (
                <Link
                  href={item.href}
                  className="map-result-open"
                  aria-label={`${item.name}. ${
                    item.resultType === "business"
                      ? t("explore.card.viewTimes", "View times")
                      : t("directory.card.details", "Details")
                  }`}
                >
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              )}
            </article>
          );
        })}
      </div>

      <style jsx>{`
        .explore-map-results-panel {
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          min-width: 0;
          min-height: 0;
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: #ffffff;
        }

        .map-results-header {
          padding: 0.9rem 1rem;
          border-bottom: 1px solid var(--border);
        }

        .map-results-header > div {
          display: grid;
          gap: 0.12rem;
        }

        .map-results-header strong {
          color: var(--text);
          font-size: 0.95rem;
        }

        .map-results-header span {
          color: var(--text-muted);
          font-size: 0.74rem;
        }

        .map-results-list {
          min-height: 0;
          overflow-y: auto;
          overscroll-behavior: contain;
          scrollbar-gutter: stable;
        }

        .map-result-row {
          position: relative;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 44px;
          min-width: 0;
          border-bottom: 1px solid var(--border);
          background: #ffffff;
          transition: background 0.16s ease;
        }

        .map-result-row:last-child {
          border-bottom: 0;
        }

        .map-result-row:hover,
        .map-result-row.is-selected {
          background: var(--surface-2);
        }

        .map-result-row.is-selected {
          box-shadow: inset 3px 0 0 var(--accent);
        }

        .map-result-select {
          display: grid;
          grid-template-columns: 96px minmax(0, 1fr);
          gap: 0.75rem;
          min-width: 0;
          min-height: 112px;
          align-items: center;
          padding: 0.7rem 0 0.7rem 0.7rem;
          border: 0;
          background: transparent;
          color: var(--text);
          text-align: left;
          cursor: pointer;
        }

        .map-result-media {
          display: grid;
          width: 96px;
          height: 88px;
          place-items: center;
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--success-dim);
          color: var(--success);
        }

        .map-result-media img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .map-result-copy {
          display: grid;
          gap: 0.16rem;
          min-width: 0;
        }

        .map-result-copy > strong,
        .map-result-copy > span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .map-result-copy > strong {
          font-size: 0.9rem;
        }

        .map-result-copy > span:not(.map-result-type) {
          color: var(--text-muted);
          font-size: 0.72rem;
        }

        .map-result-type {
          color: var(--success);
          font-size: 0.68rem;
          font-weight: 800;
        }

        .map-result-type.is-business {
          color: var(--accent);
        }

        .map-result-location {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .map-result-open {
          align-self: center;
          display: inline-flex;
          width: 44px;
          height: 44px;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: var(--text-muted);
        }

        .map-result-open:hover,
        .map-result-open:focus-visible {
          background: #ffffff;
          color: var(--accent);
        }

        @media (max-width: 1120px) {
          .explore-map-results-panel {
            display: none;
          }
        }
      `}</style>
    </section>
  );
}
