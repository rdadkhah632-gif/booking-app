import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { ArrowRight, MapPin } from "lucide-react";
import AuthNav from "@/components/AuthNav";
import ExploreBusinessCard from "@/components/explore/ExploreBusinessCard";
import ExploreDirectoryCard from "@/components/explore/ExploreDirectoryCard";
import ExploreDiscoveryMap from "@/components/explore/ExploreDiscoveryMap";
import ExploreEmptyState from "@/components/explore/ExploreEmptyState";
import ExploreFilters from "@/components/explore/ExploreFilters";
import ExploreHero from "@/components/explore/ExploreHero";
import ExploreResultsHeader from "@/components/explore/ExploreResultsHeader";
import ExploreViewControls, {
  LocationState,
} from "@/components/explore/ExploreViewControls";
import {
  DIRECTORY_CATEGORIES,
  directoryCategoryFromLabel,
  directoryCategoryLabel,
} from "@/components/explore/directoryCategories";
import {
  Business,
  BusinessCardStats,
  DirectoryPlace,
  DiscoveryMapItem,
  ExploreView,
  SortOption,
} from "@/components/explore/exploreTypes";
import { useI18n } from "@/lib/useI18n";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type AppliedFilters = {
  query: string;
  city: string;
  category: string;
  sort: SortOption;
};

type DiscoveryListItem =
  | {
      id: string;
      resultType: "business";
      name: string;
      city: string;
      distanceMeters: number | null;
      services: number;
      business: Business;
    }
  | {
      id: string;
      resultType: "directory_place";
      name: string;
      city: string;
      distanceMeters: number | null;
      services: number;
      place: DirectoryPlace;
    };

const VALID_SORTS: SortOption[] = [
  "newest",
  "distance",
  "name",
  "city",
  "services",
];

function queryText(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function businessStats(business: Business): BusinessCardStats {
  const activeStaffIds = new Set(
    (business.staff_members || [])
      .filter((staff) => staff.active)
      .map((staff) => staff.id),
  );
  const activeServices = (business.services || []).filter(
    (service) => service.active,
  ).length;
  const assignedServices = (business.services || []).filter(
    (service) =>
      service.active &&
      (service.staff_services || []).some((assignment) =>
        activeStaffIds.has(assignment.staff_member_id),
      ),
  ).length;
  const activeStaff = activeStaffIds.size;
  const openDays = (business.availability || []).filter(
    (row) => row.is_closed !== true,
  ).length;
  const missing: string[] = [];

  if (activeServices === 0) missing.push("active services");
  if (activeStaff === 0) missing.push("active staff");
  if (assignedServices === 0) missing.push("staff-service assignments");
  if (openDays === 0) missing.push("working hours");

  return {
    activeServices,
    activeStaff,
    openDays,
    assignedServices,
    missing,
    bookable: assignedServices > 0 && activeStaff > 0 && openDays > 0,
  };
}

function normaliseBusiness(value: Business): Business {
  return {
    ...value,
    resultType: "business",
    services: value.services || [],
    staff_members: value.staff_members || [],
    availability: value.availability || [],
  };
}

async function fetchWithTimeout(path: string, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(path, { signal: controller.signal });
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    return { response, payload };
  } finally {
    window.clearTimeout(timeout);
  }
}

function distanceValue(value: number | null | undefined) {
  return typeof value === "number" ? value : Number.POSITIVE_INFINITY;
}

