import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { ArrowRight, MapPin, X } from "lucide-react";
import AuthNav from "@/components/AuthNav";
import MarketplaceSurfaceStyles from "@/components/MarketplaceSurfaceStyles";
import ExploreBusinessCard from "@/components/explore/ExploreBusinessCard";
import ExploreDirectoryCard from "@/components/explore/ExploreDirectoryCard";
import ExploreDiscoveryMap from "@/components/explore/ExploreDiscoveryMap";
import ExploreEmptyState from "@/components/explore/ExploreEmptyState";
import ExploreFilters from "@/components/explore/ExploreFilters";
import ExploreHero from "@/components/explore/ExploreHero";
import ExploreViewControls, {
  LocationState,
} from "@/components/explore/ExploreViewControls";
import {
  DIRECTORY_CATEGORIES,
  businessMatchesDirectoryCategory,
  directoryCategoryFromLabel,
  directoryCategoryLabel,
} from "@/components/explore/directoryCategories";
import {
  Business,
  BusinessCardStats,
  DiscoveryKind,
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
  kind: DiscoveryKind;
};

type DiscoveryQuery = Pick<AppliedFilters, "query" | "city" | "category">;

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
const VALID_KINDS: DiscoveryKind[] = ["all", "bookable", "places"];

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

async function fetchWithTimeout(
  path: string,
  init: RequestInit = {},
  timeoutMs = 10_000,
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(path, {
      cache: "no-store",
      ...init,
      signal: controller.signal,
    });
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
  const { locale, t } = useI18n();
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
      kind: VALID_KINDS.includes(queryText(router.query.kind) as DiscoveryKind)
        ? (queryText(router.query.kind) as DiscoveryKind)
        : "all",
    };
  }, [
    router.query.category,
    router.query.city,
    router.query.query,
    router.query.sort,
    router.query.kind,
  ]);

  const routeView: ExploreView =
    queryText(router.query.view) === "map" ? "map" : "list";

  const discoveryQuery = useMemo<DiscoveryQuery>(
    () => ({
      query: appliedFilters.query,
      city: appliedFilters.city,
      category: appliedFilters.category,
    }),
    [appliedFilters.category, appliedFilters.city, appliedFilters.query],
  );

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [directoryPlaces, setDirectoryPlaces] = useState<DirectoryPlace[]>([]);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [kind, setKind] = useState<DiscoveryKind>("all");
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
    setKind(appliedFilters.kind);
    setView(routeView);
  }, [appliedFilters, routeView, router.isReady, t]);

  const loadDiscovery = useCallback(
    async (filters: DiscoveryQuery, coordinates: Coordinates | null) => {
      const requestId = ++requestSequence.current;
      setLoading(true);
      setError(null);

      const directoryParams = new URLSearchParams({
        limit: "100",
        locale,
      });
      if (filters.query) directoryParams.set("q", filters.query);
      if (filters.city) directoryParams.set("city", filters.city);

      const directoryCategory = directoryCategoryFromLabel(filters.category, t);
      if (directoryCategory) {
        directoryParams.set("category", directoryCategory);
      }

      const locationRequest = coordinates
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: approximateCoordinate(coordinates.latitude),
              longitude: approximateCoordinate(coordinates.longitude),
            }),
          }
        : {};

      const businessPath = "/api/public/explore-businesses";
      const directoryPath = `/api/public/directory-places?${directoryParams.toString()}`;

      const [businessResult, directoryResult] = await Promise.allSettled([
        fetchWithTimeout(businessPath, locationRequest),
        fetchWithTimeout(directoryPath, locationRequest),
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
            Number.isFinite(place.mapPosition?.latitude) &&
            Number.isFinite(place.mapPosition?.longitude),
        );
        successfulSource = true;
      }

      setBusinesses(nextBusinesses);
      setDirectoryPlaces(nextPlaces);
      setLoading(false);

      if (!successfulSource) {
        setError(t("explore.empty.genericError"));
      }
    },
    [locale, t],
  );

  useEffect(() => {
    if (!router.isReady) return;
    void loadDiscovery(discoveryQuery, userLocation);
  }, [discoveryQuery, loadDiscovery, router.isReady, userLocation]);

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
      return "linear-gradient(135deg, rgba(237,90,42,0.12), rgba(20,125,112,0.09)), #f4f5f6";
    }

    return `linear-gradient(rgba(11,18,32,0.05), rgba(11,18,32,0.68)), url("${business.image_url}")`;
  }

  const filteredBusinesses = useMemo(() => {
    const selectedDirectoryCategory = directoryCategoryFromLabel(
      appliedFilters.category,
      t,
    );
    return businesses.filter((business) => {
      const searchText =
        `${business.name || ""} ${business.description || ""} ${
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
      const matchesCategory = selectedDirectoryCategory
        ? businessMatchesDirectoryCategory(
            business.category,
            selectedDirectoryCategory,
          )
        : appliedFilters.category
          ? (business.category || "")
              .toLocaleLowerCase()
              .includes(appliedFilters.category.toLocaleLowerCase())
          : true;
      return matchesSearch && matchesCity && matchesCategory;
    });
  }, [appliedFilters, businesses, t]);

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
    const visibleBusinessIds = new Set(
      businesses.map((business) => business.id),
    );
    return filteredDirectoryPlaces.filter(
      (place) =>
        !place.linkedBusinessId ||
        !visibleBusinessIds.has(place.linkedBusinessId),
    );
  }, [businesses, filteredDirectoryPlaces]);

  const linkedPlaceByBusinessId = useMemo(() => {
    const linkedPlaces = new Map<string, DirectoryPlace>();
    for (const place of directoryPlaces) {
      if (place.linkedBusinessId) {
        linkedPlaces.set(place.linkedBusinessId, place);
      }
    }
    return linkedPlaces;
  }, [directoryPlaces]);

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
    const visibleItems = items.filter((item) => {
      if (appliedFilters.kind === "bookable") {
        return item.resultType === "business";
      }
      if (appliedFilters.kind === "places") {
        return item.resultType === "directory_place";
      }
      return true;
    });

    if (appliedFilters.sort === "distance") {
      return visibleItems.sort(
        (left, right) =>
          distanceValue(left.distanceMeters) -
          distanceValue(right.distanceMeters),
      );
    }
    if (appliedFilters.sort === "name") {
      return visibleItems.sort((left, right) =>
        left.name.localeCompare(right.name),
      );
    }
    if (appliedFilters.sort === "city") {
      return visibleItems.sort(
        (left, right) =>
          left.city.localeCompare(right.city) ||
          left.name.localeCompare(right.name),
      );
    }
    if (appliedFilters.sort === "services") {
      return visibleItems.sort(
        (left, right) =>
          right.services - left.services || left.name.localeCompare(right.name),
      );
    }
    return visibleItems;
  }, [
    appliedFilters.kind,
    appliedFilters.sort,
    filteredBusinesses,
    visibleDirectoryPlaces,
  ]);

  const mapItems = useMemo<DiscoveryMapItem[]>(() => {
    const businessItems =
      appliedFilters.kind === "places"
        ? []
        : filteredBusinesses.flatMap((business) => {
            const mapPosition =
              business.location ||
              linkedPlaceByBusinessId.get(business.id)?.mapPosition ||
              null;
            if (!mapPosition) return [];
            return [
              {
                id: `business:${business.id}`,
                resultType: "business" as const,
                name: business.name,
                category: business.category || t("common.business", "Business"),
                locationLabel: locationLabel(business),
                imageUrl: business.image_url || null,
                latitude: mapPosition.latitude,
                longitude: mapPosition.longitude,
                distanceMeters: business.distanceMeters ?? null,
                href: `/explore/${business.id}`,
              },
            ];
          });
    const directoryItems =
      appliedFilters.kind === "bookable"
        ? []
        : visibleDirectoryPlaces.map((place) => ({
            id: `directory:${place.id}`,
            resultType: "directory_place" as const,
            name: place.name,
            category: directoryCategoryLabel(place.categoryKey, t),
            locationLabel:
              [place.address, place.city].filter(Boolean).join(", ") ||
              t("directory.card.albania", "Albania"),
            imageUrl: place.image?.url || null,
            latitude: place.mapPosition.latitude,
            longitude: place.mapPosition.longitude,
            distanceMeters: place.distanceMeters ?? null,
            href: `/places/${place.id}`,
          }));
    return [...businessItems, ...directoryItems];
  }, [
    appliedFilters.kind,
    filteredBusinesses,
    linkedPlaceByBusinessId,
    visibleDirectoryPlaces,
    t,
  ]);

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
      places: visibleDirectoryPlaces.length,
      cities: cities.length,
      categories: categories.length,
      visible: listItems.length,
    }),
    [
      businesses.length,
      categories.length,
      cities.length,
      listItems.length,
      visibleDirectoryPlaces.length,
    ],
  );

  function pushFilters(next: {
    query?: string;
    city?: string;
    category?: string;
    sort?: SortOption;
    view?: ExploreView;
    kind?: DiscoveryKind;
  }) {
    const nextView = next.view ?? view;
    const nextSort = next.sort ?? sortBy;
    const nextKind = next.kind ?? kind;
    void router.push({
      pathname: "/explore",
      query: {
        ...(next.query?.trim() ? { query: next.query.trim() } : {}),
        ...(next.city?.trim() ? { city: next.city.trim() } : {}),
        ...(next.category?.trim() ? { category: next.category.trim() } : {}),
        ...(nextSort !== "newest" ? { sort: nextSort } : {}),
        ...(nextView === "map" ? { view: "map" } : {}),
        ...(nextKind !== "all" ? { kind: nextKind } : {}),
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
    setKind("all");
    pushFilters({
      query: "",
      city: "",
      category: "",
      sort: nextSort,
      kind: "all",
    });
  }

  function changeView(nextView: ExploreView) {
    setView(nextView);
    pushFilters({
      query: appliedFilters.query,
      city: appliedFilters.city,
      category: appliedFilters.category,
      sort: appliedFilters.sort,
      view: nextView,
      kind: appliedFilters.kind,
    });
  }

  function changeKind(nextKind: DiscoveryKind) {
    setKind(nextKind);
    pushFilters({
      query: appliedFilters.query,
      city: appliedFilters.city,
      category: appliedFilters.category,
      sort: appliedFilters.sort,
      view,
      kind: nextKind,
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
    const nextSort =
      appliedFilters.sort === "distance" ? "newest" : appliedFilters.sort;
    setSortBy(nextSort);
    pushFilters({
      query: appliedFilters.query,
      city: appliedFilters.city,
      category: appliedFilters.category,
      sort: nextSort,
    });
  }

  const hasAnyResults =
    businesses.length > 0 || visibleDirectoryPlaces.length > 0;

  return (
    <main className="marketplace-surface explore-marketplace">
      <AuthNav />
      <MarketplaceSurfaceStyles />

      <section
        className={`container explore-page ${view === "map" ? "is-map-view" : ""}`}
      >
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
          kind={kind}
          locationState={locationState}
          onViewChange={changeView}
          onKindChange={changeKind}
          onUseLocation={useCurrentLocation}
          onClearLocation={clearCurrentLocation}
        />

        {error && (
          <ExploreEmptyState
            type="error"
            error={error}
            onRetry={() => loadDiscovery(discoveryQuery, userLocation)}
          />
        )}

        {!error && (
          <section className="explore-results-section">
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
                kind={kind}
                onShowPlaces={() => changeKind("places")}
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
                  <aside
                    className={`map-selection is-${selectedMapItem.resultType}`}
                    aria-live="polite"
                  >
                    <button
                      type="button"
                      className="map-selection-close"
                      onClick={() => setSelectedMapId("")}
                      aria-label={t(
                        "explore.map.closeSelection",
                        "Close selected place",
                      )}
                    >
                      <X size={18} aria-hidden="true" />
                    </button>
                    <div className="map-selection-media" aria-hidden="true">
                      {selectedMapItem.imageUrl ? (
                        <img src={selectedMapItem.imageUrl} alt="" />
                      ) : (
                        <MapPin size={23} />
                      )}
                    </div>
                    <div className="map-selection-copy">
                      <span className="map-selection-type">
                        {selectedMapItem.resultType === "business"
                          ? t(
                              "directory.map.bookableBusiness",
                              "Bookable business",
                            )
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
                      <Link
                        href={selectedMapItem.href}
                        className="btn btn-accent"
                      >
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
        :global(.explore-marketplace) {
          --max-w: 1280px;
          --content-pad: 28px;
        }

        .explore-page {
          padding-top: 34px;
          padding-bottom: 72px;
        }

        .explore-results-section,
        .explore-results-grid,
        .explore-map-layout {
          min-width: 0;
        }

        .explore-results-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
        }

        :global(.explore-business-card) {
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          align-items: stretch;
          min-height: 360px;
          overflow: hidden;
          padding: 0;
          color: var(--text);
          text-decoration: none;
          box-shadow: 0 3px 14px rgba(20, 24, 32, 0.04);
          transition:
            border-color 0.18s ease,
            box-shadow 0.18s ease,
            transform 0.18s ease;
        }

        :global(.explore-business-card:hover),
        :global(.explore-business-card:focus-visible) {
          border-color: var(--border-2);
          box-shadow: 0 12px 28px rgba(20, 24, 32, 0.09);
          transform: translateY(-2px);
        }

        :global(.explore-business-content) {
          display: grid;
          gap: 0.5rem;
          min-width: 0;
          padding: 0.95rem;
        }

        .explore-map-layout {
          display: grid;
          gap: 0.7rem;
        }

        .map-selection {
          position: relative;
          display: grid;
          grid-template-columns: 72px minmax(0, 1fr) auto;
          align-items: center;
          gap: 0.85rem;
          min-width: 0;
          padding: 0.75rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 10px 24px rgba(20, 24, 32, 0.07);
        }

        .map-selection-close {
          display: none;
          width: 44px;
          height: 44px;
          padding: 0;
          border: 1px solid var(--border);
          border-radius: 50%;
          background: var(--surface-2);
          color: var(--text);
          align-items: center;
          justify-content: center;
        }

        .map-selection-media {
          display: grid;
          width: 72px;
          height: 72px;
          place-items: center;
          overflow: hidden;
          border-radius: 6px;
          background: var(--success-dim);
          color: var(--success);
        }

        .map-selection-media img {
          width: 100%;
          height: 100%;
          object-fit: cover;
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
        }

        .map-selection.is-directory_place .map-selection-type {
          color: var(--success);
        }

        .map-selection.is-directory_place :global(.btn-accent) {
          background: var(--success);
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

        @media (max-width: 1320px) {
          .explore-results-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 740px) {
          .explore-results-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          :global(.explore-marketplace) {
            --content-pad: 20px;
          }

          .explore-page {
            padding-top: 22px;
            padding-bottom: 52px;
          }

          .explore-page.is-map-view {
            padding-top: 14px;
          }

          .is-map-view :global(.explore-hero-compact) {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 0.6rem;
          }

          .is-map-view :global(.explore-hero-compact > div) {
            min-width: 0;
          }

          .is-map-view :global(.explore-hero-compact .page-title) {
            margin: 0;
            font-size: 1.45rem;
          }

          .is-map-view :global(.explore-hero-compact .page-sub),
          .is-map-view :global(.explore-view-controls .kind-note) {
            display: none;
          }

          .is-map-view :global(.explore-view-controls) {
            margin-bottom: 0.65rem;
            padding-bottom: 0.65rem;
          }

          :global(.explore-business-card),
          :global(.explore-business-content) {
            min-width: 0;
            max-width: 100%;
          }

          :global(.explore-business-card) {
            grid-template-rows: auto minmax(0, 1fr);
            min-height: 330px;
          }

          :global(.explore-business-content) {
            padding: 0.85rem;
          }

          .map-selection {
            position: fixed;
            right: 0.75rem;
            bottom: calc(0.75rem + env(safe-area-inset-bottom));
            left: 0.75rem;
            z-index: 55;
            display: grid;
            grid-template-columns: 72px minmax(0, 1fr) 44px;
            gap: 0.65rem;
            max-height: min(52vh, 24rem);
            overflow-y: auto;
            padding: 0.85rem;
            border-color: var(--border);
            box-shadow: 0 1rem 2.5rem rgba(20, 24, 32, 0.22);
          }

          .map-selection-close {
            display: inline-flex;
            grid-column: 3;
            grid-row: 1;
          }

          .map-selection-media {
            grid-column: 1;
            grid-row: 1;
          }

          .map-selection-copy {
            grid-column: 2;
            grid-row: 1;
          }

          .map-selection :global(.btn) {
            grid-column: 1 / -1;
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
