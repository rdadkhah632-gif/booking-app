import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AuthNav from "@/components/AuthNav";
import { uploadMirebookImage } from "@/lib/imageUpload";
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
  editorial_description_en?: string | null;
  editorial_description_sq?: string | null;
  image_url?: string | null;
  image_alt_en?: string | null;
  image_alt_sq?: string | null;
  image_attribution_label?: string | null;
  image_attribution_url?: string | null;
  image_rights_note?: string | null;
  content_updated_at?: string | null;
  public_facts_reviewed?: boolean | null;
  public_name?: string | null;
  public_category_key?: string | null;
  public_address?: string | null;
  public_postcode?: string | null;
  public_phone?: string | null;
  public_website?: string | null;
  public_facts_source_url?: string | null;
  public_facts_note?: string | null;
  public_facts_updated_at?: string | null;
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
  contentEditingAvailable?: boolean;
  factsEditingAvailable?: boolean;
  pagination: { total: number; limit: number; offset: number };
};

type DirectoryFilterOverrides = {
  category?: string;
  city?: string;
  search?: string;
};

type EditorialDraft = {
  descriptionEn: string;
  descriptionSq: string;
  imageUrl: string;
  imageAltEn: string;
  imageAltSq: string;
  imageAttributionLabel: string;
  imageAttributionUrl: string;
  imageRightsNote: string;
};

type PublicFactsDraft = {
  factsReviewed: boolean;
  publicName: string;
  publicCategoryKey: string;
  publicAddress: string;
  publicPostcode: string;
  publicPhone: string;
  publicWebsite: string;
  publicFactsSourceUrl: string;
  publicFactsNote: string;
};

const EMPTY_EDITORIAL_DRAFT: EditorialDraft = {
  descriptionEn: "",
  descriptionSq: "",
  imageUrl: "",
  imageAltEn: "",
  imageAltSq: "",
  imageAttributionLabel: "",
  imageAttributionUrl: "",
  imageRightsNote: "",
};

