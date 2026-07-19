import { SortOption } from "./exploreTypes";
import { useI18n } from "@/lib/useI18n";
import { Search, X } from "lucide-react";

type Props = {
  search: string;
  city: string;
  category: string;
  sortBy: SortOption;
  cities: string[];
  categories: string[];
  resultCount: number;
  locationActive: boolean;
  onSearchChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSortChange: (value: SortOption) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
};

export default function ExploreFilters({
  search,
  city,
  category,
  sortBy,
  cities,
  categories,
  resultCount,
  locationActive,
  onSearchChange,
  onCityChange,
  onCategoryChange,
  onSortChange,
  onApplyFilters,
  onClearFilters,
}: Props) {
  const { t } = useI18n();
  const hasFilters = Boolean(
    search ||
      city ||
      category ||
      (sortBy !== "newest" && !(locationActive && sortBy === "distance")),
  );
  return (
    <aside className="explore-filter-panel">
      <h3 className="explore-filter-title">
        {t("explore.discovery.searchTitle", "Search Albania")}
      </h3>

      <div className="explore-filter-grid">
        <div>
          <label className="small muted">
            {t("explore.filters.searchLabel", "Search")}
          </label>
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t(
              "explore.discovery.searchPlaceholder",
              "Services, activities or places",
            )}
            style={{ width: "100%", marginTop: "0.4rem" }}
          />
        </div>

        <div>
          <label className="small muted">
            {t("explore.filters.categoryLabel", "Category")}
          </label>
          <select
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            style={{ width: "100%", marginTop: "0.4rem" }}
          >
            <option value="">
              {t("explore.category.all", "All categories")}
            </option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="small muted">
            {t("explore.filters.cityLabel", "City")}
          </label>
          <input
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            placeholder={t(
              "explore.discovery.cityPlaceholder",
              "Tirana, Durrës, Sarandë...",
            )}
            list="city-options"
            style={{ width: "100%", marginTop: "0.4rem" }}
          />

          <datalist id="city-options">
            {cities.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </div>

        {resultCount > 1 && (
          <div>
            <label className="small muted">
              {t("explore.filters.sortLabel", "Sort")}
            </label>
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              style={{ width: "100%", marginTop: "0.4rem" }}
            >
              <option value="newest">
                {t("explore.sort.recommended", "Recommended")}
              </option>
              {(locationActive || sortBy === "distance") && (
                <option value="distance">
                  {t("explore.sort.distance", "Nearest first")}
                </option>
              )}
              <option value="name">
                {t("explore.sort.name", "Business name")}
              </option>
              <option value="city">{t("explore.sort.city", "City")}</option>
              <option value="services">
                {t("explore.sort.services", "Most services")}
              </option>
            </select>
          </div>
        )}

        <button
          type="button"
          className="btn btn-accent"
          onClick={onApplyFilters}
        >
          <Search size={17} aria-hidden="true" />
          {t("explore.discovery.searchButton", "Search")}
        </button>

        {hasFilters && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClearFilters}
          >
            <X size={17} aria-hidden="true" />
            {t("explore.filters.clearButton", "Clear filters")}
          </button>
        )}
      </div>
      <style jsx>{`
        .explore-filter-panel {
          margin-bottom: 0.85rem;
          padding: 0.85rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface);
        }

        .explore-filter-title {
          margin: 0 0 0.35rem;
          font-size: 0.95rem;
        }

        .explore-filter-grid {
          display: grid;
          grid-template-columns:
            minmax(220px, 1.4fr) repeat(3, minmax(140px, 0.8fr))
            auto auto;
          gap: 0.75rem;
          align-items: end;
        }

        @media (max-width: 980px) {
          .explore-filter-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 640px) {
          .explore-filter-panel {
            padding: 0.75rem;
          }

          .explore-filter-title {
            display: none;
          }

          .explore-filter-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.55rem;
          }

          .explore-filter-grid > div:first-child {
            grid-column: 1 / -1;
          }

          .explore-filter-grid :global(.btn),
          .explore-filter-grid button {
            width: 100%;
            justify-content: center;
          }

          .explore-filter-grid :global(.btn-ghost) {
            grid-column: 1 / -1;
          }

          .explore-filter-grid :global(.btn-accent) {
            grid-column: 1 / -1;
          }

          .explore-filter-grid label {
            font-size: 0.72rem;
          }

          .explore-filter-grid input,
          .explore-filter-grid select {
            padding-inline: 0.7rem;
            font-size: 0.82rem;
          }
        }

        @media (max-width: 480px) {
          .explore-filter-grid {
            grid-template-columns: 1fr;
          }

          .explore-filter-grid > div,
          .explore-filter-grid > div:first-child,
          .explore-filter-grid :global(.btn-ghost),
          .explore-filter-grid :global(.btn-accent) {
            grid-column: 1;
          }

          .explore-filter-grid label {
            font-size: 0.76rem;
          }

          .explore-filter-grid input,
          .explore-filter-grid select {
            font-size: 0.88rem;
          }
        }
      `}</style>
    </aside>
  );
}
