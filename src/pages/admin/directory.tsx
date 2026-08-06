import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  ArrowRight,
  CheckCircle2,
  Image as ImageIcon,
  ImageOff,
  MapPin,
} from "lucide-react";
import AuthNav from "@/components/AuthNav";
import DirectoryPhotoRequestKit from "@/components/admin/DirectoryPhotoRequestKit";
import { uploadMirebookImage } from "@/lib/imageUpload";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/useI18n";
import { getStableBrowserSession } from "@/lib/auth/getStableBrowserSession";
import { getAdminLoginHref } from "@/lib/auth/getAdminLoginHref";

type DirectoryStatus =
  "needs_review" | "active" | "hidden" | "closed" | "duplicate";

type DirectoryAction =
  "approve" | "hide" | "close" | "return_to_review" | "mark_duplicate";

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

type MediaFilter = "" | "with_photo" | "missing_photo";

type MediaCoverage = {
  available: boolean;
  total: number;
  withPhoto: number;
  missingPhoto: number;
  cities: MediaCoverageItem[];
  categories: MediaCoverageItem[];
  priority: MediaPriorityItem[];
};

type MediaCoverageItem = {
  key: string;
  total: number;
  withPhoto: number;
  missingPhoto: number;
};

type MediaPriorityReason =
  | "city_gap"
  | "category_gap"
  | "booking_category"
  | "contact_ready"
  | "high_confidence";

type MediaPriorityItem = {
  id: string;
  name: string;
  city: string;
  categoryKey: string;
  score: number;
  reasons: MediaPriorityReason[];
};

type DirectoryResponse = {
  places: DirectoryPlace[];
  counts: Record<DirectoryStatus, number>;
  coverage: DirectoryCoverage;
  mediaCoverage: MediaCoverage;
  contentEditingAvailable?: boolean;
  factsEditingAvailable?: boolean;
  pagination: { total: number; limit: number; offset: number };
};