const EMPTY_PUBLIC_FACTS_DRAFT: PublicFactsDraft = {
  factsReviewed: false,
  publicName: "",
  publicCategoryKey: "",
  publicAddress: "",
  publicPostcode: "",
  publicPhone: "",
  publicWebsite: "",
  publicFactsSourceUrl: "",
  publicFactsNote: "",
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

function isSafeHttpsUrl(value: string) {
  if (!value.trim()) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export default function AdminDirectoryPage() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [adminReady, setAdminReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [directoryLoaded, setDirectoryLoaded] = useState(false);
  const [contentEditingAvailable, setContentEditingAvailable] = useState(true);
  const [factsEditingAvailable, setFactsEditingAvailable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contentSaving, setContentSaving] = useState(false);
  const [factsSaving, setFactsSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
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
  const [editorialDraft, setEditorialDraft] = useState<EditorialDraft>(
    EMPTY_EDITORIAL_DRAFT,
  );
  const [publicFactsDraft, setPublicFactsDraft] = useState<PublicFactsDraft>(
    EMPTY_PUBLIC_FACTS_DRAFT,
  );
  const [imageRightsConfirmed, setImageRightsConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedPlace = useMemo(
    () => places.find((place) => place.id === selectedId) || null,
    [places, selectedId],
  );

  useEffect(() => {
    setEditorialDraft(
      selectedPlace
        ? {
            descriptionEn: selectedPlace.editorial_description_en || "",
            descriptionSq: selectedPlace.editorial_description_sq || "",
            imageUrl: selectedPlace.image_url || "",
            imageAltEn: selectedPlace.image_alt_en || "",
            imageAltSq: selectedPlace.image_alt_sq || "",
            imageAttributionLabel:
              selectedPlace.image_attribution_label || "",
            imageAttributionUrl: selectedPlace.image_attribution_url || "",
            imageRightsNote: selectedPlace.image_rights_note || "",
          }
        : EMPTY_EDITORIAL_DRAFT,
    );
    setImageRightsConfirmed(false);
  }, [selectedPlace]);

  useEffect(() => {
    setPublicFactsDraft(
      selectedPlace
        ? {
            factsReviewed: selectedPlace.public_facts_reviewed === true,
            publicName: selectedPlace.public_facts_reviewed
              ? selectedPlace.public_name || ""
              : selectedPlace.name || "",
            publicCategoryKey: selectedPlace.public_facts_reviewed
              ? selectedPlace.public_category_key || ""
              : selectedPlace.category_key || "",
            publicAddress: selectedPlace.public_facts_reviewed
              ? selectedPlace.public_address || ""
              : selectedPlace.address || "",
            publicPostcode: selectedPlace.public_facts_reviewed
              ? selectedPlace.public_postcode || ""
              : selectedPlace.postcode || "",
            publicPhone: selectedPlace.public_facts_reviewed
              ? selectedPlace.public_phone || ""
              : selectedPlace.phone || "",
            publicWebsite: selectedPlace.public_facts_reviewed
              ? selectedPlace.public_website || ""
              : selectedPlace.website || "",
            publicFactsSourceUrl:
              selectedPlace.public_facts_source_url || "",
            publicFactsNote: selectedPlace.public_facts_note || "",
          }
        : EMPTY_PUBLIC_FACTS_DRAFT,
    );
  }, [selectedPlace]);

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
      setContentEditingAvailable(next.contentEditingAvailable !== false);
      setFactsEditingAvailable(next.factsEditingAvailable !== false);
      setPagination(next.pagination);
      setDirectoryLoaded(true);
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

  function updateEditorialDraft(
    field: keyof EditorialDraft,
    value: string,
  ) {
    setEditorialDraft((current) => ({ ...current, [field]: value }));
    setSuccess("");
  }

  async function uploadDirectoryImage(file: File | null) {
    if (!file || !selectedPlace) return;
    setError("");
    setSuccess("");
    setImageUploading(true);

    try {
      const uploaded = await uploadMirebookImage({
        file,
        folder: "directory",
        recordId: selectedPlace.id,
      });
      setEditorialDraft((current) => ({
        ...current,
        imageUrl: uploaded.publicUrl,
        imageAltEn: current.imageAltEn || selectedPlace.name,
        imageAltSq: current.imageAltSq || selectedPlace.name,
      }));
      setImageRightsConfirmed(false);
      setSuccess(
        t(
          "admin.directory.content.uploadReady",
          "Photo uploaded. Add its credit and permission details, then save.",
        ),
      );
    } catch {
      setError(
        t(
          "admin.directory.content.uploadError",
          "The photo could not be uploaded.",
        ),
      );
    } finally {
      setImageUploading(false);
    }
  }

  function removeDirectoryImage() {
    setEditorialDraft((current) => ({
      ...current,
      imageUrl: "",
      imageAltEn: "",
      imageAltSq: "",
      imageAttributionLabel: "",
      imageAttributionUrl: "",
      imageRightsNote: "",
    }));
    setImageRightsConfirmed(false);
    setSuccess("");
  }

  async function saveEditorialContent() {
    if (!selectedPlace) return;
    setError("");
    setSuccess("");
    if (
      editorialDraft.imageUrl &&
      (!editorialDraft.imageAttributionLabel.trim() ||
        !editorialDraft.imageRightsNote.trim() ||
        (!editorialDraft.imageAltEn.trim() &&
          !editorialDraft.imageAltSq.trim()))
    ) {
      setError(
        t(
          "admin.directory.content.incomplete",
          "Add image alt text, a public credit and a private permission or licence note.",
        ),
      );
      return;
    }
    if (!isSafeHttpsUrl(editorialDraft.imageAttributionUrl)) {
      setError(
        t(
          "admin.directory.content.invalidUrl",
          "Use a secure HTTPS credit or licence URL.",
        ),
      );
      return;
    }
    const token = await currentToken();
    if (!token) return;
    setContentSaving(true);

    try {
      const response = await fetch("/api/admin/directory-places", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          placeId: selectedPlace.id,
          action: "save_content",
          ...editorialDraft,
          rightsConfirmed: imageRightsConfirmed,
        }),
      });
      await response.json();
      if (!response.ok) {
        throw new Error(
          t(
            "admin.directory.content.saveError",
            "Public content could not be saved.",
          ),
        );
      }

      setSuccess(
        t(
          "admin.directory.content.saved",
          "Public description and photo details saved.",
        ),
      );
      setImageRightsConfirmed(false);
      await loadDirectory(pagination.offset, token, undefined, true);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : t(
              "admin.directory.content.saveError",
              "Public content could not be saved.",
            ),
      );
    } finally {
      setContentSaving(false);
    }
  }

  function updatePublicFactsDraft(
    field: keyof PublicFactsDraft,
    value: string | boolean,
  ) {
    setPublicFactsDraft((current) => ({ ...current, [field]: value }));
    setSuccess("");
  }

  async function savePublicFacts() {
    if (!selectedPlace) return;
    setError("");
    setSuccess("");

    if (
      publicFactsDraft.factsReviewed &&
      (!publicFactsDraft.publicName.trim() ||
        !publicFactsDraft.publicCategoryKey ||
        !publicFactsDraft.publicFactsSourceUrl.trim() ||
        !publicFactsDraft.publicFactsNote.trim())
    ) {
      setError(
        t(
          "admin.directory.facts.incomplete",
          "Add a public name, category, secure evidence URL and private verification note.",
        ),
      );
      return;
    }
    if (
      !isSafeHttpsUrl(publicFactsDraft.publicWebsite) ||
      !isSafeHttpsUrl(publicFactsDraft.publicFactsSourceUrl)
    ) {
      setError(
        t(
          "admin.directory.facts.invalidUrl",
          "Use secure HTTPS links for the public website and verification source.",
        ),
      );
      return;
    }

    const token = await currentToken();
    if (!token) return;
    setFactsSaving(true);

    try {
      const response = await fetch("/api/admin/directory-places", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          placeId: selectedPlace.id,
          action: "save_public_facts",
          ...publicFactsDraft,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload.error ||
            t(
              "admin.directory.facts.saveError",
              "Reviewed public details could not be saved.",
            ),
        );
      }

      setSuccess(
        publicFactsDraft.factsReviewed
          ? t(
              "admin.directory.facts.saved",
              "Reviewed public details saved.",
            )
          : t(
              "admin.directory.facts.sourceRestored",
              "Public details now use the imported source again.",
            ),
      );
      await loadDirectory(pagination.offset, token, undefined, true);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : t(
              "admin.directory.facts.saveError",
              "Reviewed public details could not be saved.",
            ),
      );
    } finally {
      setFactsSaving(false);
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
                : t("admin.directory.adminOnlyTitle", "Admin only")}
            </h1>
            {!loading && (
              <p className="muted">
                {t("admin.directory.adminOnly", "Admin access is required.")}
              </p>
            )}
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

        {directoryLoaded ? (
          <div
            className="directory-counts"
            aria-label={t(
              "admin.directory.statusSummary",
              "Directory status summary",
            )}
          >
            {STATUSES.map((value) => (
              <button
                key={value}
                type="button"
                className={
                  status === value
                    ? "directory-count is-active"
                    : "directory-count"
                }
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
        ) : (
          <div
            className="directory-counts"
            role="status"
            aria-live="polite"
            aria-label={t(
              "admin.directory.loadingSummary",
              "Loading directory summary...",
            )}
          >
            {STATUSES.map((value) => (
              <div
                key={value}
                className="directory-count directory-count-placeholder"
                aria-hidden="true"
              >
                <span />
                <span />
              </div>
            ))}
          </div>
        )}

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

          {!directoryLoaded ? (
            <div
              className="directory-coverage-loading"
              role="status"
              aria-live="polite"
            >
              <span>
                {t(
                  "admin.directory.coverage.loading",
                  "Loading launch coverage...",
                )}
              </span>
              <div aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </div>
            </div>
          ) : coverage.available ? (
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

                <section
                  className="directory-facts-editor"
                  aria-labelledby="directory-public-facts"
                >
                  <div className="directory-content-heading">
                    <div>
                      <p className="small muted">
                        {t(
                          "admin.directory.facts.kicker",
                          "Public accuracy",
                        )}
                      </p>
                      <h3 id="directory-public-facts">
                        {t(
                          "admin.directory.facts.title",
                          "Reviewed public details",
                        )}
                      </h3>
                    </div>
                    <span
                      className={`directory-pill ${
                        selectedPlace.public_facts_reviewed
                          ? "is-active"
                          : "is-needs_review"
                      }`}
                    >
                      {selectedPlace.public_facts_reviewed
                        ? t(
                            "admin.directory.facts.reviewed",
                            "Reviewed details",
                          )
                        : t(
                            "admin.directory.facts.imported",
                            "Imported details",
                          )}
                    </span>
                  </div>

                  {!factsEditingAvailable ? (
                    <p className="directory-content-unavailable">
                      {t(
                        "admin.directory.facts.sqlRequired",
                        "Reviewed public details are temporarily unavailable.",
                      )}
                    </p>
                  ) : (
                    <>
                      <label className="directory-rights-confirmation">
                        <input
                          type="checkbox"
                          checked={publicFactsDraft.factsReviewed}
                          onChange={(event) =>
                            updatePublicFactsDraft(
                              "factsReviewed",
                              event.target.checked,
                            )
                          }
                        />
                        <span>
                          {t(
                            "admin.directory.facts.enable",
                            "Use these verified details in public discovery.",
                          )}
                        </span>
                      </label>
                      <p className="small muted">
                        {t(
                          "admin.directory.facts.body",
                          "Correct stale source facts without changing the imported record. Empty optional fields stay hidden publicly.",
                        )}
                      </p>

                      <div className="directory-content-fields">
                        <label>
                          <span>
                            {t(
                              "admin.directory.facts.name",
                              "Public name",
                            )}
                          </span>
                          <input
                            maxLength={180}
                            value={publicFactsDraft.publicName}
                            disabled={
                              !publicFactsDraft.factsReviewed || factsSaving
                            }
                            onChange={(event) =>
                              updatePublicFactsDraft(
                                "publicName",
                                event.target.value,
                              )
                            }
                          />
                        </label>
                        <label>
                          <span>
                            {t(
                              "admin.directory.facts.category",
                              "Public category",
                            )}
                          </span>
                          <select
                            value={publicFactsDraft.publicCategoryKey}
                            disabled={
                              !publicFactsDraft.factsReviewed || factsSaving
                            }
                            onChange={(event) =>
                              updatePublicFactsDraft(
                                "publicCategoryKey",
                                event.target.value,
                              )
                            }
                          >
                            {CATEGORIES.map((categoryKey) => (
                              <option key={categoryKey} value={categoryKey}>
                                {categoryLabel(categoryKey)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>
                            {t(
                              "admin.directory.facts.address",
                              "Public address",
                            )}
                          </span>
                          <input
                            maxLength={500}
                            value={publicFactsDraft.publicAddress}
                            disabled={
                              !publicFactsDraft.factsReviewed || factsSaving
                            }
                            onChange={(event) =>
                              updatePublicFactsDraft(
                                "publicAddress",
                                event.target.value,
                              )
                            }
                          />
                        </label>
                        <label>
                          <span>
                            {t(
                              "admin.directory.facts.postcode",
                              "Public postcode",
                            )}
                          </span>
                          <input
                            maxLength={40}
                            value={publicFactsDraft.publicPostcode}
                            disabled={
                              !publicFactsDraft.factsReviewed || factsSaving
                            }
                            onChange={(event) =>
                              updatePublicFactsDraft(
                                "publicPostcode",
                                event.target.value,
                              )
                            }
                          />
                        </label>
                        <label>
                          <span>
                            {t(
                              "admin.directory.facts.phone",
                              "Public phone",
                            )}
                          </span>
                          <input
                            maxLength={80}
                            value={publicFactsDraft.publicPhone}
                            disabled={
                              !publicFactsDraft.factsReviewed || factsSaving
                            }
                            onChange={(event) =>
                              updatePublicFactsDraft(
                                "publicPhone",
                                event.target.value,
                              )
                            }
                          />
                        </label>
                        <label>
                          <span>
                            {t(
                              "admin.directory.facts.website",
                              "Public website",
                            )}
                          </span>
                          <input
                            type="url"
                            inputMode="url"
                            maxLength={1200}
                            placeholder="https://"
                            value={publicFactsDraft.publicWebsite}
                            disabled={
                              !publicFactsDraft.factsReviewed || factsSaving
                            }
                            onChange={(event) =>
                              updatePublicFactsDraft(
                                "publicWebsite",
                                event.target.value,
                              )
                            }
                          />
                        </label>
                      </div>

                      {publicFactsDraft.factsReviewed && (
                        <div className="directory-facts-evidence">
                          <label>
                            <span>
                              {t(
                                "admin.directory.facts.sourceUrl",
                                "Private verification source",
                              )}
                            </span>
                            <input
                              type="url"
                              inputMode="url"
                              maxLength={1200}
                              placeholder="https://"
                              value={publicFactsDraft.publicFactsSourceUrl}
                              disabled={factsSaving}
                              onChange={(event) =>
                                updatePublicFactsDraft(
                                  "publicFactsSourceUrl",
                                  event.target.value,
                                )
                              }
                            />
                          </label>
                          <label>
                            <span>
                              {t(
                                "admin.directory.facts.note",
                                "Private verification note",
                              )}
                            </span>
                            <textarea
                              rows={2}
                              maxLength={1000}
                              value={publicFactsDraft.publicFactsNote}
                              disabled={factsSaving}
                              onChange={(event) =>
                                updatePublicFactsDraft(
                                  "publicFactsNote",
                                  event.target.value,
                                )
                              }
                              placeholder={t(
                                "admin.directory.facts.notePlaceholder",
                                "Record what was checked and when.",
                              )}
                            />
                          </label>
                        </div>
                      )}

                      <button
                        type="button"
                        className="btn btn-accent directory-content-save"
                        onClick={savePublicFacts}
                        disabled={
                          factsSaving ||
                          (!publicFactsDraft.factsReviewed &&
                            selectedPlace.public_facts_reviewed !== true)
                        }
                      >
                        {factsSaving
                          ? t(
                              "admin.directory.facts.saving",
                              "Saving reviewed details...",
                            )
                          : publicFactsDraft.factsReviewed
                            ? t(
                                "admin.directory.facts.save",
                                "Save reviewed details",
                              )
                            : t(
                                "admin.directory.facts.restore",
                                "Use imported details",
                              )}
                      </button>
                    </>
                  )}
                </section>

                <section
                  className="directory-content-editor"
                  aria-labelledby="directory-public-content"
                >
                  <div className="directory-content-heading">
                    <div>
                      <p className="small muted">
                        {t(
                          "admin.directory.content.kicker",
                          "Customer presentation",
                        )}
                      </p>
                      <h3 id="directory-public-content">
                        {t(
                          "admin.directory.content.title",
                          "Description and photo",
                        )}
                      </h3>
                    </div>
                    {selectedPlace.content_updated_at && (
                      <span className="small muted">
                        {t(
                          "admin.directory.content.updated",
                          "Updated",
                        )}{" "}
                        {formatDate(selectedPlace.content_updated_at, locale)}
                      </span>
                    )}
                  </div>

                  {!contentEditingAvailable ? (
                    <p className="directory-content-unavailable">
                      {t(
                        "admin.directory.content.sqlRequired",
                        "Reviewed descriptions and photos are temporarily unavailable.",
                      )}
                    </p>
                  ) : (
                    <>
                      <p className="small muted">
                        {t(
                          "admin.directory.content.body",
                          "Add concise, verified copy and only imagery Mirëbook has permission to publish.",
                        )}
                      </p>

                      <div className="directory-content-fields">
                        <label>
                          <span>
                            {t(
                              "admin.directory.content.descriptionEn",
                              "English description",
                            )}
                          </span>
                          <textarea
                            rows={3}
                            maxLength={600}
                            value={editorialDraft.descriptionEn}
                            onChange={(event) =>
                              updateEditorialDraft(
                                "descriptionEn",
                                event.target.value,
                              )
                            }
                            placeholder={t(
                              "admin.directory.content.descriptionPlaceholder",
                              "What makes this place useful or worth visiting?",
                            )}
                          />
                        </label>
                        <label>
                          <span>
                            {t(
                              "admin.directory.content.descriptionSq",
                              "Albanian description",
                            )}
                          </span>
                          <textarea
                            rows={3}
                            maxLength={600}
                            value={editorialDraft.descriptionSq}
                            onChange={(event) =>
                              updateEditorialDraft(
                                "descriptionSq",
                                event.target.value,
                              )
                            }
                            placeholder={t(
                              "admin.directory.content.descriptionPlaceholder",
                              "What makes this place useful or worth visiting?",
                            )}
                          />
                        </label>
                      </div>

                      {selectedPlace.description && (
                        <p className="directory-source-description small muted">
                          <strong>
                            {t(
                              "admin.directory.content.sourceDescription",
                              "Imported description",
                            )}
                          </strong>{" "}
                          {selectedPlace.description}
                        </p>
                      )}

                      <div className="directory-image-workspace">
                        <div className="directory-image-preview">
                          {editorialDraft.imageUrl ? (
                            <img
                              src={editorialDraft.imageUrl}
                              alt={
                                editorialDraft.imageAltEn ||
                                editorialDraft.imageAltSq ||
                                selectedPlace.name
                              }
                            />
                          ) : (
                            <span>
                              {t(
                                "admin.directory.content.noPhoto",
                                "No reviewed photo",
                              )}
                            </span>
                          )}
                        </div>

                        <div className="directory-image-controls">
                          <label>
                            <span>
                              {t(
                                "admin.directory.content.photoUpload",
                                "Upload a reviewed photo",
                              )}
                            </span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              disabled={imageUploading || contentSaving}
                              onChange={(event) => {
                                void uploadDirectoryImage(
                                  event.target.files?.[0] || null,
                                );
                                event.currentTarget.value = "";
                              }}
                            />
                          </label>
                          <p className="small muted">
                            {t(
                              "admin.directory.content.photoHelp",
                              "Use an owned, permitted or appropriately licensed image. JPG, PNG, WEBP or GIF up to 5MB.",
                            )}
                          </p>
                          {imageUploading && (
                            <p className="small muted" role="status">
                              {t(
                                "admin.directory.content.uploading",
                                "Uploading photo...",
                              )}
                            </p>
                          )}
                          {editorialDraft.imageUrl && (
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={removeDirectoryImage}
                              disabled={contentSaving}
                            >
                              {t(
                                "admin.directory.content.removePhoto",
                                "Remove photo",
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {editorialDraft.imageUrl && (
                        <>
                          <div className="directory-content-fields">
                            <label>
                              <span>
                                {t(
                                  "admin.directory.content.altEn",
                                  "English image description",
                                )}
                              </span>
                              <input
                                maxLength={180}
                                value={editorialDraft.imageAltEn}
                                onChange={(event) =>
                                  updateEditorialDraft(
                                    "imageAltEn",
                                    event.target.value,
                                  )
                                }
                              />
                            </label>
                            <label>
                              <span>
                                {t(
                                  "admin.directory.content.altSq",
                                  "Albanian image description",
                                )}
                              </span>
                              <input
                                maxLength={180}
                                value={editorialDraft.imageAltSq}
                                onChange={(event) =>
                                  updateEditorialDraft(
                                    "imageAltSq",
                                    event.target.value,
                                  )
                                }
                              />
                            </label>
                            <label>
                              <span>
                                {t(
                                  "admin.directory.content.credit",
                                  "Public photo credit",
                                )}
                              </span>
                              <input
                                maxLength={180}
                                value={editorialDraft.imageAttributionLabel}
                                onChange={(event) =>
                                  updateEditorialDraft(
                                    "imageAttributionLabel",
                                    event.target.value,
                                  )
                                }
                                placeholder={t(
                                  "admin.directory.content.creditPlaceholder",
                                  "Photographer, owner or image source",
                                )}
                              />
                            </label>
                            <label>
                              <span>
                                {t(
                                  "admin.directory.content.creditUrl",
                                  "Credit or licence URL (optional)",
                                )}
                              </span>
                              <input
                                type="url"
                                inputMode="url"
                                maxLength={1200}
                                value={editorialDraft.imageAttributionUrl}
                                onChange={(event) =>
                                  updateEditorialDraft(
                                    "imageAttributionUrl",
                                    event.target.value,
                                  )
                                }
                                placeholder="https://"
                              />
                            </label>
                          </div>
                          <label className="directory-rights-note">
                            <span>
                              {t(
                                "admin.directory.content.rightsNote",
                                "Private permission or licence note",
                              )}
                            </span>
                            <textarea
                              rows={2}
                              maxLength={500}
                              value={editorialDraft.imageRightsNote}
                              onChange={(event) =>
                                updateEditorialDraft(
                                  "imageRightsNote",
                                  event.target.value,
                                )
                              }
                              placeholder={t(
                                "admin.directory.content.rightsPlaceholder",
                                "Record who supplied the image or the licence that allows publication.",
                              )}
                            />
                          </label>
                          <label className="directory-rights-confirmation">
                            <input
                              type="checkbox"
                              checked={imageRightsConfirmed}
                              onChange={(event) =>
                                setImageRightsConfirmed(event.target.checked)
                              }
                            />
                            <span>
                              {t(
                                "admin.directory.content.rightsConfirm",
                                "I have confirmed Mirëbook may publish this image.",
                              )}
                            </span>
                          </label>
                        </>
                      )}

                      <button
                        type="button"
                        className="btn btn-accent directory-content-save"
                        onClick={saveEditorialContent}
                        disabled={
                          contentSaving ||
                          imageUploading ||
                          (Boolean(editorialDraft.imageUrl) &&
                            !imageRightsConfirmed)
                        }
                      >
                        {contentSaving
                          ? t(
                              "admin.directory.content.saving",
                              "Saving public content...",
                            )
                          : t(
                              "admin.directory.content.save",
                              "Save public content",
                            )}
                      </button>
                    </>
                  )}
                </section>

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

        .directory-count-placeholder {
          align-content: center;
          gap: 0.55rem;
          pointer-events: none;
        }

        .directory-count-placeholder span,
        .directory-coverage-loading i {
          display: block;
          border-radius: 4px;
          background: var(--surface-2);
          animation: directory-loading-pulse 1.2s ease-in-out infinite;
        }

        .directory-count-placeholder span:first-child {
          width: 2rem;
          height: 1.15rem;
        }

        .directory-count-placeholder span:last-child {
          width: min(100%, 6rem);
          height: 0.75rem;
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

        .directory-coverage-loading {
          min-height: 170px;
          margin-top: 0.85rem;
          color: var(--text-muted);
          display: grid;
          align-content: start;
          gap: 0.75rem;
        }

        .directory-coverage-loading > div {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.65rem 1.5rem;
        }

        .directory-coverage-loading i {
          height: 2.25rem;
        }

        @keyframes directory-loading-pulse {
          0%,
          100% {
            opacity: 0.55;
          }

          50% {
            opacity: 1;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .directory-count-placeholder span,
          .directory-coverage-loading i {
            animation: none;
          }
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

        .directory-facts-editor,
        .directory-content-editor {
          display: grid;
          gap: 0.8rem;
          padding: 1rem 0;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }

        .directory-content-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
        }

        .directory-content-heading h3,
        .directory-content-heading p,
        .directory-facts-editor > p,
        .directory-content-editor > p {
          margin: 0;
        }

        .directory-content-fields {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.7rem;
        }

        .directory-content-fields label,
        .directory-facts-evidence label,
        .directory-image-controls label,
        .directory-rights-note {
          display: grid;
          gap: 0.35rem;
          color: var(--text-muted);
          font-size: 0.8rem;
        }

        .directory-content-fields input,
        .directory-content-fields select,
        .directory-content-fields textarea,
        .directory-facts-evidence input,
        .directory-facts-evidence textarea,
        .directory-rights-note textarea {
          width: 100%;
        }

        .directory-facts-evidence {
          display: grid;
          gap: 0.7rem;
          padding: 0.8rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-2);
        }

        .directory-source-description {
          padding-left: 0.7rem;
          border-left: 2px solid var(--border-2);
          overflow-wrap: anywhere;
        }

        .directory-image-workspace {
          display: grid;
          grid-template-columns: minmax(150px, 0.65fr) minmax(0, 1fr);
          gap: 0.8rem;
          align-items: start;
        }

        .directory-image-preview {
          min-height: 130px;
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-2);
          color: var(--text-muted);
          display: grid;
          place-items: center;
          text-align: center;
        }

        .directory-image-preview img {
          width: 100%;
          height: 100%;
          min-height: 130px;
          object-fit: cover;
        }

        .directory-image-controls {
          min-width: 0;
          display: grid;
          justify-items: start;
          gap: 0.45rem;
        }

        .directory-image-controls p {
          margin: 0;
        }

        .directory-rights-confirmation {
          display: flex;
          align-items: flex-start;
          gap: 0.55rem;
          color: var(--text);
          font-size: 0.82rem;
        }

        .directory-rights-confirmation input {
          flex: 0 0 auto;
          width: 18px;
          height: 18px;
          margin-top: 0.05rem;
          accent-color: var(--accent);
        }

        .directory-content-save {
          width: fit-content;
        }

        .directory-content-unavailable {
          padding: 0.75rem;
          border: 1px solid rgba(255, 190, 11, 0.3);
          border-radius: 8px;
          background: var(--warning-dim);
          color: var(--warning);
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
          .directory-content-fields,
          .directory-image-workspace,
          .directory-coverage-groups {
            grid-template-columns: 1fr;
          }

          .directory-content-heading {
            display: grid;
          }

          .directory-content-save,
          .directory-image-controls :global(.btn) {
            width: 100%;
            justify-content: center;
          }

          .directory-coverage-loading > div {
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