function approximateCoordinate(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

export default function Explore() {
  const router = useRouter();
  const { t } = useI18n();
  const requestSequence = useRef(0);

  const appliedFilters = useMemo<AppliedFilters>(() => {
    const sortValue = queryText(router.query.sort);
    return {
      query: queryText(router.query.query),
      city: queryText(router.query.city),
      category: queryText(router.query.category),
      sort: VALID_SORTS.includes(sortValue as SortOption)
        ? (sortValue as SortOption)
        : "newest",
    };
  }, [
    router.query.category,
    router.query.city,
    router.query.query,
    router.query.sort,
  ]);

  const routeView: ExploreView =
    queryText(router.query.view) === "map" ? "map" : "list";

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [directoryPlaces, setDirectoryPlaces] = useState<DirectoryPlace[]>([]);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [view, setView] = useState<ExploreView>("list");
  const [selectedMapId, setSelectedMapId] = useState("");
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    setSearch(appliedFilters.query);
    setCity(appliedFilters.city);
    const directoryCategory = directoryCategoryFromLabel(
      appliedFilters.category,
      t,
    );
    setCategory(
      directoryCategory
        ? directoryCategoryLabel(directoryCategory, t)
        : appliedFilters.category,
    );
    setSortBy(appliedFilters.sort);
    setView(routeView);
  }, [appliedFilters, routeView, router.isReady, t]);

  const loadDiscovery = useCallback(
    async (filters: AppliedFilters, coordinates: Coordinates | null) => {
      const requestId = ++requestSequence.current;
      setLoading(true);
      setError(null);

      const businessParams = new URLSearchParams();
      const directoryParams = new URLSearchParams({ limit: "100" });
      if (filters.query) directoryParams.set("q", filters.query);
      if (filters.city) directoryParams.set("city", filters.city);

      const directoryCategory = directoryCategoryFromLabel(
        filters.category,
        t,
      );
      if (directoryCategory) {
        directoryParams.set("category", directoryCategory);
      }

      if (coordinates) {
        const latitude = coordinates.latitude.toFixed(6);
        const longitude = coordinates.longitude.toFixed(6);
        businessParams.set("latitude", latitude);
        businessParams.set("longitude", longitude);
        directoryParams.set("latitude", latitude);
        directoryParams.set("longitude", longitude);
      }

      const businessPath = `/api/public/explore-businesses${
        businessParams.size ? `?${businessParams.toString()}` : ""
      }`;
      const directoryPath = `/api/public/directory-places?${directoryParams.toString()}`;

      const [businessResult, directoryResult] = await Promise.allSettled([
        fetchWithTimeout(businessPath),
        fetchWithTimeout(directoryPath),
      ]);

      if (requestId !== requestSequence.current) return;

      let successfulSource = false;
      let nextBusinesses: Business[] = [];
      let nextPlaces: DirectoryPlace[] = [];

      if (
        businessResult.status === "fulfilled" &&
        businessResult.value.response.ok
      ) {
        const payload = businessResult.value.payload as {
          businesses?: Business[];
        } | null;
        nextBusinesses = (payload?.businesses || [])
          .map(normaliseBusiness)
          .filter(
            (business) =>
              business.published === true && businessStats(business).bookable,
          );
        successfulSource = true;
      }

      if (
        directoryResult.status === "fulfilled" &&
        directoryResult.value.response.ok
      ) {
        const payload = directoryResult.value.payload as {
          places?: DirectoryPlace[];
        } | null;
        nextPlaces = (payload?.places || []).filter(
          (place) =>
            place.resultType === "directory_place" &&
            DIRECTORY_CATEGORIES.includes(place.categoryKey) &&
            Number.isFinite(place.location?.latitude) &&
            Number.isFinite(place.location?.longitude),
        );
        successfulSource = true;
      }

      const liveBusinessIds = new Set(
        nextBusinesses.map((business) => business.id),
      );
      nextPlaces = nextPlaces.filter(
        (place) =>
          !place.linkedBusinessId || !liveBusinessIds.has(place.linkedBusinessId),
      );

      setBusinesses(nextBusinesses);
      setDirectoryPlaces(nextPlaces);
      setLoading(false);

      if (!successfulSource) {
        setError(t("explore.empty.genericError"));
      }
    },
    [t],
  );

  useEffect(() => {
    if (!router.isReady) return;
    void loadDiscovery(appliedFilters, userLocation);
  }, [appliedFilters, loadDiscovery, router.isReady, userLocation]);

  useEffect(() => {
    return () => {
      requestSequence.current += 1;
    };
  }, []);

  function locationLabel(business: Business) {
    return (
      [business.address, business.city, business.country]
        .filter(Boolean)
        .join(", ") || t("explore.card.locationComingSoon")
    );
  }

  function imageBackground(business: Business) {
    if (!business.image_url) {
      return "radial-gradient(circle at 25% 20%, rgba(255,107,53,0.24), transparent 36%), linear-gradient(135deg, rgba(255,107,53,0.16), rgba(45,212,191,0.08)), rgba(24,23,34,0.9)";
    }

    return `linear-gradient(rgba(11,18,32,0.05), rgba(11,18,32,0.68)), url("${business.image_url}")`;
  }

  const filteredBusinesses = useMemo(() => {
    return businesses.filter((business) => {
      const searchText = `${business.name || ""} ${business.description || ""} ${
        business.category || ""
      } ${business.city || ""} ${business.country || ""} ${
        business.address || ""
      }`.toLocaleLowerCase();
      const matchesSearch = appliedFilters.query
        ? searchText.includes(appliedFilters.query.toLocaleLowerCase())
        : true;
      const matchesCity = appliedFilters.city
        ? (business.city || "")
            .toLocaleLowerCase()
            .includes(appliedFilters.city.toLocaleLowerCase())
        : true;
      const matchesCategory = appliedFilters.category
        ? (business.category || "")
            .toLocaleLowerCase()
            .includes(appliedFilters.category.toLocaleLowerCase())
        : true;
      return matchesSearch && matchesCity && matchesCategory;
    });
  }, [appliedFilters, businesses]);

  const filteredDirectoryPlaces = useMemo(() => {
    const selectedDirectoryCategory = directoryCategoryFromLabel(
      appliedFilters.category,
      t,
    );
    return directoryPlaces.filter((place) => {
      const searchText = `${place.name} ${place.description || ""} ${
        place.address || ""
      } ${place.city || ""} ${place.region || ""}`.toLocaleLowerCase();
      const matchesSearch = appliedFilters.query
        ? searchText.includes(appliedFilters.query.toLocaleLowerCase())
        : true;
      const matchesCity = appliedFilters.city
        ? (place.city || "").toLocaleLowerCase() ===
          appliedFilters.city.toLocaleLowerCase()
        : true;
      const matchesCategory = selectedDirectoryCategory
        ? place.categoryKey === selectedDirectoryCategory
        : appliedFilters.category
          ? directoryCategoryLabel(place.categoryKey, t)
              .toLocaleLowerCase()
              .includes(appliedFilters.category.toLocaleLowerCase())
          : true;
      return matchesSearch && matchesCity && matchesCategory;
    });
  }, [appliedFilters, directoryPlaces, t]);

  const visibleDirectoryPlaces = useMemo(() => {
    const visibleBusinessIds = new Set(businesses.map((business) => business.id));
    return filteredDirectoryPlaces.filter(
      (place) =>
        !place.linkedBusinessId || !visibleBusinessIds.has(place.linkedBusinessId),
    );
  }, [businesses, filteredDirectoryPlaces]);

  const cities = useMemo(() => {
    const unique = new Set(
      [
        ...businesses.map((business) => business.city?.trim()),
        ...directoryPlaces.map((place) => place.city?.trim()),
      ].filter(Boolean) as string[],
    );
    return Array.from(unique).sort((left, right) => left.localeCompare(right));
  }, [businesses, directoryPlaces]);

  const categories = useMemo(() => {
    const unique = new Set(
      [
        ...businesses.map((business) => business.category?.trim()),
        ...DIRECTORY_CATEGORIES.map((item) => directoryCategoryLabel(item, t)),
      ].filter(Boolean) as string[],
    );
    return Array.from(unique).sort((left, right) => left.localeCompare(right));
  }, [businesses, t]);

  const listItems = useMemo<DiscoveryListItem[]>(() => {
    const items: DiscoveryListItem[] = [
      ...filteredBusinesses.map((business) => ({
        id: `business:${business.id}`,
        resultType: "business" as const,
        name: business.name,
        city: business.city || "",
        distanceMeters: business.distanceMeters ?? null,
        services: businessStats(business).activeServices,
        business,
      })),
      ...visibleDirectoryPlaces.map((place) => ({
        id: `directory:${place.id}`,
        resultType: "directory_place" as const,
        name: place.name,
        city: place.city || "",
        distanceMeters: place.distanceMeters ?? null,
        services: 0,
        place,
      })),
    ];

    if (appliedFilters.sort === "distance") {
      return items.sort(
        (left, right) =>
          distanceValue(left.distanceMeters) -
          distanceValue(right.distanceMeters),
      );
    }
    if (appliedFilters.sort === "name") {
      return items.sort((left, right) => left.name.localeCompare(right.name));
    }
    if (appliedFilters.sort === "city") {
      return items.sort(
        (left, right) =>
          left.city.localeCompare(right.city) || left.name.localeCompare(right.name),
      );
    }
    if (appliedFilters.sort === "services") {
      return items.sort(
        (left, right) =>
          right.services - left.services || left.name.localeCompare(right.name),
      );
    }
    return items;
  }, [appliedFilters.sort, filteredBusinesses, visibleDirectoryPlaces]);

  const mapItems = useMemo<DiscoveryMapItem[]>(() => {
    const businessItems = filteredBusinesses.flatMap((business) => {
      if (!business.location) return [];
      return [
        {
          id: `business:${business.id}`,
          resultType: "business" as const,
          name: business.name,
          category: business.category || t("common.business", "Business"),
          locationLabel: locationLabel(business),
          latitude: business.location.latitude,
          longitude: business.location.longitude,
          distanceMeters: business.distanceMeters ?? null,
          href: `/explore/${business.id}`,
        },
      ];
    });
    const directoryItems = visibleDirectoryPlaces.map((place) => ({
      id: `directory:${place.id}`,
      resultType: "directory_place" as const,
      name: place.name,
      category: directoryCategoryLabel(place.categoryKey, t),
      locationLabel:
        [place.city, place.region].filter(Boolean).join(", ") ||
        t("directory.card.albania", "Albania"),
      latitude: place.location.latitude,
      longitude: place.location.longitude,
      distanceMeters: place.distanceMeters ?? null,
      href: `/places/${place.id}`,
    }));
    return [...businessItems, ...directoryItems];
  }, [filteredBusinesses, visibleDirectoryPlaces, t]);

  const selectedMapItem = useMemo(
    () => mapItems.find((item) => item.id === selectedMapId) || null,
    [mapItems, selectedMapId],
  );

  useEffect(() => {
    if (selectedMapId && !selectedMapItem) setSelectedMapId("");
  }, [selectedMapId, selectedMapItem]);

  const marketplaceStats = useMemo(
    () => ({
      businesses: businesses.length,
      places: directoryPlaces.length,
      cities: cities.length,
      categories: categories.length,
      visible: listItems.length,
    }),
    [businesses.length, categories.length, cities.length, directoryPlaces.length, listItems.length],
  );

  function pushFilters(next: {
    query?: string;
    city?: string;
    category?: string;
    sort?: SortOption;
    view?: ExploreView;
  }) {
    const nextView = next.view ?? view;
    const nextSort = next.sort ?? sortBy;
    void router.push({
      pathname: "/explore",
      query: {
        ...(next.query?.trim() ? { query: next.query.trim() } : {}),
        ...(next.city?.trim() ? { city: next.city.trim() } : {}),
        ...(next.category?.trim() ? { category: next.category.trim() } : {}),
        ...(nextSort !== "newest" ? { sort: nextSort } : {}),
        ...(nextView === "map" ? { view: "map" } : {}),
      },
    });
  }

  function applyFiltersToUrl() {
    pushFilters({ query: search, city, category, sort: sortBy });
  }

  function clearFilters() {
    const nextSort: SortOption = userLocation ? "distance" : "newest";
    setSearch("");
    setCity("");
    setCategory("");
    setSortBy(nextSort);
    pushFilters({ query: "", city: "", category: "", sort: nextSort });
  }

  function changeView(nextView: ExploreView) {
    setView(nextView);
    pushFilters({
      query: appliedFilters.query,
      city: appliedFilters.city,
      category: appliedFilters.category,
      sort: appliedFilters.sort,
      view: nextView,
    });
  }

  function showOnMap(placeId: string) {
    setSelectedMapId(`directory:${placeId}`);
    changeView("map");
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationState("unavailable");
      return;
    }

    setLocationState("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: approximateCoordinate(position.coords.latitude),
          longitude: approximateCoordinate(position.coords.longitude),
        });
        setLocationState("active");
        setSortBy("distance");
        pushFilters({
          query: appliedFilters.query,
          city: appliedFilters.city,
          category: appliedFilters.category,
          sort: "distance",
        });
      },
      (locationError) => {
        setLocationState(locationError.code === 1 ? "denied" : "unavailable");
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 300_000 },
    );
  }

  function clearCurrentLocation() {
    setUserLocation(null);
    setLocationState("idle");
    const nextSort = appliedFilters.sort === "distance" ? "newest" : appliedFilters.sort;
    setSortBy(nextSort);
    pushFilters({
      query: appliedFilters.query,
      city: appliedFilters.city,
      category: appliedFilters.category,
      sort: nextSort,
    });
  }

  const hasFilters = Boolean(
    appliedFilters.query || appliedFilters.city || appliedFilters.category,
  );
  const hasAnyResults = businesses.length > 0 || directoryPlaces.length > 0;

  return (
    <main>
      <AuthNav />

      <section className="container explore-page">
        <ExploreHero marketplaceStats={marketplaceStats} />

        <ExploreFilters
          search={search}
          city={city}
          category={category}
          sortBy={sortBy}
          cities={cities}
          categories={categories}
          resultCount={listItems.length}
          locationActive={locationState === "active"}
          onSearchChange={setSearch}
          onCityChange={setCity}
          onCategoryChange={setCategory}
          onSortChange={setSortBy}
          onApplyFilters={applyFiltersToUrl}
          onClearFilters={clearFilters}
        />

        <ExploreViewControls
          view={view}
          locationState={locationState}
          onViewChange={changeView}
          onUseLocation={useCurrentLocation}
          onClearLocation={clearCurrentLocation}
        />

        {error && (
          <ExploreEmptyState
            type="error"
            error={error}
            onRetry={() => loadDiscovery(appliedFilters, userLocation)}
          />
        )}

        {!error && (
          <section className="explore-results-section">
            <ExploreResultsHeader
              loading={loading}
              filteredCount={listItems.length}
              hasFilters={hasFilters}
              onClearFilters={clearFilters}
            />

            {loading && (
              <div className="card explore-loading-state" role="status">
                <p className="muted">
                  {t("explore.discovery.loading", "Finding places...")}
                </p>
              </div>
            )}

            {!loading && !hasAnyResults && (
              <ExploreEmptyState type="no-businesses" />
            )}

            {!loading && hasAnyResults && listItems.length === 0 && (
              <ExploreEmptyState
                type="no-results"
                onClearFilters={clearFilters}
              />
            )}

            {!loading && listItems.length > 0 && view === "list" && (
              <div className="explore-results-grid">
                {listItems.map((item) =>
                  item.resultType === "business" ? (
                    <ExploreBusinessCard
                      key={item.id}
                      business={item.business}
                      stats={businessStats(item.business)}
                      locationLabel={locationLabel}
                      imageBackground={imageBackground}
                    />
                  ) : (
                    <ExploreDirectoryCard
                      key={item.id}
                      place={item.place}
                      onShowOnMap={showOnMap}
                    />
                  ),
                )}
              </div>
            )}

            {!loading && listItems.length > 0 && view === "map" && (
              <div className="explore-map-layout">
                <ExploreDiscoveryMap
                  items={mapItems}
                  selectedId={selectedMapId}
                  userLocation={userLocation}
                  onSelect={setSelectedMapId}
                />

                {selectedMapItem && (
                  <aside className="map-selection" aria-live="polite">
                    <div className="map-selection-copy">
                      <span className="map-selection-type">
                        {selectedMapItem.resultType === "business"
                          ? t("directory.map.bookableBusiness", "Bookable business")
                          : t("directory.card.type", "Local place")}
                      </span>
                      <strong>{selectedMapItem.name}</strong>
                      <span>{selectedMapItem.category}</span>
                      <span className="map-selection-location">
                        <MapPin size={14} aria-hidden="true" />
                        {selectedMapItem.locationLabel}
                      </span>
                    </div>
                    {selectedMapItem.href ? (
                      <Link href={selectedMapItem.href} className="btn btn-accent">
                        {selectedMapItem.resultType === "business"
                          ? t("explore.card.viewTimes", "View times")
                          : t("directory.card.details", "Details")}
                        <ArrowRight size={16} aria-hidden="true" />
                      </Link>
                    ) : (
                      <span className="map-selection-note">
                        {t(
                          "directory.card.notBookable",
                          "Not bookable on Mirëbook yet",
                        )}
                      </span>
                    )}
                  </aside>
                )}
              </div>
            )}
          </section>
        )}
      </section>

      <style jsx>{`
        .explore-page {
          padding: 32px 24px 70px;
        }

        .explore-results-section,
        .explore-results-grid,
        .explore-map-layout {
          min-width: 0;
        }

        :global(.explore-results-header) {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          margin-bottom: 0.7rem;
          flex-wrap: wrap;
        }

        .explore-results-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
        }

        :global(.explore-business-card) {
          display: grid;
          grid-template-columns: 116px minmax(0, 1fr);
          align-items: stretch;
          min-height: 164px;
          overflow: hidden;
          padding: 0;
          color: var(--text);
          text-decoration: none;
          transition:
            border-color 0.16s ease,
            transform 0.16s ease;
        }

        :global(.explore-business-card:hover),
        :global(.explore-business-card:focus-visible) {
          border-color: rgba(255, 107, 53, 0.32);
          transform: translateY(-1px);
        }

        :global(.explore-business-content) {
          display: grid;
          gap: 0.45rem;
          min-width: 0;
          padding: 0.8rem;
        }

        .explore-map-layout {
          display: grid;
          gap: 0.7rem;
        }

        .map-selection {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          min-width: 0;
          padding: 0.8rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
        }

        .map-selection-copy {
          display: grid;
          gap: 0.2rem;
          min-width: 0;
        }

        .map-selection-copy > span:not(.map-selection-type) {
          color: var(--text-muted);
          font-size: 0.8rem;
        }

        .map-selection-type {
          color: var(--accent);
          font-size: 0.7rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .map-selection-location {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
        }

        .map-selection-note {
          color: var(--text-muted);
          font-size: 0.78rem;
          text-align: right;
        }

        :global(.explore-empty-actions) {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-top: 1rem;
        }

        @media (max-width: 900px) {
          .explore-results-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .explore-page {
            padding: 24px 24px 56px;
          }

          :global(.explore-business-card),
          :global(.explore-business-content) {
            min-width: 0;
            max-width: 100%;
          }

          :global(.explore-business-card) {
            grid-template-columns: 92px minmax(0, 1fr);
            min-height: 146px;
          }

          :global(.explore-business-image) {
            min-height: 100% !important;
            border-right: 1px solid var(--border);
            border-bottom: 0;
          }

          :global(.explore-business-content) {
            padding: 0.7rem;
          }

          .map-selection {
            display: grid;
          }

          .map-selection :global(.btn) {
            width: 100%;
            justify-content: center;
          }

          .map-selection-note {
            text-align: left;
          }

          :global(.explore-empty-actions) {
            display: grid;
          }

          :global(.explore-empty-actions .btn),
          :global(.explore-empty-actions button),
          :global(.explore-empty-actions a) {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  );
}
