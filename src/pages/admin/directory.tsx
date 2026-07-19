import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AuthNav from "@/components/AuthNav";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/useI18n";

type DirectoryStatus =
  | "needs_review"
  | "active"
  | "hidden"
  | "closed"
  | "duplicate";

type DirectoryAction =
  | "approve"
  | "hide"
  | "close"
  | "return_to_review"
  | "mark_duplicate";

type DirectoryReview = {
  id: string;
  action: DirectoryAction;
  from_status: DirectoryStatus;
  to_status: DirectoryStatus;
  notes?: string | null;
  reviewer_id: string;
  created_at: string;
};

type DirectoryPlace = {
  id: string;
  source: string;
  source_place_id: string;
  source_version?: string | null;
  name: string;
  category_key: string;
  source_category?: string | null;
  source_category_ids?: string[] | null;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country_code: string;
  postcode?: string | null;
  phone?: string | null;
  website?: string | null;
  email?: string | null;
  social_urls?: string[] | null;
  source_confidence?: number | null;
  source_operating_status?: string | null;
  source_updated_at?: string | null;
  source_attribution?: {
    provider?: string;
    release?: string;
    sources?: Array<{ dataset?: string }>;
  } | null;
  source_fingerprint?: string | null;
  listing_status: DirectoryStatus;
  claim_status: string;
  linked_business_id?: string | null;
  duplicate_of_place_id?: string | null;
  first_imported_at: string;
  last_imported_at: string;
  latestReview?: DirectoryReview | null;
};

type CoverageItem = {
  key: string;
  approved: number;
  needsReview: number;
};

type DirectoryCoverage = {
  available: boolean;
  cities: CoverageItem[];
  categories: CoverageItem[];
};

type DirectoryResponse = {
  places: DirectoryPlace[];
  counts: Record<DirectoryStatus, number>;
  coverage: DirectoryCoverage;
  pagination: { total: number; limit: number; offset: number };
};

type DirectoryFilterOverrides = {
  category?: string;
  city?: string;
  search?: string;
};

const STATUSES: DirectoryStatus[] = [
  "needs_review",
  "active",
  "hidden",
  "closed",
  "duplicate",
];

const CATEGORIES = [
  "beauty_grooming",
  "dental_health",
  "wellness_fitness",
  "events",
  "learning_lessons",
  "tours_activities",
  "rentals",
  "attractions",
  "food_drink",
  "lodging",
];

