import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  ArrowRight,
  List,
  LoaderCircle,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  X,
} from "lucide-react";
import AuthNav from "@/components/AuthNav";
import MarketplaceSurfaceStyles from "@/components/MarketplaceSurfaceStyles";
import ExploreBusinessCard from "@/components/explore/ExploreBusinessCard";
import ExploreDirectoryCard from "@/components/explore/ExploreDirectoryCard";
import ExploreDiscoveryMap from "@/components/explore/ExploreDiscoveryMap";
import ExploreEmptyState from "@/components/explore/ExploreEmptyState";
import ExploreFilters from "@/components/explore/ExploreFilters";
import ExploreHero from "@/components/explore/ExploreHero";
import ExploreMapResultList from "@/components/explore/ExploreMapResultList";
import type { ExploreSearchSuggestion } from "@/components/explore/ExploreSmartSearch";
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
import { recordSiteEvent } from "@/lib/siteAnalytics";
import { matchesDiscoverySearch } from "@/lib/discoverySearch";

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
const LIST_PAGE_SIZE = 12;

function queryText(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function positiveIntegerQuery(value: string | string[] | undefined) {
  const parsed = Number.parseInt(queryText(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
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
  const suggestionInventoryLocale = useRef("");

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
  const [searchDirectoryPlaces, setSearchDirectoryPlaces] = useState<
    DirectoryPlace[]
  >([]);
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
  const listPage = positiveIntegerQuery(router.query.page);

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
    if (!router.isReady) return;
    const hasServerFilter = Boolean(
      appliedFilters.query || appliedFilters.city || appliedFilters.category,
    );

    if (!hasServerFilter) {
      if (directoryPlaces.length > 0) {
        setSearchDirectoryPlaces(directoryPlaces);
        suggestionInventoryLocale.current = locale;
      }
      return;
    }

    if (
      searchDirectoryPlaces.length > 0 &&
      suggestionInventoryLocale.current === locale
    ) {
      return;
    }

    let cancelled = false;
    suggestionInventoryLocale.current = locale;
    const params = new URLSearchParams({ limit: "100", locale });
    void fetchWithTimeout(`/api/public/directory-places?${params}`)
      .then(({ response, payload }) => {
        if (cancelled || !response.ok) return;
        const places = (payload as { places?: DirectoryPlace[] } | null)
          ?.places;
        setSearchDirectoryPlaces(places || []);
      })
      .catch(() => {
        if (!cancelled) suggestionInventoryLocale.current = "";
      });

    return () => {
      cancelled = true;
    };
  }, [
    appliedFilters.category,
    appliedFilters.city,
    appliedFilters.query,
    directoryPlaces,
    locale,
    router.isReady,
    searchDirectoryPlaces.length,
  ]);

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
      return "#f7ebe6";
    }

    return `url("${business.image_url}")`;
  }

  const filteredBusinesses = useMemo(() => {
    const selectedDirectoryCategory = directoryCategoryFromLabel(
      appliedFilters.category,
      t,
    );
    return businesses.filter((business) => {
      const searchText = `${business.name || ""} ${
        business.description || ""
      } ${business.category || ""} ${business.city || ""} ${
        business.country || ""
      } ${business.address || ""}`;
      const matchesSearch = appliedFilters.query
        ? matchesDiscoverySearch(searchText, appliedFilters.query)
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
      } ${place.city || ""} ${place.region || ""}`;
      const matchesSearch = appliedFilters.query
        ? matchesDiscoverySearch(searchText, appliedFilters.query)
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

  const suggestionPlaces = useMemo(
    () =>
      searchDirectoryPlaces.map((place) => ({
        id: place.id,
        name: place.name,
        city: place.city || "",
        category: directoryCategoryLabel(place.categoryKey, t),
      })),
    [searchDirectoryPlaces, t],
  );

  const suggestionBusinesses = useMemo(
    () =>
      businesses.map((business) => ({
        id: business.id,
        name: business.name,
        city: business.city || "",
        category: business.category || t("common.business", "Business"),
      })),
    [businesses, t],
  );

  const suggestionCategories = useMemo(
    () =>
      DIRECTORY_CATEGORIES.map((categoryKey) => ({
        key: categoryKey,
        label: directoryCategoryLabel(categoryKey, t),
      })),
    [t],
  );

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

  const visibleListItems = useMemo(
    () => listItems.slice(0, listPage * LIST_PAGE_SIZE),
    [listItems, listPage],
  );

  const nextListPageHref = useMemo(
    () => ({
      pathname: "/explore",
      query: {
        ...router.query,
        page: String(listPage + 1),
      },
    }),
    [listPage, router.query],
  );

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
    recordSiteEvent("explore_search_submitted", {
      locale,
      metadata: {
        surface: "explore",
        selection: "filters",
        queryPresent: Boolean(search.trim()),
        city: city.trim() || null,
        category: category.trim() || null,
        kind,
        view,
      },
    });
    pushFilters({ query: search, city, category, sort: sortBy });
  }

  function selectSearchSuggestion(suggestion: ExploreSearchSuggestion) {
    recordSiteEvent("explore_suggestion_selected", {
      locale,
      entityType:
        suggestion.type === "directory_place"
          ? "directory_place"
          : suggestion.type === "business"
            ? "business"
            : undefined,
      entityId:
        suggestion.type === "directory_place" || suggestion.type === "business"
          ? suggestion.id
          : undefined,
      metadata: {
        surface: "explore",
        selection: suggestion.type,
        city: suggestion.city || null,
        category: suggestion.category || null,
        kind,
        view,
      },
    });
    if (suggestion.type === "directory_place") {
      void router.push(`/places/${encodeURIComponent(suggestion.id)}`);
      return;
    }
    if (suggestion.type === "business") {
      void router.push(`/explore/${encodeURIComponent(suggestion.id)}`);
      return;
    }
    if (suggestion.type === "city") {
      const nextCity = suggestion.city || suggestion.label;
      setSearch("");
      setCity(nextCity);
      pushFilters({ query: "", city: nextCity, category, sort: sortBy });
      return;
    }

    const nextCategory = suggestion.category || suggestion.label;
    setSearch("");
    setCategory(nextCategory);
    pushFilters({ query: "", city, category: nextCategory, sort: sortBy });
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
    recordSiteEvent("explore_view_changed", {
      locale,
      metadata: { surface: "explore", view: nextView, kind },
    });
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
    recordSiteEvent("explore_kind_changed", {
      locale,
      metadata: { surface: "explore", view, kind: nextKind },
    });
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
    selectMapResult(`directory:${placeId}`);
    changeView("map");
  }

  function selectMapResult(itemId: string) {
    setSelectedMapId(itemId);
    const item = mapItems.find((candidate) => candidate.id === itemId);
    if (!item) return;
    recordSiteEvent("explore_map_result_selected", {
      locale,
      entityType:
        item.resultType === "business" ? "business" : "directory_place",
      entityId: itemId.split(":")[1],
      metadata: {
        surface: "explore",
        resultType: item.resultType,
        view: "map",
        kind,
      },
    });
  }

  function useCurrentLocation() {
    recordSiteEvent("explore_location_requested", {
      locale,
      metadata: { surface: "explore", view, kind },
    });
    if (!navigator.geolocation) {
      setLocationState("unavailable");
      recordSiteEvent("explore_location_resolved", {
        locale,
        metadata: { surface: "explore", locationOutcome: "unavailable" },
      });
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
        recordSiteEvent("explore_location_resolved", {
          locale,
          metadata: { surface: "explore", locationOutcome: "active" },
        });
        setSortBy("distance");
        pushFilters({
          query: appliedFilters.query,
          city: appliedFilters.city,
          category: appliedFilters.category,
          sort: "distance",
        });
      },
      (locationError) => {
        const outcome = locationError.code === 1 ? "denied" : "unavailable";
        setLocationState(outcome);
        recordSiteEvent("explore_location_resolved", {
          locale,
          metadata: { surface: "explore", locationOutcome: outcome },
        });
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
          suggestionPlaces={suggestionPlaces}
          suggestionBusinesses={suggestionBusinesses}
          suggestionCategories={suggestionCategories}
          resultCount={listItems.length}
          locationActive={locationState === "active"}
          onSearchChange={setSearch}
          onSearchSuggestionSelect={selectSearchSuggestion}
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
                {visibleListItems.map((item) =>
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

            {!loading &&
              view === "list" &&
              visibleListItems.length < listItems.length && (
                <div className="explore-load-more">
                  <p aria-live="polite">
                    {t(
                      "explore.discovery.showingCount",
                      "Showing {shown} of {total}",
                    )
                      .replace("{shown}", String(visibleListItems.length))
                      .replace("{total}", String(listItems.length))}
                  </p>
                  <Link
                    href={nextListPageHref}
                    className="btn btn-ghost"
                    onClick={() =>
                      recordSiteEvent("explore_more_results", {
                        locale,
                        metadata: {
                          surface: "explore",
                          view: "list",
                          kind,
                        },
                      })
                    }
                  >
                    {t("explore.discovery.showMore", "Show more places")}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              )}

            {!loading && listItems.length > 0 && view === "map" && (
              <div className="explore-map-layout">
                <ExploreMapResultList
                  items={mapItems}
                  selectedId={selectedMapId}
                  onSelect={selectMapResult}
                />

                <div className="map-canvas-panel">
                  <ExploreDiscoveryMap
                    items={mapItems}
                    selectedId={selectedMapId}
                    userLocation={userLocation}
                    onSelect={selectMapResult}
                  />

                  <div className="map-mobile-controls">
                    <div
                      className="map-mobile-view-switch"
                      role="group"
                      aria-label={t("explore.view.label", "Result view")}
                    >
                      <button
                        type="button"
                        aria-pressed={false}
                        onClick={() => changeView("list")}
                      >
                        <List size={17} aria-hidden="true" />
                        {t("explore.view.list", "List")}
                      </button>
                      <button
                        type="button"
                        className="is-active"
                        aria-pressed={true}
                      >
                        <MapIcon size={17} aria-hidden="true" />
                        {t("explore.view.map", "Map")}
                      </button>
                    </div>

                    <button
                      type="button"
                      className={`map-mobile-location ${
                        locationState === "active" ? "is-active" : ""
                      }`}
                      onClick={
                        locationState === "active"
                          ? clearCurrentLocation
                          : useCurrentLocation
                      }
                      disabled={locationState === "loading"}
                      aria-label={
                        locationState === "loading"
                          ? t("explore.location.finding", "Finding you...")
                          : locationState === "active"
                            ? t("explore.location.clear", "Clear nearby")
                            : t("explore.location.use", "Use my location")
                      }
                      title={
                        locationState === "loading"
                          ? t("explore.location.finding", "Finding you...")
                          : locationState === "active"
                            ? t("explore.location.clear", "Clear nearby")
                            : t("explore.location.use", "Use my location")
                      }
                    >
                      {locationState === "loading" ? (
                        <LoaderCircle
                          className="location-spinner"
                          size={20}
                          aria-hidden="true"
                        />
                      ) : locationState === "active" ? (
                        <X size={20} aria-hidden="true" />
                      ) : (
                        <LocateFixed size={20} aria-hidden="true" />
                      )}
                    </button>
                  </div>

                  {selectedMapItem && (
                    <aside
                      className={`map-selection is-${selectedMapItem.resultType}`}
                      aria-live="polite"
                    >
                      <span
                        className="map-selection-handle"
                        aria-hidden="true"
                      />
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
              </div>
            )}
          </section>
        )}
      </section>

      <style jsx>{`
        :global(.explore-marketplace) {
          --max-w: 1480px;
          --content-pad: 28px;
        }

        .explore-page {
          padding-top: 34px;
          padding-bottom: 72px;
        }

        .explore-results-section,
        .explore-results-grid,
        .explore-map-layout,
        .map-canvas-panel {
          min-width: 0;
        }

        .is-map-view :global(.explore-hero-compact),
        .is-map-view :global(.explore-view-controls .kind-note) {
          display: none;
        }

        .explore-results-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
        }

        .explore-results-grid > :global(*) {
          content-visibility: auto;
          contain-intrinsic-size: 410px;
        }

        .explore-load-more {
          display: grid;
          justify-items: center;
          gap: 0.7rem;
          padding: 1.6rem 0 0.5rem;
          text-align: center;
        }

        .explore-load-more p {
          color: var(--text-muted);
          font-size: 0.85rem;
        }

        .explore-load-more :global(.btn) {
          min-width: 190px;
          border: 1px solid var(--border-2);
          background: #ffffff;
          color: var(--text);
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
          grid-template-columns: minmax(390px, 0.78fr) minmax(0, 1.22fr);
          gap: 0.8rem;
          height: min(70vh, 740px);
          min-height: 560px;
        }

        .map-canvas-panel {
          position: relative;
          min-height: 0;
        }

        .map-canvas-panel :global(.discovery-map-shell) {
          width: 100%;
          height: 100%;
          min-height: 0;
        }

        .map-mobile-controls {
          display: none;
        }

        .map-selection {
          position: absolute;
          right: 0.85rem;
          bottom: 0.85rem;
          left: 0.85rem;
          z-index: 8;
          display: grid;
          grid-template-columns: 80px minmax(0, 1fr);
          align-items: center;
          gap: 0.85rem;
          min-width: 0;
          max-width: min(460px, calc(100% - 1.7rem));
          padding: 0.75rem 3.85rem 0.75rem 0.75rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 16px 36px rgba(20, 24, 32, 0.2);
        }

        .map-selection-close {
          position: absolute;
          top: 0.72rem;
          right: 0.72rem;
          display: inline-flex;
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

        .map-selection-handle {
          display: none;
        }

        .map-selection-media {
          display: grid;
          width: 80px;
          height: 80px;
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
          overflow: hidden;
          color: var(--text-muted);
          font-size: 0.8rem;
          text-overflow: ellipsis;
          white-space: nowrap;
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
          grid-column: 1 / -1;
          color: var(--text-muted);
          font-size: 0.78rem;
          text-align: left;
        }

        .map-selection :global(.btn) {
          grid-column: 1 / -1;
          width: 100%;
          min-height: 44px;
          justify-content: center;
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

        @media (max-width: 1120px) {
          .explore-map-layout {
            grid-template-columns: minmax(0, 1fr);
            height: min(70vh, 700px);
            min-height: 540px;
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
            padding-bottom: 0;
          }

          .explore-load-more {
            padding-bottom: calc(var(--mobile-customer-dock-space, 0px) + 2rem);
          }

          .explore-results-grid > :global(*) {
            content-visibility: visible;
            contain-intrinsic-size: none;
          }

          .is-map-view :global(.explore-view-controls) {
            margin-bottom: 0.55rem;
            padding-bottom: 0.55rem;
            border-bottom: 0;
          }

          .is-map-view :global(.explore-view-controls .explore-view-segment),
          .is-map-view :global(.explore-view-controls .location-button) {
            display: none;
          }

          .is-map-view .explore-results-section {
            margin-right: calc(var(--content-pad) * -1);
            margin-left: calc(var(--content-pad) * -1);
          }

          .explore-map-layout {
            height: max(540px, calc(100dvh - 250px));
            min-height: 540px;
            gap: 0;
          }

          .map-canvas-panel :global(.discovery-map-shell) {
            border-width: 1px 0 0;
            border-radius: 0;
          }

          .map-mobile-controls {
            position: absolute;
            top: 0.75rem;
            right: 0.75rem;
            left: 0.75rem;
            z-index: 8;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.6rem;
            pointer-events: none;
          }

          .map-mobile-view-switch {
            display: grid;
            grid-template-columns: 1fr 1fr;
            overflow: hidden;
            padding: 3px;
            border: 1px solid rgba(17, 24, 39, 0.14);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.96);
            box-shadow: 0 8px 22px rgba(17, 24, 39, 0.15);
            pointer-events: auto;
          }

          .map-mobile-view-switch button {
            display: inline-flex;
            min-width: 84px;
            min-height: 44px;
            align-items: center;
            justify-content: center;
            gap: 0.4rem;
            padding: 0.45rem 0.65rem;
            border: 0;
            border-radius: 6px;
            background: transparent;
            color: var(--text-muted);
            font: inherit;
            font-size: 0.82rem;
            font-weight: 800;
          }

          .map-mobile-view-switch button.is-active {
            background: var(--text);
            color: #ffffff;
          }

          .map-mobile-location {
            position: absolute;
            right: 0;
            display: inline-flex;
            width: 48px;
            height: 48px;
            align-items: center;
            justify-content: center;
            padding: 0;
            border: 1px solid rgba(17, 24, 39, 0.14);
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.96);
            box-shadow: 0 8px 22px rgba(17, 24, 39, 0.15);
            color: var(--text);
            pointer-events: auto;
          }

          .map-mobile-location.is-active {
            background: var(--text);
            color: #ffffff;
          }

          .map-canvas-panel :global(.discovery-map .mapboxgl-ctrl-top-right) {
            top: 4.4rem;
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
            right: 0;
            bottom: calc(var(--mobile-customer-dock-space, 0px) + 1px);
            left: 0;
            z-index: 55;
            display: grid;
            grid-template-columns: 104px minmax(0, 1fr);
            gap: 0.75rem;
            max-width: none;
            max-height: min(58vh, 27rem);
            overflow-y: auto;
            padding: 1.2rem 1rem calc(1rem + env(safe-area-inset-bottom));
            border: 0;
            border-top: 1px solid var(--border);
            border-radius: 8px 8px 0 0;
            box-shadow: 0 -1rem 2.5rem rgba(20, 24, 32, 0.2);
          }

          .map-selection-close {
            top: 1rem;
            right: 0.85rem;
          }

          .map-selection-handle {
            position: absolute;
            top: 0.45rem;
            left: 50%;
            display: block;
            width: 2.4rem;
            height: 4px;
            transform: translateX(-50%);
            border-radius: 999px;
            background: var(--border-2);
          }

          .map-selection-media {
            width: 104px;
            height: 104px;
          }

          .map-selection-copy {
            align-self: center;
            padding-right: 2.8rem;
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

        @media (max-width: 400px) {
          .map-selection {
            grid-template-columns: 88px minmax(0, 1fr);
          }

          .map-selection-media {
            width: 88px;
            height: 88px;
          }
        }
      `}</style>
    </main>
  );
}
