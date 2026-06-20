import { SortOption } from "./exploreTypes";
import { useI18n } from "@/lib/useI18n";

type Props = {
  search: string;
  city: string;
  category: string;
  sortBy: SortOption;
  cities: string[];
  categories: string[];
  resultCount: number;
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
  onSearchChange,
  onCityChange,
  onCategoryChange,
  onSortChange,
  onApplyFilters,
  onClearFilters,
}: Props) {
  const { t } = useI18n();
  return (
    <aside className="explore-filter-panel">
      <h3 className="explore-filter-title">{t("explore.filters.title")}</h3>

      <div className="explore-filter-grid">
        <div>
          <label className="small muted">
            {t("explore.filters.searchLabel", "Search")}
          </label>
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("explore.search.placeholder")}
            style={{ width: "100%", marginTop: "0.4rem" }}
          />
        </div>

        <div>
          <label className="small muted">
            {t("explore.filters.categoryLabel", "Category")}
          </label>
          <input
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            placeholder={t("explore.category.placeholder")}
            list="category-options"
            style={{ width: "100%", marginTop: "0.4rem" }}
          />

          <datalist id="category-options">
            {categories.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="small muted">
            {t("explore.filters.cityLabel", "City")}
          </label>
          <input
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            placeholder={t("explore.city.placeholder")}
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
                {t("explore.sort.newest", "Newest first")}
              </option>
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

        <button className="btn btn-accent" onClick={onApplyFilters}>
          {t("explore.filters.searchButton", "Search")}
        </button>

        <button className="btn btn-ghost" onClick={onClearFilters}>
          {t("explore.filters.clearButton", "Clear filters")}
        </button>
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
            minmax(220px, 1.4fr) repeat(2, minmax(150px, 0.8fr))
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
            margin-bottom: 0.55rem;
          }

          .explore-filter-grid,
          .explore-filter-grid :global(.btn),
          .explore-filter-grid button {
            grid-template-columns: 1fr;
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </aside>
  );
}
