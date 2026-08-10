import { KeyboardEvent, useId, useMemo, useState } from "react";
import { Building2, MapPin, Search, Shapes } from "lucide-react";
import { useI18n } from "@/lib/useI18n";

export type ExploreSearchSuggestion = {
  id: string;
  type: "directory_place" | "business" | "category" | "city";
  label: string;
  detail: string;
  city?: string;
  category?: string;
};

export type ExploreSearchPlace = {
  id: string;
  name: string;
  city: string;
  category: string;
};

export type ExploreSearchBusiness = {
  id: string;
  name: string;
  city: string;
  category: string;
};

type Props = {
  value: string;
  placeholder: string;
  places: ExploreSearchPlace[];
  businesses: ExploreSearchBusiness[];
  cities: string[];
  categories: Array<{
    key: string;
    label: string;
  }>;
  onChange: (value: string) => void;
  onSelect: (suggestion: ExploreSearchSuggestion) => void;
};

const PRIORITY_CITIES = [
  "Tiranë",
  "Durrës",
  "Vlorë",
  "Sarandë",
  "Shkodër",
  "Korçë",
  "Berat",
  "Gjirokastër",
  "Himarë",
  "Elbasan",
  "Fier",
  "Lezhë",
];

const CATEGORY_ALIASES: Record<string, string[]> = {
  beauty_grooming: [
    "barber",
    "hair",
    "salon",
    "nails",
    "tattoo",
    "beauty",
    "berber",
    "parukeri",
    "floke",
    "thonj",
    "tatuazh",
    "bukuri",
  ],
  dental_health: [
    "dentist",
    "dental",
    "teeth",
    "stomatolog",
    "dentare",
    "dhembe",
  ],
  wellness_fitness: [
    "gym",
    "fitness",
    "massage",
    "physio",
    "yoga",
    "palester",
    "masazh",
    "fizioterapi",
  ],
  events: ["event", "wedding", "venue", "evente", "dasma"],
  learning_lessons: [
    "course",
    "lesson",
    "language",
    "school",
    "kurs",
    "mesim",
    "gjuhe",
    "shkolle",
  ],
  tours_activities: [
    "tour",
    "activity",
    "jet ski",
    "boat",
    "excursion",
    "tur",
    "aktivitet",
    "skaf",
    "ekskursion",
  ],
  rentals: [
    "rent",
    "rental",
    "car hire",
    "camper",
    "boat hire",
    "qira",
    "makine me qira",
  ],
  attractions: [
    "museum",
    "park",
    "castle",
    "attraction",
    "muze",
    "kala",
    "atraksion",
  ],
  food_drink: [
    "restaurant",
    "cafe",
    "bar",
    "food",
    "restorant",
    "kafe",
    "ushqim",
  ],
  lodging: [
    "hotel",
    "apartment",
    "hostel",
    "accommodation",
    "apartament",
    "akomodim",
  ],
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchScore(term: string, values: string[]) {
  let score = 0;
  for (const value of values) {
    const candidate = normalize(value);
    if (!candidate) continue;
    if (candidate === term) score = Math.max(score, 100);
    else if (candidate.startsWith(term)) score = Math.max(score, 75);
    else if (candidate.split(" ").some((word) => word.startsWith(term))) {
      score = Math.max(score, 58);
    } else if (candidate.includes(term)) score = Math.max(score, 40);
  }
  return score;
}

function suggestionIcon(type: ExploreSearchSuggestion["type"]) {
  if (type === "directory_place") return <MapPin aria-hidden="true" />;
  if (type === "business") return <Building2 aria-hidden="true" />;
  return <Shapes aria-hidden="true" />;
}

export default function ExploreSmartSearch({
  value,
  placeholder,
  places,
  businesses,
  cities,
  categories,
  onChange,
  onSelect,
}: Props) {
  const { t } = useI18n();
  const listId = useId().replaceAll(":", "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const suggestions = useMemo(() => {
    const term = normalize(value);
    if (term.length < 2) return [];

    const ranked: Array<{
      score: number;
      priority: number;
      suggestion: ExploreSearchSuggestion;
    }> = [];
    const unique = new Set<string>();

    function add(
      score: number,
      priority: number,
      suggestion: ExploreSearchSuggestion,
    ) {
      const key = `${suggestion.type}:${suggestion.id}`;
      if (!score || unique.has(key)) return;
      unique.add(key);
      ranked.push({ score, priority, suggestion });
    }

    const availableCities = Array.from(
      new Set([...PRIORITY_CITIES, ...cities].filter(Boolean)),
    );
    for (const city of availableCities) {
      add(matchScore(term, [city]), 0, {
        id: normalize(city),
        type: "city",
        label: city,
        detail: t("explore.suggestions.city", "City"),
        city,
      });
    }

    for (const category of categories) {
      add(
        matchScore(term, [
          category.label,
          ...(CATEGORY_ALIASES[category.key] || []),
        ]),
        1,
        {
          id: category.key,
          type: "category",
          label: category.label,
          detail: t("explore.suggestions.category", "Category"),
          category: category.label,
        },
      );
    }

    for (const business of businesses) {
      add(
        matchScore(term, [business.name, business.city, business.category]),
        2,
        {
          id: business.id,
          type: "business",
          label: business.name,
          detail: [
            t("explore.suggestions.bookable", "Bookable business"),
            business.city,
          ]
            .filter(Boolean)
            .join(" · "),
          city: business.city,
          category: business.category,
        },
      );
    }

    for (const place of places) {
      add(matchScore(term, [place.name, place.city, place.category]), 3, {
        id: place.id,
        type: "directory_place",
        label: place.name,
        detail: [t("explore.suggestions.place", "Local place"), place.city]
          .filter(Boolean)
          .join(" · "),
        city: place.city,
        category: place.category,
      });
    }

    return ranked
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.priority - right.priority ||
          left.suggestion.label.localeCompare(right.suggestion.label),
      )
      .slice(0, 8)
      .map((item) => item.suggestion);
  }, [businesses, categories, cities, places, t, value]);

  const menuVisible = open && normalize(value).length >= 2;

  function activate(index: number) {
    const suggestion = suggestions[index];
    if (!suggestion) return;
    onSelect(suggestion);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (suggestions.length === 0) return;
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => {
        if (event.key === "ArrowDown") {
          return current >= suggestions.length - 1 ? 0 : current + 1;
        }
        return current <= 0 ? suggestions.length - 1 : current - 1;
      });
      return;
    }

    if (event.key === "Enter" && open && activeIndex >= 0) {
      event.preventDefault();
      activate(activeIndex);
      return;
    }

    if (event.key === "Enter") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div
      className="smart-search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
          setActiveIndex(-1);
        }
      }}
    >
      <div className="smart-search-input">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={value}
          placeholder={placeholder}
          role="combobox"
          aria-label={t("explore.filters.searchLabel", "Search")}
          aria-autocomplete="list"
          aria-expanded={menuVisible}
          aria-controls={menuVisible ? listId : undefined}
          aria-activedescendant={
            menuVisible && activeIndex >= 0
              ? `${listId}-${activeIndex}`
              : undefined
          }
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
        />
      </div>

      {menuVisible && (
        <div id={listId} className="smart-search-menu" role="listbox">
          {suggestions.length > 0 ? (
            suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.type}:${suggestion.id}`}
                id={`${listId}-${index}`}
                type="button"
                role="option"
                aria-selected={activeIndex === index}
                className={activeIndex === index ? "active" : ""}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => activate(index)}
              >
                {suggestionIcon(suggestion.type)}
                <span>
                  <strong>{suggestion.label}</strong>
                  <small>{suggestion.detail}</small>
                </span>
              </button>
            ))
          ) : (
            <p>{t("explore.suggestions.none", "No suggestions yet")}</p>
          )}
        </div>
      )}

      <style jsx>{`
        .smart-search {
          position: relative;
          min-width: 0;
          flex: 1 1 auto;
        }

        .smart-search-input {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 0.55rem;
        }

        .smart-search-input :global(svg) {
          flex: 0 0 auto;
          color: var(--text-muted);
        }

        input {
          min-width: 0;
          width: 100%;
          min-height: 30px;
          padding: 0;
          border: 0;
          border-radius: 0;
          outline: 0;
          background: transparent;
          box-shadow: none;
          font-size: 0.88rem;
        }

        input::-webkit-search-cancel-button {
          display: none;
        }

        .smart-search-menu {
          position: absolute;
          z-index: 90;
          top: calc(100% + 0.72rem);
          left: -0.8rem;
          width: min(31rem, calc(100vw - 2rem));
          max-height: min(26rem, 62vh);
          overflow-y: auto;
          padding: 0.4rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 18px 44px rgba(20, 24, 32, 0.16);
        }

        .smart-search-menu button {
          width: 100%;
          min-height: 3.25rem;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: 0.65rem;
          padding: 0.65rem 0.7rem;
          border: 1px solid transparent;
          border-radius: 6px;
          background: transparent;
          color: var(--text);
          text-align: left;
          cursor: pointer;
        }

        .smart-search-menu button:hover,
        .smart-search-menu button.active {
          border-color: rgba(20, 125, 112, 0.3);
          background: rgba(20, 125, 112, 0.08);
        }

        .smart-search-menu button :global(svg) {
          width: 1rem;
          height: 1rem;
          color: var(--directory-accent, #147d70);
        }

        .smart-search-menu button > span {
          min-width: 0;
          display: grid;
          gap: 0.15rem;
        }

        .smart-search-menu strong,
        .smart-search-menu small {
          overflow-wrap: anywhere;
        }

        .smart-search-menu strong {
          font-size: 0.86rem;
        }

        .smart-search-menu small,
        .smart-search-menu p {
          color: var(--text-muted);
          font-size: 0.75rem;
          line-height: 1.35;
        }

        .smart-search-menu p {
          margin: 0;
          padding: 0.9rem;
          text-align: center;
        }

        @media (max-width: 820px) {
          input {
            min-height: 38px;
            font-size: 1rem;
          }

          .smart-search-menu {
            top: calc(100% + 0.4rem);
            left: -0.65rem;
            width: min(32rem, calc(100vw - 2rem));
            max-height: min(22rem, 42dvh);
          }

          .smart-search-menu button {
            min-height: 44px;
          }
        }
      `}</style>
    </div>
  );
}