function formatDate(value: string | null | undefined, locale: "en" | "sq") {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale === "sq" ? "sq-AL" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function safeWebsite(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export default function AdminDirectoryPage() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [adminReady, setAdminReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [places, setPlaces] = useState<DirectoryPlace[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState<DirectoryStatus>("needs_review");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState<Record<DirectoryStatus, number>>({
    needs_review: 0,
    active: 0,
    hidden: 0,
    closed: 0,
    duplicate: 0,
  });
  const [coverage, setCoverage] = useState<DirectoryCoverage>({
    available: false,
    cities: [],
    categories: [],
  });
  const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0 });
  const [pendingAction, setPendingAction] = useState<DirectoryAction | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [duplicateOfPlaceId, setDuplicateOfPlaceId] = useState("");
  const [mapImage, setMapImage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedPlace = useMemo(
    () => places.find((place) => place.id === selectedId) || null,
    [places, selectedId],
  );

  useEffect(() => {
    if (!router.isReady) return;
    let cancelled = false;

    async function authenticate() {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login?redirectTo=/admin/directory");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, is_admin")
        .eq("id", session.user.id)
        .maybeSingle<{ id: string; is_admin?: boolean | null }>();

      if (cancelled) return;
      if (profileError || !profile?.is_admin) {
        setError(t("admin.directory.adminOnly", "Admin access is required."));
        setLoading(false);
        return;
      }

      setAdminReady(true);
      await loadDirectory(0, session.access_token);
    }

    authenticate();
    return () => {
      cancelled = true;
    };
    // Filters are applied explicitly from the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  function statusLabel(value: DirectoryStatus) {
    const labels: Record<DirectoryStatus, string> = {
      needs_review: t("admin.directory.status.needsReview", "Needs review"),
      active: t("admin.directory.status.active", "Approved"),
      hidden: t("admin.directory.status.hidden", "Hidden"),
      closed: t("admin.directory.status.closed", "Closed"),
      duplicate: t("admin.directory.status.duplicate", "Duplicate"),
    };
    return labels[value];
  }

  function categoryLabel(value: string) {
    return t(
      `admin.directory.category.${value}`,
      value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
    );
  }

  function actionLabel(value: DirectoryAction) {
    const labels: Record<DirectoryAction, string> = {
      approve: t("admin.directory.action.approve", "Approve for discovery"),
      hide: t("admin.directory.action.hide", "Hide place"),
      close: t("admin.directory.action.close", "Mark closed"),
      return_to_review: t("admin.directory.action.review", "Return to review"),
      mark_duplicate: t("admin.directory.action.duplicate", "Mark duplicate"),
    };
    return labels[value];
  }

  function claimStatusLabel(value: string) {
    const labels: Record<string, string> = {
      unclaimed: t("admin.directory.claim.unclaimed", "Unclaimed"),
      claimed: t("admin.directory.claim.claimed", "Claimed"),
      disputed: t("admin.directory.claim.disputed", "Disputed"),
    };
    return labels[value] || value.replace(/_/g, " ");
  }

  function operatingStatusLabel(value?: string | null) {
    if (!value) return "—";
    const labels: Record<string, string> = {
      operating: t("admin.directory.operating.operating", "Operating"),
      temporarily_closed: t(
        "admin.directory.operating.temporarilyClosed",
        "Temporarily closed",
      ),
      permanently_closed: t(
        "admin.directory.operating.permanentlyClosed",
        "Permanently closed",
      ),
    };
    return labels[value] || value.replace(/_/g, " ");
  }

  async function currentToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/login?redirectTo=/admin/directory");
      return null;
    }
    return session.access_token;
  }

  async function loadDirectory(
    nextOffset = 0,
    suppliedToken?: string,
    statusOverride?: DirectoryStatus,
    preserveSuccess = false,
    filterOverrides: DirectoryFilterOverrides = {},
  ) {
    setLoading(true);
    setError("");
    if (!preserveSuccess) setSuccess("");
    const token = suppliedToken || (await currentToken());
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams({
        status: statusOverride || status,
        limit: String(pagination.limit),
        offset: String(nextOffset),
      });
      const appliedCategory = filterOverrides.category ?? category;
      const appliedCity = filterOverrides.city ?? city;
      const appliedSearch = filterOverrides.search ?? search;
      if (appliedCategory) params.set("category", appliedCategory);
      if (appliedCity.trim()) params.set("city", appliedCity.trim());
      if (appliedSearch.trim()) params.set("search", appliedSearch.trim());

      const response = await fetch(`/api/admin/directory-places?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Directory could not be loaded.");

      const next = payload as DirectoryResponse;
      setPlaces(next.places);
      setCounts(next.counts);
      setCoverage(next.coverage || { available: false, cities: [], categories: [] });
      setPagination(next.pagination);
      setSelectedId((current) =>
        next.places.some((place) => place.id === current)
          ? current
          : next.places[0]?.id || "",
      );
      setMapImage("");
      setPendingAction(null);
    } catch (loadError) {
      setPlaces([]);
      setSelectedId("");
      setError(
        loadError instanceof Error
          ? loadError.message
          : t("admin.directory.error.load", "Directory could not be loaded."),
      );
    } finally {
      setLoading(false);
    }
  }

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    loadDirectory(0);
  }

  function openCoverage(
    item: CoverageItem,
    filterType: "city" | "category",
  ) {
    const nextStatus: DirectoryStatus =
      item.needsReview > 0 ? "needs_review" : "active";
    const nextCategory = filterType === "category" ? item.key : "";
    const nextCity = filterType === "city" ? item.key : "";

    setStatus(nextStatus);
    setCategory(nextCategory);
    setCity(nextCity);
    setSearch("");
    loadDirectory(0, undefined, nextStatus, false, {
      category: nextCategory,
      city: nextCity,
      search: "",
    });
  }

  function choosePlace(placeId: string) {
    setSelectedId(placeId);
    setPendingAction(null);
    setReviewNotes("");
    setDuplicateOfPlaceId("");
    setMapImage("");
    setError("");
    setSuccess("");
  }

  function beginAction(action: DirectoryAction) {
    setPendingAction(action);
    setReviewNotes("");
    setDuplicateOfPlaceId("");
    setError("");
    setSuccess("");
  }

  async function submitAction() {
    if (!selectedPlace || !pendingAction) return;
    setError("");
    setSuccess("");
    const token = await currentToken();
    if (!token) return;
    setSaving(true);

    try {
      const response = await fetch("/api/admin/directory-places", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          placeId: selectedPlace.id,
          action: pendingAction,
          notes: reviewNotes,
          duplicateOfPlaceId,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Review could not be saved.");

      setSuccess(
        t("admin.directory.success.review", "Review saved. Public results remain controlled by status."),
      );
      setPendingAction(null);
      setReviewNotes("");
      setDuplicateOfPlaceId("");
      await loadDirectory(pagination.offset, token, undefined, true);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : t("admin.directory.error.save", "Review could not be saved."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function loadMapPreview() {
    if (!selectedPlace) return;
    setError("");
    const token = await currentToken();
    if (!token) return;
    setMapLoading(true);

    try {
      const response = await fetch("/api/admin/directory-places", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ placeId: selectedPlace.id, action: "map_preview" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Map preview is unavailable.");
      setMapImage(payload.mapImage || "");
    } catch (mapError) {
      setError(
        mapError instanceof Error
          ? mapError.message
          : t("admin.directory.error.map", "Map preview is unavailable."),
      );
    } finally {
      setMapLoading(false);
    }
  }

  const sourceDatasets = useMemo(() => {
    const sourceRows = selectedPlace?.source_attribution?.sources || [];
    return Array.from(
      new Set(
        sourceRows.flatMap((source) =>
          source.dataset ? [source.dataset] : [],
        ),
      ),
    );
  }, [selectedPlace]);

  if (!adminReady) {
    return (
      <main>
        <AuthNav />
        <section className="container directory-state">
          <div className="card">
            <h1>
              {loading
                ? t("common.loadingAccount", "Checking account...")
                : t("admin.directory.adminOnly", "Admin access is required.")}
            </h1>
            {!loading && error && <p className="muted">{error}</p>}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <AuthNav />
      <section className="container directory-page">
        <header className="directory-header">
          <div>
            <p className="small directory-kicker">
              {t("admin.directory.kicker", "Marketplace data")}
            </p>
            <h1 className="page-title">{t("admin.directory.title", "Directory review")}</h1>
            <p className="page-sub">
              {t(
                "admin.directory.subtitle",
                "Review imported Albania places before they can appear in customer discovery.",
              )}
            </p>
          </div>
          <div className="directory-header-actions">
            <Link href="/admin" className="btn btn-ghost">
              {t("admin.directory.overview", "Operator overview")}
            </Link>
            <button type="button" className="btn btn-ghost" onClick={() => loadDirectory(0)}>
              {t("admin.directory.refresh", "Refresh")}
            </button>
          </div>
        </header>

        <div className="directory-safety">
          <strong>{t("admin.directory.safetyTitle", "Approval is the public gate")}</strong>
          <span>
            {t(
              "admin.directory.safetyBody",
              "Imported places start private. Approval makes only the directory record discoverable; it does not enable booking or claim ownership.",
            )}
          </span>
        </div>

        <div className="directory-counts" aria-label={t("admin.directory.statusSummary", "Directory status summary")}>
          {STATUSES.map((value) => (
            <button
              key={value}
              type="button"
              className={status === value ? "directory-count is-active" : "directory-count"}
              onClick={() => {
                setStatus(value);
                loadDirectory(0, undefined, value);
              }}
            >
              <strong>{counts[value]}</strong>
              <span>{statusLabel(value)}</span>
            </button>
          ))}
        </div>

        <section className="directory-coverage" aria-labelledby="directory-coverage-title">
          <div className="directory-coverage-heading">
            <div>
              <p className="small directory-kicker">
                {t("admin.directory.coverage.kicker", "Launch curation")}
              </p>
              <h2 id="directory-coverage-title">
                {t("admin.directory.coverage.title", "Launch coverage")}
              </h2>
            </div>
            <p className="small muted">
              {t(
                "admin.directory.coverage.body",
                "Open a city or category to work through its private review queue before approving anything for discovery.",
              )}
            </p>
          </div>

          {coverage.available ? (
            <div className="directory-coverage-groups">
              {(
                [
                  {
                    key: "cities",
                    title: t("admin.directory.coverage.cities", "Priority cities"),
                    items: coverage.cities,
                  },
                  {
                    key: "categories",
                    title: t("admin.directory.coverage.categories", "Categories"),
                    items: coverage.categories,
                  },
                ] as const
              ).map((group) => (
                <div key={group.key} className="directory-coverage-group">
                  <h3>{group.title}</h3>
                  <div className="directory-coverage-rows">
                    {group.items.map((item) => {
                      const label =
                        group.key === "categories" ? categoryLabel(item.key) : item.key;
                      const isEmpty = item.approved === 0 && item.needsReview === 0;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          className="directory-coverage-row"
                          disabled={isEmpty || loading}
                          onClick={() =>
                            openCoverage(
                              item,
                              group.key === "categories" ? "category" : "city",
                            )
                          }
                          aria-label={`${label}. ${item.approved} ${t(
                            "admin.directory.coverage.approved",
                            "approved",
                          )}, ${item.needsReview} ${t(
                            "admin.directory.coverage.awaiting",
                            "awaiting review",
                          )}.`}
                        >
                          <span>{label}</span>
                          {isEmpty ? (
                            <small>
                              {t("admin.directory.coverage.empty", "No candidates")}
                            </small>
                          ) : (
                            <span className="directory-coverage-totals">
                              <small className="is-approved">
                                {item.approved}{" "}
                                {t("admin.directory.coverage.approvedShort", "approved")}
                              </small>
                              <small className="is-review">
                                {item.needsReview}{" "}
                                {t("admin.directory.coverage.review", "to review")}
                              </small>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="directory-coverage-unavailable">
              {t(
                "admin.directory.coverage.unavailable",
                "Run SQL 26 to enable exact launch coverage totals. The review queue remains available.",
              )}
            </p>
          )}
        </section>

        <form className="directory-filters" onSubmit={applyFilters}>
          <label>
            <span>{t("admin.directory.filter.search", "Place name")}</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("admin.directory.filter.searchPlaceholder", "Search names")}
            />
          </label>
          <label>
            <span>{t("admin.directory.filter.category", "Category")}</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">{t("admin.directory.filter.allCategories", "All categories")}</option>
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {categoryLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("admin.directory.filter.city", "City")}</span>
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder={t("admin.directory.filter.cityPlaceholder", "Exact city")}
            />
          </label>
          <button className="btn btn-accent" type="submit">
            {t("admin.directory.filter.apply", "Apply filters")}
          </button>
        </form>

        {error && <div className="directory-message is-error">{error}</div>}
        {success && <div className="directory-message is-success">{success}</div>}

        <div className="directory-workspace">
          <section className="directory-list card">
            <div className="directory-section-heading">
              <div>
                <h2>{statusLabel(status)}</h2>
                <p className="small muted">
                  {pagination.total} {t("admin.directory.results", "results")}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="directory-empty">{t("admin.directory.loading", "Loading directory places...")}</div>
            ) : places.length === 0 ? (
              <div className="directory-empty">
                <strong>{t("admin.directory.emptyTitle", "No places in this view")}</strong>
                <span>{t("admin.directory.emptyBody", "Change the status or filters to review another group.")}</span>
              </div>
            ) : (
              <div className="directory-rows">
                {places.map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    className={selectedId === place.id ? "directory-row is-selected" : "directory-row"}
                    onClick={() => choosePlace(place.id)}
                  >
                    <span className="directory-row-main">
                      <strong>{place.name}</strong>
                      <span>
                        {[categoryLabel(place.category_key), place.city || place.region]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className={`directory-pill is-${place.listing_status}`}>
                      {statusLabel(place.listing_status)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="directory-pagination">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={pagination.offset === 0 || loading}
                onClick={() => loadDirectory(Math.max(0, pagination.offset - pagination.limit))}
              >
                {t("admin.directory.previous", "Previous")}
              </button>
              <span className="small muted">
                {pagination.total === 0 ? 0 : pagination.offset + 1}–
                {Math.min(pagination.offset + pagination.limit, pagination.total)}
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={pagination.offset + pagination.limit >= pagination.total || loading}
                onClick={() => loadDirectory(pagination.offset + pagination.limit)}
              >
                {t("admin.directory.next", "Next")}
              </button>
            </div>
          </section>

          <section className="directory-detail card">
            {!selectedPlace ? (
              <div className="directory-empty">
                <strong>{t("admin.directory.selectTitle", "Select a place")}</strong>
                <span>{t("admin.directory.selectBody", "Choose a row to inspect source data and make a review decision.")}</span>
              </div>
            ) : (
              <>
                <div className="directory-detail-header">
                  <div>
                    <div className="directory-title-line">
                      <h2>{selectedPlace.name}</h2>
                      <span className={`directory-pill is-${selectedPlace.listing_status}`}>
                        {statusLabel(selectedPlace.listing_status)}
                      </span>
                    </div>
                    <p className="muted">
                      {[categoryLabel(selectedPlace.category_key), selectedPlace.city, selectedPlace.country_code]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <button type="button" className="btn btn-ghost" onClick={loadMapPreview} disabled={mapLoading}>
                    {mapLoading
                      ? t("admin.directory.mapLoading", "Loading map...")
                      : t("admin.directory.map", "Preview map")}
                  </button>
                </div>

                {mapImage && (
                  <div className="directory-map">
                    <img src={mapImage} alt={t("admin.directory.mapAlt", "Map preview for this directory place")} />
                  </div>
                )}

                <dl className="directory-facts">
                  <div>
                    <dt>{t("admin.directory.address", "Address")}</dt>
                    <dd>
                      {[selectedPlace.address, selectedPlace.city, selectedPlace.region, selectedPlace.postcode]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("admin.directory.contact", "Source contact")}</dt>
                    <dd>{[selectedPlace.phone, selectedPlace.email].filter(Boolean).join(" · ") || "—"}</dd>
                  </div>
                  <div>
                    <dt>{t("admin.directory.website", "Website")}</dt>
                    <dd>
                      {safeWebsite(selectedPlace.website) ? (
                        <a href={safeWebsite(selectedPlace.website) || "#"} target="_blank" rel="noreferrer">
                          {selectedPlace.website}
                        </a>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("admin.directory.sourceCategory", "Source category")}</dt>
                    <dd>{selectedPlace.source_category || "—"}</dd>
                  </div>
                  <div>
                    <dt>{t("admin.directory.source", "Source")}</dt>
                    <dd>
                      {selectedPlace.source} · {selectedPlace.source_version || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("admin.directory.confidence", "Source confidence")}</dt>
                    <dd>
                      {typeof selectedPlace.source_confidence === "number"
                        ? `${Math.round(selectedPlace.source_confidence * 100)}%`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("admin.directory.operatingStatus", "Source operating status")}</dt>
                    <dd>{operatingStatusLabel(selectedPlace.source_operating_status)}</dd>
                  </div>
                  <div>
                    <dt>{t("admin.directory.claimStatus", "Claim status")}</dt>
                    <dd>{claimStatusLabel(selectedPlace.claim_status)}</dd>
                  </div>
                  <div>
                    <dt>{t("admin.directory.sourceUpdated", "Source updated")}</dt>
                    <dd>{formatDate(selectedPlace.source_updated_at, locale)}</dd>
                  </div>
                  <div>
                    <dt>{t("admin.directory.lastImported", "Last imported")}</dt>
                    <dd>{formatDate(selectedPlace.last_imported_at, locale)}</dd>
                  </div>
                </dl>

                {sourceDatasets.length > 0 && (
                  <div className="directory-source-note">
                    <strong>{t("admin.directory.provenance", "Source provenance")}</strong>
                    <span>{sourceDatasets.join(" · ")}</span>
                  </div>
                )}

                {selectedPlace.latestReview && (
                  <div className="directory-review-history">
                    <strong>{t("admin.directory.latestReview", "Latest review")}</strong>
                    <span>
                      {actionLabel(selectedPlace.latestReview.action)} · {formatDate(selectedPlace.latestReview.created_at, locale)}
                    </span>
                    {selectedPlace.latestReview.notes && <p>{selectedPlace.latestReview.notes}</p>}
                  </div>
                )}

                <div className="directory-actions">
                  {selectedPlace.listing_status !== "active" && (
                    <button type="button" className="btn btn-accent" onClick={() => beginAction("approve")}>
                      {actionLabel("approve")}
                    </button>
                  )}
                  {selectedPlace.listing_status !== "needs_review" && (
                    <button type="button" className="btn btn-ghost" onClick={() => beginAction("return_to_review")}>
                      {actionLabel("return_to_review")}
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost" onClick={() => beginAction("hide")}>
                    {actionLabel("hide")}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => beginAction("close")}>
                    {actionLabel("close")}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => beginAction("mark_duplicate")}>
                    {actionLabel("mark_duplicate")}
                  </button>
                </div>

                {pendingAction && (
                  <div className="directory-confirmation">
                    <div>
                      <p className="small muted">{t("admin.directory.reviewDecision", "Review decision")}</p>
                      <h3>{actionLabel(pendingAction)}</h3>
                    </div>
                    {pendingAction === "mark_duplicate" && (
                      <label>
                        <span>{t("admin.directory.canonicalId", "Canonical place ID")}</span>
                        <input
                          value={duplicateOfPlaceId}
                          onChange={(event) => setDuplicateOfPlaceId(event.target.value)}
                          placeholder="00000000-0000-0000-0000-000000000000"
                        />
                      </label>
                    )}
                    <label>
                      <span>
                        {t(
                          pendingAction === "approve" || pendingAction === "return_to_review"
                            ? "admin.directory.notesOptional"
                            : "admin.directory.notesRequired",
                          pendingAction === "approve" || pendingAction === "return_to_review"
                            ? "Review note (optional)"
                            : "Review note",
                        )}
                      </span>
                      <textarea
                        rows={3}
                        value={reviewNotes}
                        onChange={(event) => setReviewNotes(event.target.value)}
                        placeholder={t("admin.directory.notesPlaceholder", "Record what you checked or why this state is appropriate.")}
                      />
                    </label>
                    <div className="directory-confirm-actions">
                      <button type="button" className="btn btn-accent" onClick={submitAction} disabled={saving}>
                        {saving ? t("admin.directory.saving", "Saving...") : t("admin.directory.confirm", "Confirm decision")}
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => setPendingAction(null)} disabled={saving}>
                        {t("common.cancel", "Cancel")}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </section>

      <style jsx>{`
        .directory-page {
          padding-top: 2.5rem;
          padding-bottom: 4.5rem;
        }

        .directory-state {
          padding-top: 3rem;
        }

        .directory-header,
        .directory-detail-header,
        .directory-section-heading,
        .directory-title-line,
        .directory-confirm-actions,
        .directory-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }

        .directory-header {
          align-items: flex-start;
        }

        .directory-kicker {
          color: var(--accent);
          font-weight: 700;
        }

        .directory-header-actions,
        .directory-actions {
          display: flex;
          gap: 0.65rem;
          flex-wrap: wrap;
        }

        .directory-safety {
          margin-top: 1.25rem;
          padding: 0.9rem 1rem;
          border: 1px solid rgba(255, 190, 11, 0.3);
          border-radius: 8px;
          background: var(--warning-dim);
          display: flex;
          gap: 0.55rem 1rem;
          flex-wrap: wrap;
        }

        .directory-safety span {
          color: var(--text-muted);
        }

        .directory-counts {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 0.65rem;
          margin-top: 1rem;
        }

        .directory-count {
          min-width: 0;
          min-height: 70px;
          padding: 0.75rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
          color: var(--text);
          display: grid;
          justify-items: start;
          text-align: left;
        }

        .directory-count strong {
          font-size: 1.2rem;
        }

        .directory-count span {
          color: var(--text-muted);
          line-height: 1.2;
        }

        .directory-count.is-active {
          border-color: var(--accent);
          background: var(--accent-dim);
        }

        .directory-coverage {
          margin-top: 1rem;
          padding: 1rem 0;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }

        .directory-coverage-heading {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 1rem 2rem;
        }

        .directory-coverage-heading h2,
        .directory-coverage-group h3 {
          margin: 0;
        }

        .directory-coverage-heading > p {
          max-width: 620px;
        }

        .directory-coverage-groups {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1.5rem;
          margin-top: 0.85rem;
        }

        .directory-coverage-group h3 {
          margin-bottom: 0.35rem;
          color: var(--text-muted);
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0;
        }

        .directory-coverage-rows {
          display: grid;
        }

        .directory-coverage-row {
          width: 100%;
          min-width: 0;
          min-height: 38px;
          padding: 0.4rem 0.25rem;
          border: 0;
          border-bottom: 1px solid var(--border);
          border-radius: 0;
          background: transparent;
          color: var(--text);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          text-align: left;
        }

        .directory-coverage-row:not(:disabled):hover {
          background: var(--surface-2);
        }

        .directory-coverage-row:disabled {
          cursor: default;
          color: var(--text-muted);
          opacity: 0.7;
        }

        .directory-coverage-row > span:first-child {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .directory-coverage-totals {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          gap: 0.45rem;
        }

        .directory-coverage-row small {
          color: var(--text-muted);
          white-space: nowrap;
        }

        .directory-coverage-row .is-approved {
          color: var(--success);
        }

        .directory-coverage-row .is-review {
          color: var(--warning);
        }

        .directory-coverage-unavailable {
          margin-top: 0.85rem;
          color: var(--text-muted);
        }

        .directory-filters {
          margin-top: 1rem;
          padding: 0.9rem;
          display: grid;
          grid-template-columns: minmax(180px, 1.2fr) minmax(170px, 1fr) minmax(150px, 0.8fr) auto;
          gap: 0.75rem;
          align-items: end;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
        }

        .directory-filters label,
        .directory-confirmation label {
          display: grid;
          gap: 0.35rem;
          color: var(--text-muted);
          font-size: 0.82rem;
        }

        .directory-message {
          margin-top: 1rem;
          padding: 0.8rem 1rem;
          border-radius: 8px;
        }

        .directory-message.is-error {
          border: 1px solid rgba(255, 77, 109, 0.4);
          background: var(--danger-dim);
          color: var(--danger);
        }

        .directory-message.is-success {
          border: 1px solid rgba(6, 214, 160, 0.35);
          background: var(--success-dim);
          color: var(--success);
        }

        .directory-workspace {
          display: grid;
          grid-template-columns: minmax(300px, 0.78fr) minmax(0, 1.22fr);
          gap: 1rem;
          margin-top: 1rem;
          align-items: start;
        }

        .directory-list,
        .directory-detail {
          padding: 1rem;
          border-radius: 8px;
        }

        .directory-detail {
          position: sticky;
          top: 1rem;
          display: grid;
          gap: 1rem;
        }

        .directory-rows {
          display: grid;
          gap: 0.35rem;
          margin-top: 0.75rem;
        }

        .directory-row {
          width: 100%;
          min-width: 0;
          padding: 0.75rem;
          border: 1px solid transparent;
          border-radius: 8px;
          background: transparent;
          color: var(--text);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          text-align: left;
        }

        .directory-row:hover,
        .directory-row.is-selected {
          border-color: var(--border-2);
          background: var(--surface-2);
        }

        .directory-row.is-selected {
          border-color: rgba(255, 107, 53, 0.5);
        }

        .directory-row-main {
          min-width: 0;
          display: grid;
        }

        .directory-row-main strong,
        .directory-row-main span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .directory-row-main span {
          color: var(--text-muted);
          font-size: 0.8rem;
        }

        .directory-pill {
          flex: 0 0 auto;
          padding: 0.25rem 0.5rem;
          border-radius: 999px;
          border: 1px solid var(--border);
          font-size: 0.72rem;
          color: var(--text-muted);
        }

        .directory-pill.is-active {
          color: var(--success);
          border-color: rgba(6, 214, 160, 0.35);
        }

        .directory-pill.is-needs_review {
          color: var(--warning);
          border-color: rgba(255, 190, 11, 0.35);
        }

        .directory-pill.is-closed,
        .directory-pill.is-duplicate {
          color: var(--danger);
          border-color: rgba(255, 77, 109, 0.35);
        }

        .directory-pagination {
          margin-top: 0.85rem;
          padding-top: 0.85rem;
          border-top: 1px solid var(--border);
        }

        .directory-empty {
          min-height: 150px;
          display: grid;
          place-content: center;
          gap: 0.35rem;
          text-align: center;
          color: var(--text-muted);
        }

        .directory-title-line {
          justify-content: flex-start;
          flex-wrap: wrap;
        }

        .directory-map {
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-2);
        }

        .directory-map img {
          width: 100%;
          aspect-ratio: 16 / 6;
          object-fit: cover;
        }

        .directory-facts {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          border-top: 1px solid var(--border);
          border-left: 1px solid var(--border);
        }

        .directory-facts div {
          min-width: 0;
          padding: 0.7rem;
          border-right: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }

        .directory-facts dt {
          color: var(--text-muted);
          font-size: 0.75rem;
        }

        .directory-facts dd {
          margin-top: 0.2rem;
          overflow-wrap: anywhere;
        }

        .directory-facts a {
          color: var(--accent);
        }

        .directory-source-note,
        .directory-review-history {
          padding: 0.75rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          display: grid;
          gap: 0.25rem;
        }

        .directory-source-note span,
        .directory-review-history span,
        .directory-review-history p {
          color: var(--text-muted);
          overflow-wrap: anywhere;
        }

        .directory-confirmation {
          padding: 0.9rem;
          border: 1px solid rgba(255, 107, 53, 0.35);
          border-radius: 8px;
          background: var(--accent-dim);
          display: grid;
          gap: 0.75rem;
        }

        .directory-confirm-actions {
          justify-content: flex-start;
        }

        @media (max-width: 920px) {
          .directory-counts {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .directory-filters {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .directory-workspace {
            grid-template-columns: 1fr;
          }

          .directory-detail {
            position: static;
          }
        }

        @media (max-width: 620px) {
          .directory-page {
            padding-top: 1.5rem;
          }

          .directory-header,
          .directory-detail-header,
          .directory-coverage-heading {
            display: grid;
          }

          .directory-header-actions,
          .directory-actions {
            width: 100%;
          }

          .directory-header-actions :global(.btn),
          .directory-actions :global(.btn) {
            flex: 1 1 auto;
          }

          .directory-counts {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .directory-filters,
          .directory-facts,
          .directory-coverage-groups {
            grid-template-columns: 1fr;
          }

          .directory-coverage-groups {
            gap: 1rem;
          }

          .directory-row {
            align-items: flex-start;
          }

          .directory-row-main strong,
          .directory-row-main span {
            white-space: normal;
          }
        }
      `}</style>
    </main>
  );
}
