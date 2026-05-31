import { SortOption } from "./exploreTypes";
import { useI18n } from "@/lib/useI18n";

type Props = {
  search: string;
  city: string;
  category: string;
  sortBy: SortOption;
  cities: string[];
  categories: string[];
  loading: boolean;
  onSearchChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSortChange: (value: SortOption) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  onRefresh: () => void;
};

export default function ExploreFilters({
  search,
  city,
  category,
  sortBy,
  cities,
  categories,
  loading,
  onSearchChange,
  onCityChange,
  onCategoryChange,
  onSortChange,
  onApplyFilters,
  onClearFilters,
  onRefresh,
}: Props) {
  const { t } = useI18n();
  return (
    <aside className="card explore-filter-panel">
      <h3 style={{ marginBottom: "0.35rem", marginTop: 0 }}>
        {t("explore.filters.title")}
      </h3>
      <p className="small muted" style={{ marginBottom: "1rem" }}>
        {t("explore.filters.subtitle")}
      </p>

      <div style={{ display: "grid", gap: "1rem" }}>
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

        <button className="btn btn-accent" onClick={onApplyFilters}>
          {t("explore.filters.searchButton", "Search Mirëbook")}
        </button>

        <button className="btn btn-ghost" onClick={onClearFilters}>
          {t("explore.filters.clearButton", "Clear filters")}
        </button>

        <button
          className="btn btn-ghost"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading
            ? t("explore.filters.refreshing", "Refreshing...")
            : t("explore.filters.refreshButton", "Refresh results")}
        </button>
      </div>
    </aside>
  );
}