type DirectoryFilterOverrides = {
  category?: string;
  city?: string;
  search?: string;
  media?: MediaFilter;
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
  const [media, setMedia] = useState<MediaFilter>("");
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
  const [mediaCoverage, setMediaCoverage] = useState<MediaCoverage>({
    available: false,
    total: 0,
    withPhoto: 0,
    missingPhoto: 0,
    cities: [],
    categories: [],
    priority: [],
  });
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
  });
  const [pendingAction, setPendingAction] = useState<DirectoryAction | null>(
    null,
  );
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

  const cityMediaGaps = useMemo(
    () =>
      [...mediaCoverage.cities]
        .filter((item) => item.missingPhoto > 0)
        .sort(
          (left, right) =>
            right.missingPhoto - left.missingPhoto ||
            left.key.localeCompare(right.key, "sq"),
        )
        .slice(0, 5),
    [mediaCoverage.cities],
  );

  const categoryMediaGaps = useMemo(
    () =>
      [...mediaCoverage.categories]
        .filter((item) => item.missingPhoto > 0)
        .sort(
          (left, right) =>
            right.missingPhoto - left.missingPhoto ||
            left.key.localeCompare(right.key, "en"),
        )
        .slice(0, 5),
    [mediaCoverage.categories],
  );

  const priorityPhotoPilotIds = useMemo(
    () => new Set(mediaCoverage.priority.slice(0, 6).map((item) => item.id)),
    [mediaCoverage.priority],
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
            imageAttributionLabel: selectedPlace.image_attribution_label || "",
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
            publicFactsSourceUrl: selectedPlace.public_facts_source_url || "",
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
      const session = await getStableBrowserSession();

      if (!session) {
        router.replace(getAdminLoginHref(router.asPath, "/admin/directory"));
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
      value
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase()),
    );
  }

  function mediaPriorityReasonLabel(value: MediaPriorityReason) {
    const labels: Record<MediaPriorityReason, string> = {
      city_gap: t("admin.directory.media.reason.city", "City coverage gap"),
      category_gap: t(
        "admin.directory.media.reason.category",
        "Category coverage gap",
      ),
      booking_category: t(
        "admin.directory.media.reason.booking",
        "Strong booking fit",
      ),
      contact_ready: t(
        "admin.directory.media.reason.contact",
        "Contact route available",
      ),
      high_confidence: t(
        "admin.directory.media.reason.confidence",
        "High-confidence record",
      ),
    };
    return labels[value];
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
      router.replace(getAdminLoginHref(router.asPath, "/admin/directory"));
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
      const appliedMedia = filterOverrides.media ?? media;
      if (appliedCategory) params.set("category", appliedCategory);
      if (appliedCity.trim()) params.set("city", appliedCity.trim());
      if (appliedSearch.trim()) params.set("search", appliedSearch.trim());
      if (appliedMedia) params.set("media", appliedMedia);

      const response = await fetch(`/api/admin/directory-places?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Directory could not be loaded.");

      const next = payload as DirectoryResponse;
      setPlaces(next.places);
      setCounts(next.counts);
      setCoverage(
        next.coverage || { available: false, cities: [], categories: [] },
      );
      setMediaCoverage({
        available: next.mediaCoverage?.available === true,
        total: next.mediaCoverage?.total || 0,
        withPhoto: next.mediaCoverage?.withPhoto || 0,
        missingPhoto: next.mediaCoverage?.missingPhoto || 0,
        cities: next.mediaCoverage?.cities || [],
        categories: next.mediaCoverage?.categories || [],
        priority: next.mediaCoverage?.priority || [],
      });
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

  function openCoverage(item: CoverageItem, filterType: "city" | "category") {
    const nextStatus: DirectoryStatus =
      item.needsReview > 0 ? "needs_review" : "active";
    const nextCategory = filterType === "category" ? item.key : "";
    const nextCity = filterType === "city" ? item.key : "";

    setStatus(nextStatus);
    setCategory(nextCategory);
    setCity(nextCity);
    setSearch("");
    setMedia("");
    loadDirectory(0, undefined, nextStatus, false, {
      category: nextCategory,
      city: nextCity,
      search: "",
      media: "",
    });
  }

  function openMediaCoverage(nextMedia: MediaFilter) {
    setStatus("active");
    setCategory("");
    setCity("");
    setSearch("");
    setMedia(nextMedia);
    loadDirectory(0, undefined, "active", false, {
      category: "",
      city: "",
      search: "",
      media: nextMedia,
    });
  }

  function openMediaGap(
    item: MediaCoverageItem,
    filterType: "city" | "category",
  ) {
    const nextCategory = filterType === "category" ? item.key : "";
    const nextCity = filterType === "city" ? item.key : "";

    setStatus("active");
    setCategory(nextCategory);
    setCity(nextCity);
    setSearch("");
    setMedia("missing_photo");
    loadDirectory(0, undefined, "active", false, {
      category: nextCategory,
      city: nextCity,
      search: "",
      media: "missing_photo",
    });
  }

  function openMediaPriority(item: MediaPriorityItem) {
    setStatus("active");
    setCategory("");
    setCity("");
    setSearch(item.name);
    setMedia("missing_photo");
    loadDirectory(0, undefined, "active", false, {
      category: "",
      city: "",
      search: item.name,
      media: "missing_photo",
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
      if (!response.ok)
        throw new Error(payload.error || "Review could not be saved.");

      setSuccess(
        t(
          "admin.directory.success.review",
          "Review saved. Public results remain controlled by status.",
        ),
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
        body: JSON.stringify({
          placeId: selectedPlace.id,
          action: "map_preview",
        }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Map preview is unavailable.");
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

  function updateEditorialDraft(field: keyof EditorialDraft, value: string) {
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
          ? t("admin.directory.facts.saved", "Reviewed public details saved.")
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
            <h1 className="page-title">
              {t("admin.directory.title", "Directory review")}
            </h1>
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
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => loadDirectory(0)}
            >
              {t("admin.directory.refresh", "Refresh")}
            </button>
          </div>
        </header>

        <div className="directory-safety">
          <strong>
            {t("admin.directory.safetyTitle", "Approval is the public gate")}
          </strong>
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
                  setMedia("");
                  loadDirectory(0, undefined, value, false, { media: "" });
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

        <section
          className="directory-media"
          aria-labelledby="directory-media-title"
        >
          <div className="directory-media-heading">
            <div>
              <p className="small directory-kicker">
                {t("admin.directory.media.kicker", "Visual catalogue")}
              </p>
              <h2 id="directory-media-title">
                {t("admin.directory.media.title", "Marketplace photos")}
              </h2>
            </div>
            <p className="small muted">
              {t(
                "admin.directory.media.body",
                "Reviewed photos strengthen discovery. Places without one keep their category artwork until suitable image rights are confirmed.",
              )}
            </p>
          </div>

          {!directoryLoaded ? (
            <div
              className="directory-media-loading"
              role="status"
              aria-live="polite"
            >
              {t("admin.directory.media.loading", "Loading photo coverage...")}
            </div>
          ) : mediaCoverage.available ? (
            <>
              <div className="directory-media-progress-line">
                <strong>
                  {mediaCoverage.withPhoto}{" "}
                  {t("admin.directory.media.of", "of")} {mediaCoverage.total}
                </strong>
                <span>
                  {t(
                    "admin.directory.media.coverage",
                    "approved places include a reviewed photo",
                  )}
                </span>
              </div>
              <div
                className="directory-media-progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={mediaCoverage.total}
                aria-valuenow={mediaCoverage.withPhoto}
                aria-label={t(
                  "admin.directory.media.progressLabel",
                  "Approved place photo coverage",
                )}
              >
                <span
                  style={{
                    width: `${
                      mediaCoverage.total > 0
                        ? Math.round(
                            (mediaCoverage.withPhoto / mediaCoverage.total) *
                              100,
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
              <div className="directory-media-actions">
                <button
                  type="button"
                  className={
                    status === "active" &&
                    media === "" &&
                    !category &&
                    !city.trim() &&
                    !search.trim()
                      ? "directory-media-action is-active"
                      : "directory-media-action"
                  }
                  onClick={() => openMediaCoverage("")}
                >
                  <ImageIcon size={18} aria-hidden="true" />
                  <span>
                    <strong>{mediaCoverage.total}</strong>
                    {t("admin.directory.media.all", "All approved")}
                  </span>
                </button>
                <button
                  type="button"
                  className={
                    status === "active" && media === "with_photo"
                      ? "directory-media-action is-active"
                      : "directory-media-action"
                  }
                  onClick={() => openMediaCoverage("with_photo")}
                >
                  <ImageIcon size={18} aria-hidden="true" />
                  <span>
                    <strong>{mediaCoverage.withPhoto}</strong>
                    {t("admin.directory.media.withPhoto", "With photo")}
                  </span>
                </button>
                <button
                  type="button"
                  className={
                    status === "active" && media === "missing_photo"
                      ? "directory-media-action is-active"
                      : "directory-media-action"
                  }
                  onClick={() => openMediaCoverage("missing_photo")}
                >
                  <ImageOff size={18} aria-hidden="true" />
                  <span>
                    <strong>{mediaCoverage.missingPhoto}</strong>
                    {t("admin.directory.media.missing", "Photos needed")}
                  </span>
                </button>
              </div>

              <div className="directory-media-plan">
                <div className="directory-media-gaps">
                  <div className="directory-media-section-heading">
                    <div>
                      <h3>
                        {t(
                          "admin.directory.media.gapsTitle",
                          "Coverage gaps",
                        )}
                      </h3>
                      <p className="small muted">
                        {t(
                          "admin.directory.media.gapsBody",
                          "Open a thin city or category to see only approved places still using fallback artwork.",
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="directory-media-gap-groups">
                    <div>
                      <h4>
                        {t("admin.directory.media.byCity", "By city")}
                      </h4>
                      <div className="directory-media-gap-rows">
                        {cityMediaGaps.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => openMediaGap(item, "city")}
                          >
                            <span>{item.key}</span>
                            <strong>
                              {item.withPhoto}/{item.total}
                            </strong>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4>
                        {t(
                          "admin.directory.media.byCategory",
                          "By category",
                        )}
                      </h4>
                      <div className="directory-media-gap-rows">
                        {categoryMediaGaps.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => openMediaGap(item, "category")}
                          >
                            <span>{categoryLabel(item.key)}</span>
                            <strong>
                              {item.withPhoto}/{item.total}
                            </strong>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="directory-media-priority">
                  <div className="directory-media-section-heading">
                    <div>
                      <h3>
                        {t(
                          "admin.directory.media.priorityTitle",
                          "Next balanced photo set",
                        )}
                      </h3>
                      <p className="small muted">
                        {t(
                          "admin.directory.media.priorityBody",
                          "A private shortlist balancing city gaps, booking relevance, contact routes and source confidence.",
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => openMediaCoverage("missing_photo")}
                    >
                      {t(
                        "admin.directory.media.openQueue",
                        "Open full photo queue",
                      )}
                    </button>
                  </div>
                  <div className="directory-media-priority-rows">
                    {mediaCoverage.priority.slice(0, 6).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="directory-media-priority-row"
                        onClick={() => openMediaPriority(item)}
                      >
                        <span className="directory-media-priority-main">
                          <strong>{item.name}</strong>
                          <span className="directory-media-priority-location">
                            <MapPin size={14} aria-hidden="true" />
                            {item.city} · {categoryLabel(item.categoryKey)}
                          </span>
                          <span className="directory-media-reasons">
                            {item.reasons.map((reason) => (
                              <small key={reason}>
                                {mediaPriorityReasonLabel(reason)}
                              </small>
                            ))}
                          </span>
                        </span>
                        <ArrowRight size={18} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </section>

        <section
          className="directory-coverage"
          aria-labelledby="directory-coverage-title"
        >
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
                    title: t(
                      "admin.directory.coverage.cities",
                      "Priority cities",
                    ),
                    items: coverage.cities,
                  },
                  {
                    key: "categories",
                    title: t(
                      "admin.directory.coverage.categories",
                      "Categories",
                    ),
                    items: coverage.categories,
                  },
                ] as const
              ).map((group) => (
                <div key={group.key} className="directory-coverage-group">
                  <h3>{group.title}</h3>
                  <div className="directory-coverage-rows">
                    {group.items.map((item) => {
                      const label =
                        group.key === "categories"
                          ? categoryLabel(item.key)
                          : item.key;
                      const isEmpty =
                        item.approved === 0 && item.needsReview === 0;
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
                              {t(
                                "admin.directory.coverage.empty",
                                "No candidates",
                              )}
                            </small>
                          ) : (
                            <span className="directory-coverage-totals">
                              <small className="is-approved">
                                {item.approved}{" "}
                                {t(
                                  "admin.directory.coverage.approvedShort",
                                  "approved",
                                )}
                              </small>
                              <small className="is-review">
                                {item.needsReview}{" "}
                                {t(
                                  "admin.directory.coverage.review",
                                  "to review",
                                )}
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
              placeholder={t(
                "admin.directory.filter.searchPlaceholder",
                "Search names",
              )}
            />
          </label>
          <label>
            <span>{t("admin.directory.filter.category", "Category")}</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="">
                {t("admin.directory.filter.allCategories", "All categories")}
              </option>
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
              placeholder={t(
                "admin.directory.filter.cityPlaceholder",
                "Exact city",
              )}
            />
          </label>
          <label>
            <span>{t("admin.directory.filter.media", "Photo")}</span>
            <select
              value={media}
              onChange={(event) => setMedia(event.target.value as MediaFilter)}
            >
              <option value="">
                {t("admin.directory.filter.allMedia", "Any photo status")}
              </option>
              <option value="with_photo">
                {t("admin.directory.media.withPhoto", "With photo")}
              </option>
              <option value="missing_photo">
                {t("admin.directory.media.missing", "Photos needed")}
              </option>
            </select>
          </label>
          <button className="btn btn-accent" type="submit">
            {t("admin.directory.filter.apply", "Apply filters")}
          </button>
        </form>

        {error && <div className="directory-message is-error">{error}</div>}
        {success && (
          <div className="directory-message is-success">{success}</div>
        )}

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
              <div className="directory-empty">
                {t("admin.directory.loading", "Loading directory places...")}
              </div>
            ) : places.length === 0 ? (
              <div className="directory-empty">
                <strong>
                  {t("admin.directory.emptyTitle", "No places in this view")}
                </strong>
                <span>
                  {t(
                    "admin.directory.emptyBody",
                    "Change the status or filters to review another group.",
                  )}
                </span>
              </div>
            ) : (
              <div className="directory-rows">
                {places.map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    className={
                      selectedId === place.id
                        ? "directory-row is-selected"
                        : "directory-row"
                    }
                    onClick={() => choosePlace(place.id)}
                  >
                    <span className="directory-row-main">
                      <strong>{place.name}</strong>
                      <span>
                        {[
                          categoryLabel(place.category_key),
                          place.city || place.region,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="directory-row-side">
                      <span
                        className={
                          place.image_url
                            ? "directory-media-pill has-photo"
                            : "directory-media-pill needs-photo"
                        }
                      >
                        {place.image_url ? (
                          <ImageIcon size={14} aria-hidden="true" />
                        ) : (
                          <ImageOff size={14} aria-hidden="true" />
                        )}
                        {place.image_url
                          ? t("admin.directory.media.photo", "Photo")
                          : t(
                              "admin.directory.media.photoNeeded",
                              "Photo needed",
                            )}
                      </span>
                      <span
                        className={`directory-pill is-${place.listing_status}`}
                      >
                        {statusLabel(place.listing_status)}
                      </span>
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
                onClick={() =>
                  loadDirectory(
                    Math.max(0, pagination.offset - pagination.limit),
                  )
                }
              >
                {t("admin.directory.previous", "Previous")}
              </button>
              <span className="small muted">
                {pagination.total === 0 ? 0 : pagination.offset + 1}–
                {Math.min(
                  pagination.offset + pagination.limit,
                  pagination.total,
                )}
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={
                  pagination.offset + pagination.limit >= pagination.total ||
                  loading
                }
                onClick={() =>
                  loadDirectory(pagination.offset + pagination.limit)
                }
              >
                {t("admin.directory.next", "Next")}
              </button>
            </div>
          </section>

          <section className="directory-detail card">
            {!selectedPlace ? (
              <div className="directory-empty">
                <strong>
                  {t("admin.directory.selectTitle", "Select a place")}
                </strong>
                <span>
                  {t(
                    "admin.directory.selectBody",
                    "Choose a row to inspect source data and make a review decision.",
                  )}
                </span>
              </div>
            ) : (
              <>
                <div className="directory-detail-header">
                  <div>
                    <div className="directory-title-line">
                      <h2>{selectedPlace.name}</h2>
                      <span
                        className={`directory-pill is-${selectedPlace.listing_status}`}
                      >
                        {statusLabel(selectedPlace.listing_status)}
                      </span>
                    </div>
                    <p className="muted">
                      {[
                        categoryLabel(selectedPlace.category_key),
                        selectedPlace.city,
                        selectedPlace.country_code,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={loadMapPreview}
                    disabled={mapLoading}
                  >
                    {mapLoading
                      ? t("admin.directory.mapLoading", "Loading map...")
                      : t("admin.directory.map", "Preview map")}
                  </button>
                </div>

                {mapImage && (
                  <div className="directory-map">
                    <img
                      src={mapImage}
                      alt={t(
                        "admin.directory.mapAlt",
                        "Map preview for this directory place",
                      )}
                    />
                  </div>
                )}

                <section
                  className="directory-facts-editor"
                  aria-labelledby="directory-public-facts"
                >
                  <div className="directory-content-heading">
                    <div>
                      <p className="small muted">
                        {t("admin.directory.facts.kicker", "Public accuracy")}
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
                            {t("admin.directory.facts.name", "Public name")}
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
                            {t("admin.directory.facts.phone", "Public phone")}
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
                    <div className="directory-content-heading-actions">
                      <span
                        className={
                          selectedPlace.image_url
                            ? "directory-media-pill has-photo"
                            : "directory-media-pill needs-photo"
                        }
                      >
                        {selectedPlace.image_url ? (
                          <ImageIcon size={14} aria-hidden="true" />
                        ) : (
                          <ImageOff size={14} aria-hidden="true" />
                        )}
                        {selectedPlace.image_url
                          ? t("admin.directory.media.photo", "Photo")
                          : t(
                              "admin.directory.media.photoNeeded",
                              "Photo needed",
                            )}
                      </span>
                      {selectedPlace.listing_status === "active" && (
                        <Link
                          href={`/places/${selectedPlace.id}`}
                          className="btn btn-ghost directory-public-preview"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t(
                            "admin.directory.content.publicPreview",
                            "View public page",
                          )}
                        </Link>
                      )}
                      {selectedPlace.content_updated_at && (
                        <span className="small muted">
                          {t("admin.directory.content.updated", "Updated")}{" "}
                          {formatDate(
                            selectedPlace.content_updated_at,
                            locale,
                          )}
                        </span>
                      )}
                    </div>
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
                          <span className="directory-image-preview-label">
                            {t(
                              "admin.directory.content.publicCrop",
                              "Public card crop · 16:9",
                            )}
                          </span>
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
                          <div
                            className="directory-media-readiness"
                            aria-label={t(
                              "admin.directory.content.readiness",
                              "Photo readiness",
                            )}
                          >
                            {[
                              {
                                key: "photo",
                                ready: Boolean(editorialDraft.imageUrl),
                                label: t(
                                  "admin.directory.content.check.photo",
                                  "Reviewed image",
                                ),
                              },
                              {
                                key: "alt-en",
                                ready: Boolean(
                                  editorialDraft.imageAltEn.trim(),
                                ),
                                label: t(
                                  "admin.directory.content.check.altEn",
                                  "English image description",
                                ),
                              },
                              {
                                key: "alt-sq",
                                ready: Boolean(
                                  editorialDraft.imageAltSq.trim(),
                                ),
                                label: t(
                                  "admin.directory.content.check.altSq",
                                  "Albanian image description",
                                ),
                              },
                              {
                                key: "credit",
                                ready: Boolean(
                                  editorialDraft.imageAttributionLabel.trim(),
                                ),
                                label: t(
                                  "admin.directory.content.check.credit",
                                  "Public credit",
                                ),
                              },
                              {
                                key: "rights",
                                ready: Boolean(
                                  editorialDraft.imageRightsNote.trim(),
                                ),
                                label: t(
                                  "admin.directory.content.check.rights",
                                  "Private rights record",
                                ),
                              },
                            ].map((check) => (
                              <span
                                key={check.key}
                                className={check.ready ? "is-ready" : ""}
                              >
                                {check.ready ? (
                                  <CheckCircle2 size={14} aria-hidden="true" />
                                ) : (
                                  <i aria-hidden="true" />
                                )}
                                {check.label}
                              </span>
                            ))}
                          </div>
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

                {selectedPlace.listing_status === "active" &&
                  !selectedPlace.image_url && (
                    <DirectoryPhotoRequestKit
                      key={selectedPlace.id}
                      placeId={selectedPlace.id}
                      placeName={
                        selectedPlace.public_name || selectedPlace.name
                      }
                      phone={selectedPlace.public_phone || selectedPlace.phone}
                      email={selectedPlace.email}
                      website={
                        selectedPlace.public_website || selectedPlace.website
                      }
                      isPilot={priorityPhotoPilotIds.has(selectedPlace.id)}
                    />
                  )}

                <dl className="directory-facts">
                  <div>
                    <dt>{t("admin.directory.address", "Address")}</dt>
                    <dd>
                      {[
                        selectedPlace.address,
                        selectedPlace.city,
                        selectedPlace.region,
                        selectedPlace.postcode,
                      ]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("admin.directory.contact", "Source contact")}</dt>
                    <dd>
                      {[selectedPlace.phone, selectedPlace.email]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("admin.directory.website", "Website")}</dt>
                    <dd>
                      {safeWebsite(selectedPlace.website) ? (
                        <a
                          href={safeWebsite(selectedPlace.website) || "#"}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {selectedPlace.website}
                        </a>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      {t("admin.directory.sourceCategory", "Source category")}
                    </dt>
                    <dd>{selectedPlace.source_category || "—"}</dd>
                  </div>
                  <div>
                    <dt>{t("admin.directory.source", "Source")}</dt>
                    <dd>
                      {selectedPlace.source} ·{" "}
                      {selectedPlace.source_version || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      {t("admin.directory.confidence", "Source confidence")}
                    </dt>
                    <dd>
                      {typeof selectedPlace.source_confidence === "number"
                        ? `${Math.round(selectedPlace.source_confidence * 100)}%`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      {t(
                        "admin.directory.operatingStatus",
                        "Source operating status",
                      )}
                    </dt>
                    <dd>
                      {operatingStatusLabel(
                        selectedPlace.source_operating_status,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("admin.directory.claimStatus", "Claim status")}</dt>
                    <dd>{claimStatusLabel(selectedPlace.claim_status)}</dd>
                  </div>
                  <div>
                    <dt>
                      {t("admin.directory.sourceUpdated", "Source updated")}
                    </dt>
                    <dd>
                      {formatDate(selectedPlace.source_updated_at, locale)}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      {t("admin.directory.lastImported", "Last imported")}
                    </dt>
                    <dd>
                      {formatDate(selectedPlace.last_imported_at, locale)}
                    </dd>
                  </div>
                </dl>

                {sourceDatasets.length > 0 && (
                  <div className="directory-source-note">
                    <strong>
                      {t("admin.directory.provenance", "Source provenance")}
                    </strong>
                    <span>{sourceDatasets.join(" · ")}</span>
                  </div>
                )}

                {selectedPlace.latestReview && (
                  <div className="directory-review-history">
                    <strong>
                      {t("admin.directory.latestReview", "Latest review")}
                    </strong>
                    <span>
                      {actionLabel(selectedPlace.latestReview.action)} ·{" "}
                      {formatDate(
                        selectedPlace.latestReview.created_at,
                        locale,
                      )}
                    </span>
                    {selectedPlace.latestReview.notes && (
                      <p>{selectedPlace.latestReview.notes}</p>
                    )}
                  </div>
                )}

                <div className="directory-actions">
                  {selectedPlace.listing_status !== "active" && (
                    <button
                      type="button"
                      className="btn btn-accent"
                      onClick={() => beginAction("approve")}
                    >
                      {actionLabel("approve")}
                    </button>
                  )}
                  {selectedPlace.listing_status !== "needs_review" && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => beginAction("return_to_review")}
                    >
                      {actionLabel("return_to_review")}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => beginAction("hide")}
                  >
                    {actionLabel("hide")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => beginAction("close")}
                  >
                    {actionLabel("close")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => beginAction("mark_duplicate")}
                  >
                    {actionLabel("mark_duplicate")}
                  </button>
                </div>

                {pendingAction && (
                  <div className="directory-confirmation">
                    <div>
                      <p className="small muted">
                        {t("admin.directory.reviewDecision", "Review decision")}
                      </p>
                      <h3>{actionLabel(pendingAction)}</h3>
                    </div>
                    {pendingAction === "mark_duplicate" && (
                      <label>
                        <span>
                          {t(
                            "admin.directory.canonicalId",
                            "Canonical place ID",
                          )}
                        </span>
                        <input
                          value={duplicateOfPlaceId}
                          onChange={(event) =>
                            setDuplicateOfPlaceId(event.target.value)
                          }
                          placeholder="00000000-0000-0000-0000-000000000000"
                        />
                      </label>
                    )}
                    <label>
                      <span>
                        {t(
                          pendingAction === "approve" ||
                            pendingAction === "return_to_review"
                            ? "admin.directory.notesOptional"
                            : "admin.directory.notesRequired",
                          pendingAction === "approve" ||
                            pendingAction === "return_to_review"
                            ? "Review note (optional)"
                            : "Review note",
                        )}
                      </span>
                      <textarea
                        rows={3}
                        value={reviewNotes}
                        onChange={(event) => setReviewNotes(event.target.value)}
                        placeholder={t(
                          "admin.directory.notesPlaceholder",
                          "Record what you checked or why this state is appropriate.",
                        )}
                      />
                    </label>
                    <div className="directory-confirm-actions">
                      <button
                        type="button"
                        className="btn btn-accent"
                        onClick={submitAction}
                        disabled={saving}
                      >
                        {saving
                          ? t("admin.directory.saving", "Saving...")
                          : t("admin.directory.confirm", "Confirm decision")}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setPendingAction(null)}
                        disabled={saving}
                      >
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

        .directory-media {
          margin-top: 1rem;
          padding: 1rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
        }

        .directory-media-heading {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 1rem 2rem;
        }

        .directory-media-heading h2,
        .directory-media-heading p {
          margin: 0;
        }

        .directory-media-heading > p {
          max-width: 620px;
        }

        .directory-media-progress-line {
          display: flex;
          align-items: baseline;
          gap: 0.4rem;
          margin-top: 0.95rem;
        }

        .directory-media-progress-line strong {
          font-size: 1.1rem;
        }

        .directory-media-progress-line span,
        .directory-media-loading {
          color: var(--text-muted);
          font-size: 0.82rem;
        }

        .directory-media-progress {
          height: 6px;
          margin-top: 0.5rem;
          overflow: hidden;
          border-radius: 999px;
          background: var(--surface-2);
        }

        .directory-media-progress span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: var(--success);
        }

        .directory-media-actions {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.6rem;
          margin-top: 0.85rem;
        }

        .directory-media-action {
          min-width: 0;
          min-height: 54px;
          padding: 0.65rem 0.75rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-2);
          color: var(--text);
          display: flex;
          align-items: center;
          gap: 0.65rem;
          text-align: left;
        }

        .directory-media-action:hover,
        .directory-media-action.is-active {
          border-color: var(--accent);
          background: var(--accent-dim);
        }

        .directory-media-action :global(svg) {
          flex: 0 0 auto;
          color: var(--accent);
        }

        .directory-media-action span {
          min-width: 0;
          display: grid;
          color: var(--text-muted);
          font-size: 0.76rem;
        }

        .directory-media-action strong {
          color: var(--text);
          font-size: 1rem;
        }

        .directory-media-plan {
          display: grid;
          grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.25fr);
          gap: 1rem 1.5rem;
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border);
        }

        .directory-media-section-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .directory-media-section-heading h3,
        .directory-media-section-heading p,
        .directory-media-gap-groups h4 {
          margin: 0;
        }

        .directory-media-section-heading h3 {
          font-family: var(--font-body);
          font-size: 0.96rem;
        }

        .directory-media-section-heading :global(.btn) {
          flex: 0 0 auto;
          min-height: 44px;
        }

        .directory-media-gap-groups {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.9rem;
          margin-top: 0.75rem;
        }

        .directory-media-gap-groups h4 {
          color: var(--text-muted);
          font-size: 0.72rem;
          text-transform: uppercase;
        }

        .directory-media-gap-rows,
        .directory-media-priority-rows {
          display: grid;
          margin-top: 0.35rem;
        }

        .directory-media-gap-rows button,
        .directory-media-priority-row {
          width: 100%;
          min-width: 0;
          border: 0;
          border-bottom: 1px solid var(--border);
          border-radius: 0;
          background: transparent;
          color: var(--text);
          text-align: left;
        }

        .directory-media-gap-rows button {
          min-height: 44px;
          padding: 0.4rem 0.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }

        .directory-media-gap-rows button:hover,
        .directory-media-priority-row:hover {
          background: var(--surface-2);
        }

        .directory-media-gap-rows button span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .directory-media-gap-rows button strong {
          flex: 0 0 auto;
          color: var(--text-muted);
          font-size: 0.75rem;
        }

        .directory-media-priority-rows {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0 0.85rem;
          margin-top: 0.55rem;
        }

        .directory-media-priority-row {
          min-height: 92px;
          padding: 0.65rem 0.35rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.65rem;
        }

        .directory-media-priority-row > :global(svg) {
          flex: 0 0 auto;
          color: var(--text-muted);
        }

        .directory-media-priority-main {
          min-width: 0;
          display: grid;
          gap: 0.25rem;
        }

        .directory-media-priority-main strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 0.84rem;
        }

        .directory-media-priority-location {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          overflow: hidden;
          color: var(--text-muted);
          font-size: 0.72rem;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .directory-media-priority-location :global(svg) {
          flex: 0 0 auto;
        }

        .directory-media-reasons {
          display: flex;
          flex-wrap: wrap;
          gap: 0.18rem 0.4rem;
        }

        .directory-media-reasons small {
          color: var(--success);
          font-size: 0.64rem;
        }

        .directory-media-loading {
          min-height: 88px;
          display: flex;
          align-items: center;
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
          grid-template-columns:
            minmax(170px, 1.2fr) minmax(150px, 0.9fr) minmax(140px, 0.75fr)
            minmax(150px, 0.8fr) auto;
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

        .directory-row-side {
          flex: 0 0 auto;
          display: grid;
          justify-items: end;
          gap: 0.3rem;
        }

        .directory-media-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          color: var(--text-muted);
          font-size: 0.7rem;
          white-space: nowrap;
        }

        .directory-media-pill.has-photo {
          color: var(--success);
        }

        .directory-media-pill.needs-photo {
          color: var(--warning);
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

        .directory-content-heading-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
          gap: 0.45rem;
        }

        .directory-content-heading-actions :global(.directory-public-preview) {
          min-height: 44px;
          padding: 0.42rem 0.65rem;
          font-size: 0.75rem;
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
          position: relative;
          min-height: 0;
          aspect-ratio: 16 / 9;
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
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .directory-image-preview-label {
          position: absolute;
          top: 0.55rem;
          left: 0.55rem;
          z-index: 1;
          padding: 0.28rem 0.42rem;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.92);
          color: var(--text-muted);
          font-size: 0.65rem;
          font-weight: 750;
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

        .directory-media-readiness {
          display: flex;
          flex-wrap: wrap;
          gap: 0.3rem 0.7rem;
          padding: 0.55rem 0;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }

        .directory-media-readiness span {
          display: flex;
          align-items: center;
          gap: 0.28rem;
          color: var(--text-muted);
          font-size: 0.7rem;
        }

        .directory-media-readiness span.is-ready {
          color: var(--success);
        }

        .directory-media-readiness i {
          width: 12px;
          height: 12px;
          border: 1px solid var(--border-2);
          border-radius: 50%;
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

          .directory-media-heading {
            align-items: start;
          }

          .directory-media-plan {
            grid-template-columns: 1fr;
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
          .directory-coverage-heading,
          .directory-media-heading,
          .directory-media-section-heading {
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
          .directory-coverage-groups,
          .directory-media-gap-groups,
          .directory-media-priority-rows {
            grid-template-columns: 1fr;
          }

          .directory-media-actions {
            grid-template-columns: 1fr;
          }

          .directory-content-heading {
            display: grid;
          }

          .directory-content-heading-actions {
            justify-content: flex-start;
          }

          .directory-media-section-heading :global(.btn) {
            width: 100%;
            justify-content: center;
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

          .directory-row-side {
            justify-items: end;
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
