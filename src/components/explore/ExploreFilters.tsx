import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useI18n } from "@/lib/useI18n";
import { SortOption } from "./exploreTypes";
import ExploreSmartSearch from "./ExploreSmartSearch";
import type {
  ExploreSearchBusiness,
  ExploreSearchPlace,
  ExploreSearchSuggestion,
} from "./ExploreSmartSearch";

type Props = {
  search: string;
  city: string;
  category: string;
  sortBy: SortOption;
  cities: string[];
  categories: string[];
  suggestionPlaces: ExploreSearchPlace[];
  suggestionBusinesses: ExploreSearchBusiness[];
  suggestionCategories: Array<{ key: string; label: string }>;
  resultCount: number;
  locationActive: boolean;
  onSearchChange: (value: string) => void;
  onSearchSuggestionSelect: (suggestion: ExploreSearchSuggestion) => void;
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
  suggestionPlaces,
  suggestionBusinesses,
  suggestionCategories,
  resultCount,
  locationActive,
  onSearchChange,
  onSearchSuggestionSelect,
  onCityChange,
  onCategoryChange,
  onSortChange,
  onApplyFilters,
  onClearFilters,
}: Props) {
  const { t } = useI18n();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const hasFilters = Boolean(
    search ||
    city ||
    category ||
    (sortBy !== "newest" && !(locationActive && sortBy === "distance")),
  );

  function submitFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApplyFilters();
  }

  return (
    <aside className="explore-filter-panel">
      <form className="explore-filter-grid" onSubmit={submitFilters}>
        <div className="filter-primary">
          <div className="filter-field filter-search-field">
            <span>{t("explore.filters.searchLabel", "Search")}</span>
            <ExploreSmartSearch
              value={search}
              placeholder={t(
                "explore.discovery.searchPlaceholder",
                "Services, activities or places",
              )}
              places={suggestionPlaces}
              businesses={suggestionBusinesses}
              cities={cities}
              categories={suggestionCategories}
              onChange={onSearchChange}
              onSelect={onSearchSuggestionSelect}
            />
          </div>

          <button
            type="button"
            className={`filter-mobile-toggle ${hasFilters ? "has-filters" : ""}`}
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            aria-controls="explore-secondary-filters"
            aria-label={t("explore.filters.open", "Filters")}
            title={t("explore.filters.open", "Filters")}
          >
            <SlidersHorizontal size={19} aria-hidden="true" />
          </button>

          <button type="submit" className="btn btn-accent filter-apply">
            <Search size={17} aria-hidden="true" />
            <span>{t("explore.discovery.searchButton", "Search")}</span>
          </button>
        </div>

        <div
          id="explore-secondary-filters"
          className={`filter-secondary ${filtersOpen ? "is-open" : ""}`}
        >
          <label className="filter-field filter-category">
            <span>{t("explore.filters.categoryLabel", "Category")}</span>
            <select
              value={category}
              onChange={(event) => onCategoryChange(event.target.value)}
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
          </label>

          <label className="filter-field filter-city">
            <span>{t("explore.filters.cityLabel", "City")}</span>
            <input
              value={city}
              onChange={(event) => onCityChange(event.target.value)}
              placeholder={t(
                "explore.discovery.cityPlaceholder",
                "Tiranë, Durrës, Sarandë...",
              )}
              list="city-options"
            />
            <datalist id="city-options">
              {cities.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </label>

          {resultCount > 1 && (
            <label className="filter-field filter-sort">
              <span>{t("explore.filters.sortLabel", "Sort")}</span>
              <select
                value={sortBy}
                onChange={(event) =>
                  onSortChange(event.target.value as SortOption)
                }
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
            </label>
          )}

          {hasFilters && (
            <button
              type="button"
              className="btn btn-ghost filter-clear"
              onClick={onClearFilters}
            >
              <X size={17} aria-hidden="true" />
              {t("explore.filters.clearButton", "Clear filters")}
            </button>
          )}
        </div>
      </form>

      <style jsx>{`
        .explore-filter-panel {
          margin-bottom: 0.9rem;
        }

        .explore-filter-grid {
          display: grid;
          grid-template-columns:
            minmax(260px, 1.55fr) minmax(150px, 0.8fr)
            minmax(150px, 0.8fr) minmax(140px, 0.65fr) auto auto;
          gap: 0;
          align-items: stretch;
          padding: 0.45rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 5px 18px rgba(20, 24, 32, 0.04);
        }

        .filter-primary,
        .filter-secondary {
          display: contents;
        }

        .filter-field {
          min-width: 0;
          padding: 0.25rem 0.8rem;
          border-right: 1px solid var(--border);
        }

        .filter-field > span {
          display: block;
          margin-bottom: 0.08rem;
          color: var(--text-muted);
          font-size: 0.68rem;
          font-weight: 700;
        }

        .filter-field input,
        .filter-field select {
          min-height: 30px;
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
          font-size: 0.88rem;
        }

        .filter-search-field {
          grid-column: 1;
          grid-row: 1;
        }

        .filter-category {
          grid-column: 2;
          grid-row: 1;
        }

        .filter-city {
          grid-column: 3;
          grid-row: 1;
        }

        .filter-sort {
          grid-column: 4;
          grid-row: 1;
        }

        .filter-apply {
          grid-column: 5;
          grid-row: 1;
          align-self: stretch;
          min-width: 112px;
          margin-left: 0.45rem;
          border-radius: 6px;
        }

        .filter-clear {
          grid-column: 6;
          grid-row: 1;
          align-self: stretch;
          margin-left: 0.4rem;
          border-radius: 6px;
        }

        .filter-mobile-toggle {
          display: none;
        }

        @media (max-width: 1050px) {
          .explore-filter-grid {
            grid-template-columns:
              minmax(220px, 1fr) repeat(2, minmax(135px, 0.65fr))
              auto auto;
          }

          .filter-sort {
            display: none;
          }

          .filter-apply {
            grid-column: 4;
          }

          .filter-clear {
            grid-column: 5;
          }
        }

        @media (max-width: 820px) {
          .explore-filter-grid {
            grid-template-columns: minmax(0, 1fr) 44px 44px;
            gap: 0.45rem;
            padding: 0;
            border: 0;
            background: transparent;
            box-shadow: none;
          }

          .filter-primary {
            display: contents;
          }

          .filter-search-field {
            grid-column: 1;
            min-height: 48px;
            padding: 0.35rem 0.75rem;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: #ffffff;
          }

          .filter-search-field > span {
            display: none;
          }

          .filter-search-field input {
            min-height: 38px;
          }

          .filter-mobile-toggle {
            grid-column: 2;
            grid-row: 1;
            display: inline-flex;
            width: 44px;
            min-height: 48px;
            align-items: center;
            justify-content: center;
            padding: 0;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: #ffffff;
            color: var(--text);
          }

          .filter-mobile-toggle.has-filters {
            border-color: rgba(237, 90, 42, 0.42);
            color: var(--accent);
          }

          .filter-apply {
            grid-column: 3;
            min-width: 44px;
            min-height: 48px;
            width: 44px;
            margin: 0;
            padding: 0;
          }

          .filter-apply span {
            position: absolute;
            width: 1px;
            height: 1px;
            overflow: hidden;
            clip: rect(0 0 0 0);
            clip-path: inset(50%);
            white-space: nowrap;
          }

          .filter-secondary {
            grid-column: 1 / -1;
            display: none;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.55rem;
            padding: 0.75rem;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: #ffffff;
            box-shadow: 0 12px 28px rgba(20, 24, 32, 0.1);
          }

          .filter-secondary.is-open {
            display: grid;
          }

          .filter-secondary .filter-field,
          .filter-secondary .filter-category,
          .filter-secondary .filter-city,
          .filter-secondary .filter-sort {
            display: block;
            grid-column: auto;
            grid-row: auto;
            padding: 0;
            border: 0;
          }

          .filter-secondary .filter-field input,
          .filter-secondary .filter-field select {
            min-height: 44px;
            margin-top: 0.28rem;
            padding: 0.55rem 0.7rem;
            border: 1px solid var(--border);
            border-radius: 6px;
          }

          .filter-clear {
            grid-column: 1 / -1;
            grid-row: auto;
            width: 100%;
            margin: 0;
            justify-content: center;
          }
        }

        @media (max-width: 430px) {
          .filter-secondary {
            grid-template-columns: 1fr;
          }

          .filter-clear {
            grid-column: 1;
          }
        }
      `}</style>
    </aside>
  );
}
