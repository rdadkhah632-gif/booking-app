import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Clock3,
  ExternalLink,
  Image as ImageIcon,
  ListChecks,
  MapPin,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import AuthNav from "@/components/AuthNav";
import OnboardingEntitySearch, {
  OnboardingSuggestion,
} from "@/components/admin/OnboardingEntitySearch";
import OnboardingHandoffPanel from "@/components/admin/OnboardingHandoffPanel";
import PreparedProfilePanel from "@/components/admin/PreparedProfilePanel";
import { getAdminLoginHref } from "@/lib/auth/getAdminLoginHref";
import { getStableBrowserSession } from "@/lib/auth/getStableBrowserSession";
import { getBusinessAppUrl, getCustomerAppUrl } from "@/lib/appUrls";
import { useI18n } from "@/lib/useI18n";

const STATUSES = [
  "new",
  "contacted",
  "interested",
  "assets_requested",
  "assets_received",
  "draft_prepared",
  "invite_sent",
  "claimed",
  "ready_to_publish",
  "live",
  "paused",
  "declined",
] as const;
const ASSET_STATUSES = [
  "not_requested",
  "requested",
  "partial",
  "received",
  "reviewed",
] as const;
const PERMISSION_SOURCES = [
  "email",
  "social_message",
  "written_form",
  "phone",
  "in_person",
  "other",
] as const;
const CATEGORY_KEYS = [
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
] as const;

type OnboardingStatus = (typeof STATUSES)[number];
type AssetsStatus = (typeof ASSET_STATUSES)[number];
type PermissionSource = (typeof PERMISSION_SOURCES)[number];
type StatusFilter = OnboardingStatus | "all";

type OnboardingCase = {
  id: string;
  directory_place_id?: string | null;
  business_id?: string | null;
  prospect_name: string;
  category_key?: string | null;
  city?: string | null;
  address?: string | null;
  website?: string | null;
  social_url?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  owner_phone?: string | null;
  preferred_language: "en" | "sq";
  status: OnboardingStatus;
  listing_interest: boolean;
  booking_interest: boolean;
  business_app_interest: boolean;
  assets_status: AssetsStatus;
  profile_media_permission: boolean;
  marketing_media_permission: boolean;
  permission_source?: PermissionSource | null;
  permission_granted_by?: string | null;
  permission_note?: string | null;
  permission_granted_at?: string | null;
  private_notes?: string | null;
  created_at: string;
  updated_at: string;
};

type OnboardingEvent = {
  id: string;
  case_id: string;
  from_status?: OnboardingStatus | null;
  to_status: OnboardingStatus;
  action: string;
  created_at: string;
};

type OnboardingPayload = {
  storageAvailable: boolean;
  sqlRequired?: string | null;
  cases: OnboardingCase[];
  selectedCase?: OnboardingCase | null;
  suggestions: OnboardingSuggestion[];
  events: OnboardingEvent[];
  counts: Record<OnboardingStatus, number>;
  error?: string;
};

type Draft = {
  caseId: string;
  directoryPlaceId: string;
  businessId: string;
  prospectName: string;
  categoryKey: string;
  city: string;
  address: string;
  website: string;
  socialUrl: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  preferredLanguage: "en" | "sq";
  status: OnboardingStatus;
  listingInterest: boolean;
  bookingInterest: boolean;
  businessAppInterest: boolean;
  assetsStatus: AssetsStatus;
  profileMediaPermission: boolean;
  marketingMediaPermission: boolean;
  permissionSource: PermissionSource | "";
  permissionGrantedBy: string;
  permissionNote: string;
  permissionGrantedAt: string;
  permissionConfirmed: boolean;
  privateNotes: string;
};

const EMPTY_COUNTS = Object.fromEntries(
  STATUSES.map((status) => [status, 0]),
) as Record<OnboardingStatus, number>;

function todayInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

const EMPTY_DRAFT: Draft = {
  caseId: "",
  directoryPlaceId: "",
  businessId: "",
  prospectName: "",
  categoryKey: "",
  city: "",
  address: "",
  website: "",
  socialUrl: "",
  ownerName: "",
  ownerEmail: "",
  ownerPhone: "",
  preferredLanguage: "sq",
  status: "new",
  listingInterest: true,
  bookingInterest: false,
  businessAppInterest: false,
  assetsStatus: "not_requested",
  profileMediaPermission: false,
  marketingMediaPermission: false,
  permissionSource: "",
  permissionGrantedBy: "",
  permissionNote: "",
  permissionGrantedAt: todayInputValue(),
  permissionConfirmed: false,
  privateNotes: "",
};

function caseToDraft(item: OnboardingCase): Draft {
  return {
    caseId: item.id,
    directoryPlaceId: item.directory_place_id || "",
    businessId: item.business_id || "",
    prospectName: item.prospect_name,
    categoryKey: item.category_key || "",
    city: item.city || "",
    address: item.address || "",
    website: item.website || "",
    socialUrl: item.social_url || "",
    ownerName: item.owner_name || "",
    ownerEmail: item.owner_email || "",
    ownerPhone: item.owner_phone || "",
    preferredLanguage: item.preferred_language,
    status: item.status,
    listingInterest: item.listing_interest,
    bookingInterest: item.booking_interest,
    businessAppInterest: item.business_app_interest,
    assetsStatus: item.assets_status,
    profileMediaPermission: item.profile_media_permission,
    marketingMediaPermission: item.marketing_media_permission,
    permissionSource: item.permission_source || "",
    permissionGrantedBy: item.permission_granted_by || "",
    permissionNote: item.permission_note || "",
    permissionGrantedAt:
      item.permission_granted_at?.slice(0, 10) || todayInputValue(),
    permissionConfirmed: Boolean(
      item.profile_media_permission || item.marketing_media_permission,
    ),
    privateNotes: item.private_notes || "",
  };
}

function suggestionToDraft(suggestion: OnboardingSuggestion): Draft {
  return {
    ...EMPTY_DRAFT,
    directoryPlaceId: suggestion.type === "directory" ? suggestion.id : "",
    businessId:
      suggestion.type === "business"
        ? suggestion.id
        : suggestion.linkedBusinessId || "",
    prospectName: suggestion.name,
    categoryKey: suggestion.categoryKey || "",
    city: suggestion.city || "",
    address: suggestion.address || "",
    website: suggestion.website || "",
    socialUrl: suggestion.socialUrl || "",
    ownerName: suggestion.ownerName || "",
    ownerEmail: suggestion.email || "",
    ownerPhone: suggestion.phone || "",
  };
}

function formatDate(value: string, locale: "en" | "sq") {
  return new Intl.DateTimeFormat(locale === "sq" ? "sq-AL" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AdminOnboardingPage() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const requestId = useRef(0);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [savedProfileMediaPermission, setSavedProfileMediaPermission] =
    useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [suggestions, setSuggestions] = useState<OnboardingSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] =
    useState<OnboardingSuggestion | null>(null);
  const [cases, setCases] = useState<OnboardingCase[]>([]);
  const [events, setEvents] = useState<OnboardingEvent[]>([]);
  const [counts, setCounts] =
    useState<Record<OnboardingStatus, number>>(EMPTY_COUNTS);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editorOpen, setEditorOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const totalCases = useMemo(
    () => Object.values(counts).reduce((sum, count) => sum + count, 0),
    [counts],
  );
  const activeCases = useMemo(
    () => totalCases - counts.live - counts.paused - counts.declined,
    [counts, totalCases],
  );
  const readyCases = counts.claimed + counts.ready_to_publish + counts.live;
  const hasMediaPermission =
    draft.profileMediaPermission || draft.marketingMediaPermission;

  function statusLabel(value: string) {
    const keys: Record<string, [string, string]> = {
      new: ["admin.onboarding.status.new", "New"],
      contacted: ["admin.onboarding.status.contacted", "Contacted"],
      interested: ["admin.onboarding.status.interested", "Interested"],
      assets_requested: [
        "admin.onboarding.status.assetsRequested",
        "Assets requested",
      ],
      assets_received: [
        "admin.onboarding.status.assetsReceived",
        "Assets received",
      ],
      draft_prepared: [
        "admin.onboarding.status.draftPrepared",
        "Draft prepared",
      ],
      invite_sent: ["admin.onboarding.status.inviteSent", "Invite sent"],
      claimed: ["admin.onboarding.status.claimed", "Claimed"],
      ready_to_publish: ["admin.onboarding.status.ready", "Ready to publish"],
      live: ["admin.onboarding.status.live", "Live"],
      paused: ["admin.onboarding.status.paused", "Paused"],
      declined: ["admin.onboarding.status.declined", "Declined"],
    };
    const [key, fallback] = keys[value] || [value, value];
    return t(key, fallback);
  }

  function assetLabel(value: string) {
    const keys: Record<string, [string, string]> = {
      not_requested: ["admin.onboarding.assets.notRequested", "Not requested"],
      requested: ["admin.onboarding.assets.requested", "Requested"],
      partial: ["admin.onboarding.assets.partial", "Part received"],
      received: ["admin.onboarding.assets.received", "Received"],
      reviewed: ["admin.onboarding.assets.reviewed", "Reviewed"],
    };
    const [key, fallback] = keys[value] || [value, value];
    return t(key, fallback);
  }

  function categoryLabel(value: string) {
    if (!value) return t("admin.onboarding.category.choose", "Choose category");
    return t(`directory.category.${value}`, value.replaceAll("_", " "));
  }

  function nextAction(status: OnboardingStatus) {
    const actions: Record<OnboardingStatus, [string, string]> = {
      new: [
        "admin.onboarding.next.new",
        "Verify a contact route and make the first approach.",
      ],
      contacted: [
        "admin.onboarding.next.contacted",
        "Record their interest and agree the next useful step.",
      ],
      interested: [
        "admin.onboarding.next.interested",
        "Request services, hours and permitted profile media.",
      ],
      assets_requested: [
        "admin.onboarding.next.assetsRequested",
        "Follow up for the missing profile details or media.",
      ],
      assets_received: [
        "admin.onboarding.next.assetsReceived",
        "Review the supplied material and prepare the profile.",
      ],
      draft_prepared: [
        "admin.onboarding.next.draftPrepared",
        "Review the draft with the owner before handoff.",
      ],
      invite_sent: [
        "admin.onboarding.next.inviteSent",
        "Wait for the owner to link their account, then assist setup.",
      ],
      claimed: [
        "admin.onboarding.next.claimed",
        "Help complete services, staff and availability.",
      ],
      ready_to_publish: [
        "admin.onboarding.next.ready",
        "Perform the final owner-approved publication check.",
      ],
      live: [
        "admin.onboarding.next.live",
        "Confirm the live profile and monitor the first bookings.",
      ],
      paused: [
        "admin.onboarding.next.paused",
        "Keep the case private until a new follow-up is agreed.",
      ],
      declined: [
        "admin.onboarding.next.declined",
        "Keep the outcome recorded and do not continue contact.",
      ],
    };
    const [key, fallback] = actions[status];
    return t(key, fallback);
  }

  function localApiError(message: string) {
    const errors: Record<string, [string, string]> = {
      "Choose a valid onboarding case.": [
        "admin.onboarding.error.case",
        "Choose a valid onboarding case.",
      ],
      "Choose a valid directory place.": [
        "admin.onboarding.error.place",
        "Choose a valid directory place.",
      ],
      "Choose a valid business profile.": [
        "admin.onboarding.error.business",
        "Choose a valid business profile.",
      ],
      "Add the business or prospect name.": [
        "admin.onboarding.error.name",
        "Add the business or prospect name.",
      ],
      "Use a secure HTTPS website URL.": [
        "admin.onboarding.error.website",
        "Use a secure HTTPS website URL.",
      ],
      "Use a secure HTTPS social URL.": [
        "admin.onboarding.error.social",
        "Use a secure HTTPS social URL.",
      ],
      "Enter a valid owner email.": [
        "admin.onboarding.error.email",
        "Enter a valid owner email.",
      ],
      "Choose at least one onboarding goal.": [
        "admin.onboarding.error.goal",
        "Choose at least one onboarding goal.",
      ],
      "Confirm who granted media permission and how it was received.": [
        "admin.onboarding.error.permission",
        "Confirm who granted media permission and how it was received.",
      ],
      "Choose a valid permission date.": [
        "admin.onboarding.error.permissionDate",
        "Choose a valid permission date.",
      ],
    };
    const [key, fallback] = errors[message] || [
      "admin.onboarding.error.save",
      "The onboarding case could not be saved.",
    ];
    return t(key, fallback);
  }

  async function fetchOnboarding(
    query: string,
    filter: StatusFilter,
    caseId = "",
  ) {
    const currentRequestId = ++requestId.current;
    if (!ready) setLoading(true);
    else if (query.length >= 2) setSearching(true);
    setError("");

    try {
      const session = await getStableBrowserSession();
      if (!session) {
        router.replace(getAdminLoginHref(router.asPath, "/admin/onboarding"));
        return null;
      }
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (filter !== "all") params.set("status", filter);
      if (caseId) params.set("caseId", caseId);
      const response = await fetch(`/api/admin/onboarding?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = (await response.json()) as OnboardingPayload;
      if (!response.ok) throw new Error(payload.error || "load_failed");
      if (currentRequestId !== requestId.current) return null;
      setReady(true);
      setStorageAvailable(payload.storageAvailable);
      setCases(payload.cases || []);
      setSuggestions(payload.suggestions || []);
      setCounts(payload.counts || EMPTY_COUNTS);
      if (caseId) {
        setEvents(payload.events || []);
        const selectedCase =
          payload.selectedCase ||
          payload.cases.find((item) => item.id === caseId);
        setSavedProfileMediaPermission(
          selectedCase?.profile_media_permission === true,
        );
      }
      return payload;
    } catch {
      if (currentRequestId !== requestId.current) return null;
      setError(
        t(
          "admin.onboarding.error.load",
          "The assisted onboarding workspace could not be loaded.",
        ),
      );
      return null;
    } finally {
      if (currentRequestId === requestId.current) {
        setLoading(false);
        setSearching(false);
      }
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 260);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!router.isReady) return;
    void fetchOnboarding(debouncedSearch, statusFilter);
  }, [router.isReady, debouncedSearch, statusFilter]);

  async function selectSuggestion(suggestion: OnboardingSuggestion) {
    setSelectedSuggestion(suggestion);
    setSearch(suggestion.name);
    setSuccess("");
    setError("");
    setEditorOpen(true);
    if (suggestion.caseId) {
      const payload = await fetchOnboarding("", "all", suggestion.caseId);
      const selectedCase =
        payload?.selectedCase ||
        payload?.cases.find((item) => item.id === suggestion.caseId);
      if (selectedCase) setDraft(caseToDraft(selectedCase));
      return;
    }
    setEvents([]);
    setDraft(suggestionToDraft(suggestion));
  }

  function startProspect(name: string) {
    setSelectedSuggestion({
      type: "onboarding",
      id: "new",
      name,
      state: "new",
    });
    setSearch(name);
    setDraft({ ...EMPTY_DRAFT, prospectName: name });
    setSavedProfileMediaPermission(false);
    setEvents([]);
    setEditorOpen(true);
    setError("");
    setSuccess("");
  }

  async function openCase(item: OnboardingCase) {
    setSelectedSuggestion({
      type: "onboarding",
      id: item.id,
      name: item.prospect_name,
      city: item.city,
      categoryKey: item.category_key,
      state: item.status,
      caseId: item.id,
      onboardingStatus: item.status,
      linkedBusinessId: item.business_id,
    });
    setSearch(item.prospect_name);
    setDraft(caseToDraft(item));
    setSavedProfileMediaPermission(item.profile_media_permission === true);
    setEditorOpen(true);
    setError("");
    setSuccess("");
    await fetchOnboarding("", "all", item.id);
  }

  function clearSelection() {
    setSelectedSuggestion(null);
    setSearch("");
    setDraft(EMPTY_DRAFT);
    setSavedProfileMediaPermission(false);
    setEvents([]);
    setEditorOpen(false);
    setError("");
    setSuccess("");
  }

  function updateDraft<Key extends keyof Draft>(key: Key, value: Draft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSuccess("");
  }

  async function saveCase(event: FormEvent) {
    event.preventDefault();
    if (!storageAvailable || saving) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const session = await getStableBrowserSession();
      if (!session) {
        router.replace(getAdminLoginHref(router.asPath, "/admin/onboarding"));
        return;
      }
      const response = await fetch("/api/admin/onboarding", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });
      const payload = (await response.json()) as {
        case?: OnboardingCase | null;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "save_failed");
      if (!payload.case) throw new Error("save_failed");
      setDraft(caseToDraft(payload.case));
      setSavedProfileMediaPermission(
        payload.case.profile_media_permission === true,
      );
      setSelectedSuggestion((current) => ({
        type: "onboarding",
        id: payload.case?.id || current?.id || "",
        name: payload.case?.prospect_name || current?.name || "",
        city: payload.case?.city,
        categoryKey: payload.case?.category_key,
        state: payload.case?.status || "new",
        caseId: payload.case?.id,
        onboardingStatus: payload.case?.status,
        linkedBusinessId: payload.case?.business_id,
      }));
      setSearch(payload.case.prospect_name);
      setSuccess(
        t("admin.onboarding.success", "Private onboarding case saved."),
      );
      await fetchOnboarding("", "all", payload.case.id);
    } catch (saveError) {
      setError(
        localApiError(
          saveError instanceof Error ? saveError.message : "save_failed",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  if (!ready) {
    return (
      <main>
        <AuthNav />
        <section className="container onboarding-access-state">
          <div className="card">
            <h1>
              {loading
                ? t("common.loadingAccount", "Checking account...")
                : t("admin.outreach.adminOnlyTitle", "Admin only")}
            </h1>
            {!loading && (
              <p className="muted">
                {t("admin.outreach.adminOnly", "Admin access is required.")}
              </p>
            )}
          </div>
        </section>
        <style jsx>{`
          .onboarding-access-state {
            padding-top: 3rem;
            padding-bottom: 4rem;
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="onboarding-page">
      <Head>
        <title>
          {t("admin.onboarding.metaTitle", "Assisted onboarding | Mirëbook")}
        </title>
      </Head>
      <AuthNav contextRole="admin" />
      <section className="container onboarding-shell">
        <header className="page-header">
          <div>
            <span>{t("admin.onboarding.kicker", "Launch partners")}</span>
            <h1>{t("admin.onboarding.title", "Assisted onboarding")}</h1>
            <p>
              {t(
                "admin.onboarding.subtitle",
                "Find the business first, then prepare one clear path from discovery to an owner-managed profile.",
              )}
            </p>
          </div>
          <div className="header-actions">
            <Link href="/admin/outreach" className="btn btn-ghost">
              {t("admin.onboarding.openOutreach", "Open outreach")}
            </Link>
            <button
              type="button"
              className="btn btn-ghost icon-action"
              onClick={() =>
                void fetchOnboarding(debouncedSearch, statusFilter)
              }
              aria-label={t("common.refresh", "Refresh")}
            >
              <RefreshCw aria-hidden="true" />
            </button>
          </div>
        </header>

        <section className="search-band">
          <div className="search-heading">
            <Sparkles aria-hidden="true" />
            <div>
              <h2>
                {t(
                  "admin.onboarding.searchTitle",
                  "Search before creating anything",
                )}
              </h2>
              <p>
                {t(
                  "admin.onboarding.searchBody",
                  "Match public places, Mirëbook businesses, owner details and existing onboarding cases.",
                )}
              </p>
            </div>
          </div>
          <OnboardingEntitySearch
            value={search}
            suggestions={suggestions}
            loading={searching}
            selected={selectedSuggestion}
            copy={{
              label: t("admin.onboarding.search.label", "Business search"),
              placeholder: t(
                "admin.onboarding.search.placeholder",
                "Name, city, address, phone or owner email",
              ),
              hint: t(
                "admin.onboarding.search.hint",
                "Suggestions appear after two characters. Use the existing record whenever it matches.",
              ),
              searching: t(
                "admin.onboarding.search.searching",
                "Finding possible matches...",
              ),
              noMatches: t(
                "admin.onboarding.search.noMatches",
                "No existing match found.",
              ),
              directory: t("admin.onboarding.search.directory", "Local place"),
              business: t(
                "admin.onboarding.search.business",
                "Mirëbook business",
              ),
              onboarding: t(
                "admin.onboarding.search.onboarding",
                "Onboarding case",
              ),
              existingCase: t(
                "admin.onboarding.search.existingCase",
                "Case in progress",
              ),
              newProspect: t(
                "admin.onboarding.search.newProspect",
                "Start a new prospect",
              ),
              clear: t("admin.onboarding.search.clear", "Clear selection"),
              stateLabels: {
                needs_review: t(
                  "admin.directory.status.needsReview",
                  "Needs review",
                ),
                active: t("admin.directory.status.active", "Approved"),
                hidden: t("admin.directory.status.hidden", "Hidden"),
                closed: t("admin.directory.status.closed", "Closed"),
                duplicate: t("admin.directory.status.duplicate", "Duplicate"),
                published: t("admin.onboarding.search.published", "Published"),
                draft: t("admin.onboarding.search.draft", "Draft"),
                ...Object.fromEntries(
                  STATUSES.map((status) => [status, statusLabel(status)]),
                ),
              },
            }}
            onChange={(value) => {
              setSelectedSuggestion(null);
              setSearch(value);
              setEditorOpen(false);
            }}
            onSelect={(suggestion) => void selectSuggestion(suggestion)}
            onCreate={startProspect}
            onClear={clearSelection}
          />
        </section>

        {!storageAvailable && (
          <div className="notice warning" role="status">
            <ShieldCheck aria-hidden="true" />
            <div>
              <strong>
                {t(
                  "admin.onboarding.storage.title",
                  "Assisted onboarding storage is not ready",
                )}
              </strong>
              <p>
                {t(
                  "admin.onboarding.storage.body",
                  "Run SQL 38 to enable private cases. Smart search remains read-only until then.",
                )}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        {success && (
          <div className="notice success" role="status">
            {success}
          </div>
        )}

        <section
          className="summary-strip"
          aria-label={t("admin.onboarding.summary", "Onboarding summary")}
        >
          <div>
            <span>{totalCases}</span>
            <small>{t("admin.onboarding.total", "Total cases")}</small>
          </div>
          <div>
            <span>{activeCases}</span>
            <small>{t("admin.onboarding.active", "In progress")}</small>
          </div>
          <div>
            <span>{readyCases}</span>
            <small>
              {t("admin.onboarding.readyCount", "Claimed or ready")}
            </small>
          </div>
          <div>
            <span>{counts.live}</span>
            <small>{t("admin.onboarding.liveCount", "Live")}</small>
          </div>
        </section>

        <div className="workbench">
          <aside className="case-queue">
            <div className="section-heading">
              <div>
                <span>
                  {t("admin.onboarding.queue.kicker", "Private queue")}
                </span>
                <h2>{t("admin.onboarding.queue.title", "Onboarding cases")}</h2>
              </div>
              <select
                value={statusFilter}
                aria-label={t(
                  "admin.onboarding.filterStatus",
                  "Filter by status",
                )}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
              >
                <option value="all">
                  {t("admin.onboarding.status.all", "All statuses")}
                </option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)} ({counts[status]})
                  </option>
                ))}
              </select>
            </div>

            <div className="queue-list">
              {loading && !ready && (
                <div className="queue-empty">
                  {t("admin.onboarding.loading", "Loading onboarding cases...")}
                </div>
              )}
              {!loading && cases.length === 0 && (
                <div className="queue-empty">
                  <ListChecks aria-hidden="true" />
                  <strong>
                    {t(
                      "admin.onboarding.queue.emptyTitle",
                      "No cases here yet",
                    )}
                  </strong>
                  <p>
                    {t(
                      "admin.onboarding.queue.emptyBody",
                      "Use the smart search above to attach a place, business or new prospect.",
                    )}
                  </p>
                </div>
              )}
              {cases.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={draft.caseId === item.id ? "selected" : ""}
                  onClick={() => void openCase(item)}
                >
                  <span className="queue-row-top">
                    <strong>{item.prospect_name}</strong>
                    <em>{statusLabel(item.status)}</em>
                  </span>
                  <small>
                    {[
                      item.city,
                      item.category_key
                        ? categoryLabel(item.category_key)
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                  <span className="queue-meta">
                    {item.business_id && (
                      <span>
                        <Building2 aria-hidden="true" />
                        {t(
                          "admin.onboarding.linkedBusiness",
                          "Business linked",
                        )}
                      </span>
                    )}
                    {item.directory_place_id && (
                      <span>
                        <MapPin aria-hidden="true" />
                        {t("admin.onboarding.linkedPlace", "Place linked")}
                      </span>
                    )}
                    <span>
                      <Clock3 aria-hidden="true" />
                      {formatDate(item.updated_at, locale)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <section className="case-editor">
            {!editorOpen ? (
              <div className="editor-empty">
                <Building2 aria-hidden="true" />
                <h2>
                  {t(
                    "admin.onboarding.editor.emptyTitle",
                    "Choose the right record",
                  )}
                </h2>
                <p>
                  {t(
                    "admin.onboarding.editor.emptyBody",
                    "Search first or open a case from the queue. Nothing is created or published until you deliberately save and complete the owner handoff.",
                  )}
                </p>
              </div>
            ) : (
              <form onSubmit={saveCase}>
                <header className="editor-header">
                  <div>
                    <span>
                      {draft.caseId
                        ? t("admin.onboarding.editor.existing", "Existing case")
                        : t("admin.onboarding.editor.new", "New private case")}
                    </span>
                    <h2>{draft.prospectName}</h2>
                    <p>{nextAction(draft.status)}</p>
                  </div>
                  <div className="status-badge">
                    {statusLabel(draft.status)}
                  </div>
                </header>

                <section className="form-section">
                  <div className="form-section-heading">
                    <Building2 aria-hidden="true" />
                    <div>
                      <h3>
                        {t("admin.onboarding.record.title", "Business record")}
                      </h3>
                      <p>
                        {t(
                          "admin.onboarding.record.body",
                          "Keep the working details accurate before an owner reviews them.",
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="form-grid two">
                    <label>
                      <span>{t("admin.onboarding.name", "Business name")}</span>
                      <input
                        required
                        value={draft.prospectName}
                        onChange={(event) =>
                          updateDraft("prospectName", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span>{t("admin.onboarding.category", "Category")}</span>
                      <select
                        value={draft.categoryKey}
                        onChange={(event) =>
                          updateDraft("categoryKey", event.target.value)
                        }
                      >
                        <option value="">
                          {t(
                            "admin.onboarding.category.choose",
                            "Choose category",
                          )}
                        </option>
                        {CATEGORY_KEYS.map((key) => (
                          <option key={key} value={key}>
                            {categoryLabel(key)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>{t("admin.onboarding.city", "City")}</span>
                      <input
                        value={draft.city}
                        onChange={(event) =>
                          updateDraft("city", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span>{t("admin.onboarding.address", "Address")}</span>
                      <input
                        value={draft.address}
                        onChange={(event) =>
                          updateDraft("address", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span>{t("admin.onboarding.website", "Website")}</span>
                      <input
                        type="url"
                        inputMode="url"
                        placeholder="https://"
                        value={draft.website}
                        onChange={(event) =>
                          updateDraft("website", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span>
                        {t("admin.onboarding.social", "Social profile")}
                      </span>
                      <input
                        type="url"
                        inputMode="url"
                        placeholder="https://"
                        value={draft.socialUrl}
                        onChange={(event) =>
                          updateDraft("socialUrl", event.target.value)
                        }
                      />
                    </label>
                  </div>
                </section>

                <section className="form-section">
                  <div className="form-section-heading">
                    <UserRound aria-hidden="true" />
                    <div>
                      <h3>
                        {t("admin.onboarding.owner.title", "Owner contact")}
                      </h3>
                      <p>
                        {t(
                          "admin.onboarding.owner.body",
                          "Private contact details for assisted setup and handoff.",
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="form-grid two">
                    <label>
                      <span>
                        {t("admin.onboarding.ownerName", "Owner or manager")}
                      </span>
                      <input
                        value={draft.ownerName}
                        onChange={(event) =>
                          updateDraft("ownerName", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span>{t("admin.onboarding.ownerEmail", "Email")}</span>
                      <input
                        type="email"
                        inputMode="email"
                        value={draft.ownerEmail}
                        onChange={(event) =>
                          updateDraft("ownerEmail", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span>{t("admin.onboarding.ownerPhone", "Phone")}</span>
                      <input
                        type="tel"
                        inputMode="tel"
                        value={draft.ownerPhone}
                        onChange={(event) =>
                          updateDraft("ownerPhone", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span>
                        {t("admin.onboarding.language", "Preferred language")}
                      </span>
                      <select
                        value={draft.preferredLanguage}
                        onChange={(event) =>
                          updateDraft(
                            "preferredLanguage",
                            event.target.value as "en" | "sq",
                          )
                        }
                      >
                        <option value="sq">Shqip</option>
                        <option value="en">English</option>
                      </select>
                    </label>
                  </div>
                </section>

                <section className="form-section split-section">
                  <div>
                    <div className="form-section-heading compact">
                      <ListChecks aria-hidden="true" />
                      <div>
                        <h3>
                          {t("admin.onboarding.goal.title", "Onboarding goals")}
                        </h3>
                        <p>
                          {t(
                            "admin.onboarding.goal.body",
                            "Record only what the business is interested in.",
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="choice-list">
                      <label>
                        <input
                          type="checkbox"
                          checked={draft.listingInterest}
                          onChange={(event) =>
                            updateDraft("listingInterest", event.target.checked)
                          }
                        />
                        <span>
                          <strong>
                            {t(
                              "admin.onboarding.goal.listing",
                              "Discovery listing",
                            )}
                          </strong>
                          <small>
                            {t(
                              "admin.onboarding.goal.listingBody",
                              "Public details that help customers find the place.",
                            )}
                          </small>
                        </span>
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={draft.bookingInterest}
                          onChange={(event) =>
                            updateDraft("bookingInterest", event.target.checked)
                          }
                        />
                        <span>
                          <strong>
                            {t(
                              "admin.onboarding.goal.booking",
                              "Online bookings",
                            )}
                          </strong>
                          <small>
                            {t(
                              "admin.onboarding.goal.bookingBody",
                              "Services, staff and availability for customer booking.",
                            )}
                          </small>
                        </span>
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={draft.businessAppInterest}
                          onChange={(event) =>
                            updateDraft(
                              "businessAppInterest",
                              event.target.checked,
                            )
                          }
                        />
                        <span>
                          <strong>
                            {t(
                              "admin.onboarding.goal.app",
                              "Mirëbook Business app",
                            )}
                          </strong>
                          <small>
                            {t(
                              "admin.onboarding.goal.appBody",
                              "Mobile calendar and day-to-day business management.",
                            )}
                          </small>
                        </span>
                      </label>
                    </div>
                  </div>
                  <div className="status-fields">
                    <label>
                      <span>
                        {t("admin.onboarding.statusLabel", "Case status")}
                      </span>
                      <select
                        value={draft.status}
                        onChange={(event) =>
                          updateDraft(
                            "status",
                            event.target.value as OnboardingStatus,
                          )
                        }
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {statusLabel(status)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>
                        {t("admin.onboarding.assetsLabel", "Profile assets")}
                      </span>
                      <select
                        value={draft.assetsStatus}
                        onChange={(event) =>
                          updateDraft(
                            "assetsStatus",
                            event.target.value as AssetsStatus,
                          )
                        }
                      >
                        {ASSET_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {assetLabel(status)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="next-action">
                      <ArrowRight aria-hidden="true" />
                      <span>
                        <small>
                          {t(
                            "admin.onboarding.nextAction",
                            "Suggested next action",
                          )}
                        </small>
                        <strong>{nextAction(draft.status)}</strong>
                      </span>
                    </div>
                  </div>
                </section>

                <section className="form-section permission-section">
                  <div className="form-section-heading">
                    <ImageIcon aria-hidden="true" />
                    <div>
                      <h3>
                        {t(
                          "admin.onboarding.permission.title",
                          "Media permission",
                        )}
                      </h3>
                      <p>
                        {t(
                          "admin.onboarding.permission.body",
                          "Profile use and Mirëbook marketing are separate permissions. Never infer one from the other.",
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="choice-list permission-choices">
                    <label>
                      <input
                        type="checkbox"
                        checked={draft.profileMediaPermission}
                        onChange={(event) =>
                          updateDraft(
                            "profileMediaPermission",
                            event.target.checked,
                          )
                        }
                      />
                      <span>
                        <strong>
                          {t(
                            "admin.onboarding.permission.profile",
                            "Use on the business profile",
                          )}
                        </strong>
                        <small>
                          {t(
                            "admin.onboarding.permission.profileBody",
                            "Photos may appear on the business or service profile.",
                          )}
                        </small>
                      </span>
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={draft.marketingMediaPermission}
                        onChange={(event) =>
                          updateDraft(
                            "marketingMediaPermission",
                            event.target.checked,
                          )
                        }
                      />
                      <span>
                        <strong>
                          {t(
                            "admin.onboarding.permission.marketing",
                            "Use in Mirëbook promotion",
                          )}
                        </strong>
                        <small>
                          {t(
                            "admin.onboarding.permission.marketingBody",
                            "Photos may appear in Mirëbook social or promotional content.",
                          )}
                        </small>
                      </span>
                    </label>
                  </div>

                  {hasMediaPermission && (
                    <div className="permission-details">
                      <div className="form-grid two">
                        <label>
                          <span>
                            {t(
                              "admin.onboarding.permission.source",
                              "Permission received via",
                            )}
                          </span>
                          <select
                            required
                            value={draft.permissionSource}
                            onChange={(event) =>
                              updateDraft(
                                "permissionSource",
                                event.target.value as PermissionSource,
                              )
                            }
                          >
                            <option value="">
                              {t(
                                "admin.onboarding.permission.chooseSource",
                                "Choose source",
                              )}
                            </option>
                            {PERMISSION_SOURCES.map((source) => (
                              <option key={source} value={source}>
                                {t(
                                  `admin.onboarding.permission.source.${source}`,
                                  source.replaceAll("_", " "),
                                )}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>
                            {t(
                              "admin.onboarding.permission.grantedBy",
                              "Permission granted by",
                            )}
                          </span>
                          <input
                            required
                            value={draft.permissionGrantedBy}
                            onChange={(event) =>
                              updateDraft(
                                "permissionGrantedBy",
                                event.target.value,
                              )
                            }
                          />
                        </label>
                        <label>
                          <span>
                            {t(
                              "admin.onboarding.permission.date",
                              "Confirmed on",
                            )}
                          </span>
                          <input
                            required
                            type="date"
                            value={draft.permissionGrantedAt}
                            onChange={(event) =>
                              updateDraft(
                                "permissionGrantedAt",
                                event.target.value,
                              )
                            }
                          />
                        </label>
                        <label>
                          <span>
                            {t(
                              "admin.onboarding.permission.note",
                              "Permission note",
                            )}
                          </span>
                          <input
                            value={draft.permissionNote}
                            placeholder={t(
                              "admin.onboarding.permission.notePlaceholder",
                              "What was agreed and where the evidence is kept",
                            )}
                            onChange={(event) =>
                              updateDraft("permissionNote", event.target.value)
                            }
                          />
                        </label>
                      </div>
                      <label className="confirm-row">
                        <input
                          required
                          type="checkbox"
                          checked={draft.permissionConfirmed}
                          onChange={(event) =>
                            updateDraft(
                              "permissionConfirmed",
                              event.target.checked,
                            )
                          }
                        />
                        <span>
                          {t(
                            "admin.onboarding.permission.confirm",
                            "I have evidence of this permission and selected only the uses that were explicitly approved.",
                          )}
                        </span>
                      </label>
                    </div>
                  )}
                </section>

                <section className="form-section notes-section">
                  <label>
                    <span>
                      {t("admin.onboarding.notes", "Private preparation notes")}
                    </span>
                    <textarea
                      rows={4}
                      value={draft.privateNotes}
                      placeholder={t(
                        "admin.onboarding.notesPlaceholder",
                        "Record the next step, missing setup details and owner preferences. Do not add sensitive data.",
                      )}
                      onChange={(event) =>
                        updateDraft("privateNotes", event.target.value)
                      }
                    />
                  </label>
                </section>

                {(draft.directoryPlaceId || draft.businessId) && (
                  <section className="context-links">
                    <h3>
                      {t(
                        "admin.onboarding.context",
                        "Existing Mirëbook context",
                      )}
                    </h3>
                    <div>
                      {draft.directoryPlaceId && (
                        <>
                          <Link
                            href={{
                              pathname: "/admin/directory",
                              query: {
                                search: draft.prospectName,
                                ...(selectedSuggestion?.type === "directory" &&
                                [
                                  "needs_review",
                                  "active",
                                  "hidden",
                                  "closed",
                                  "duplicate",
                                ].includes(selectedSuggestion.state)
                                  ? { status: selectedSuggestion.state }
                                  : {}),
                              },
                            }}
                            className="btn btn-ghost"
                          >
                            <MapPin aria-hidden="true" />
                            {t(
                              "admin.onboarding.openDirectory",
                              "Directory record",
                            )}
                          </Link>
                          <Link
                            href={getCustomerAppUrl(
                              `/places/${draft.directoryPlaceId}`,
                            )}
                            className="btn btn-ghost"
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink aria-hidden="true" />
                            {t("admin.onboarding.openPublic", "Public place")}
                          </Link>
                        </>
                      )}
                      {draft.businessId && (
                        <Link
                          href={`/admin/businesses?businessId=${draft.businessId}`}
                          className="btn btn-ghost"
                        >
                          <Building2 aria-hidden="true" />
                          {t(
                            "admin.onboarding.openBusiness",
                            "Business profile",
                          )}
                        </Link>
                      )}
                      <Link
                        href={`/admin/outreach?search=${encodeURIComponent(
                          draft.prospectName,
                        )}`}
                        className="btn btn-ghost"
                      >
                        <ExternalLink aria-hidden="true" />
                        {t("admin.onboarding.openOutreach", "Open outreach")}
                      </Link>
                    </div>
                  </section>
                )}

                {draft.caseId && (
                  <PreparedProfilePanel
                    key={`prepared:${draft.caseId}`}
                    caseId={draft.caseId}
                    prospectName={draft.prospectName}
                    categoryKey={draft.categoryKey}
                    city={draft.city}
                    address={draft.address}
                    phone={draft.ownerPhone}
                    ownerEmail={draft.ownerEmail}
                    profileMediaPermission={
                      draft.profileMediaPermission &&
                      savedProfileMediaPermission
                    }
                    t={t}
                  />
                )}

                {draft.caseId && (
                  <OnboardingHandoffPanel
                    key={draft.caseId}
                    caseId={draft.caseId}
                    placeName={draft.prospectName}
                    directoryPlaceId={draft.directoryPlaceId}
                    businessId={draft.businessId}
                    ownerEmail={draft.ownerEmail}
                    ownerPhone={draft.ownerPhone}
                    socialUrl={draft.socialUrl}
                    preferredLanguage={draft.preferredLanguage}
                    listingInterest={draft.listingInterest}
                    bookingInterest={draft.bookingInterest}
                    businessAppInterest={draft.businessAppInterest}
                    assetsStatus={draft.assetsStatus}
                    profileMediaPermission={draft.profileMediaPermission}
                    marketingMediaPermission={draft.marketingMediaPermission}
                    permissionEvidenceComplete={Boolean(
                      hasMediaPermission &&
                      draft.permissionConfirmed &&
                      draft.permissionSource &&
                      draft.permissionGrantedBy.trim() &&
                      draft.permissionGrantedAt,
                    )}
                    claimLink={
                      draft.directoryPlaceId
                        ? getBusinessAppUrl(
                            `/claim/${encodeURIComponent(
                              draft.directoryPlaceId,
                            )}`,
                          )
                        : ""
                    }
                    publicPlaceLink={
                      draft.directoryPlaceId
                        ? getCustomerAppUrl(
                            `/places/${encodeURIComponent(
                              draft.directoryPlaceId,
                            )}`,
                          )
                        : ""
                    }
                    businessEntryLink={getBusinessAppUrl("/register")}
                    businessProfileLink={
                      draft.businessId
                        ? `/admin/businesses?businessId=${encodeURIComponent(
                            draft.businessId,
                          )}`
                        : ""
                    }
                    uiLocale={locale}
                    t={t}
                  />
                )}

                {events.length > 0 && (
                  <section className="history-section">
                    <h3>
                      {t("admin.onboarding.history", "Recent private activity")}
                    </h3>
                    <div>
                      {events.map((event) => (
                        <p key={event.id}>
                          <BadgeCheck aria-hidden="true" />
                          <span>
                            <strong>{statusLabel(event.to_status)}</strong>
                            <small>
                              {formatDate(event.created_at, locale)}
                            </small>
                          </span>
                        </p>
                      ))}
                    </div>
                  </section>
                )}

                <footer className="editor-footer">
                  <div>
                    <ShieldCheck aria-hidden="true" />
                    <p>
                      {t(
                        "admin.onboarding.safety",
                        "Saving records private preparation only. It does not create an account, send a message, publish a listing or change bookings.",
                      )}
                    </p>
                  </div>
                  <button
                    type="submit"
                    className="btn btn-accent"
                    disabled={saving || !storageAvailable}
                  >
                    {saving ? (
                      t("admin.onboarding.saving", "Saving...")
                    ) : (
                      <>
                        <Save aria-hidden="true" />
                        {t("admin.onboarding.save", "Save private case")}
                      </>
                    )}
                  </button>
                </footer>
              </form>
            )}
          </section>
        </div>
      </section>

      <style jsx>{`
        .onboarding-page {
          min-height: 100vh;
          background: var(--background);
        }

        .onboarding-shell {
          width: min(100% - 2rem, 1440px);
          padding: 2rem 0 4rem;
        }

        .page-header,
        .search-heading,
        .section-heading,
        .editor-header,
        .form-section-heading,
        .editor-footer,
        .header-actions,
        .context-links > div {
          display: flex;
          align-items: center;
        }

        .page-header {
          justify-content: space-between;
          gap: 1.5rem;
          margin-bottom: 1.25rem;
        }

        .page-header > div:first-child {
          max-width: 48rem;
        }

        .page-header span,
        .section-heading span,
        .editor-header > div:first-child > span {
          color: var(--accent);
          font-size: 0.78rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .page-header h1 {
          margin: 0.2rem 0 0.35rem;
          font-size: clamp(2rem, 4vw, 3.2rem);
        }

        .page-header p,
        .search-heading p,
        .form-section-heading p,
        .editor-header p {
          margin: 0;
          color: var(--muted);
        }

        .header-actions,
        .context-links > div {
          flex-wrap: wrap;
          gap: 0.55rem;
        }

        .icon-action {
          width: 2.75rem;
          min-width: 2.75rem;
          padding: 0;
        }

        .icon-action :global(svg),
        .context-links :global(svg),
        .editor-footer button :global(svg) {
          width: 1rem;
          height: 1rem;
        }

        .search-band {
          position: relative;
          z-index: 20;
          display: grid;
          grid-template-columns: minmax(15rem, 0.72fr) minmax(20rem, 1.28fr);
          gap: 1.4rem;
          align-items: center;
          padding: 1.05rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
        }

        .search-heading {
          align-items: flex-start;
          gap: 0.75rem;
        }

        .search-heading :global(svg) {
          flex: 0 0 auto;
          width: 1.2rem;
          height: 1.2rem;
          margin-top: 0.2rem;
          color: var(--accent);
        }

        .search-heading h2,
        .section-heading h2,
        .editor-header h2,
        .editor-empty h2,
        .form-section h3,
        .context-links h3,
        .history-section h3 {
          margin: 0;
          letter-spacing: 0;
        }

        .search-heading h2 {
          font-size: 1.05rem;
        }

        .search-heading p {
          margin-top: 0.25rem;
          font-size: 0.88rem;
          line-height: 1.45;
        }

        .notice {
          display: flex;
          align-items: flex-start;
          gap: 0.7rem;
          margin-top: 0.8rem;
          padding: 0.8rem 0.9rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
        }

        .notice :global(svg) {
          flex: 0 0 auto;
          width: 1.1rem;
          height: 1.1rem;
          margin-top: 0.15rem;
        }

        .notice p {
          margin: 0.2rem 0 0;
          color: var(--muted);
        }

        .notice.warning {
          border-color: rgba(231, 167, 56, 0.45);
          background: rgba(231, 167, 56, 0.08);
        }

        .notice.error {
          border-color: rgba(201, 69, 84, 0.45);
          color: var(--danger, #c94554);
        }

        .notice.success {
          border-color: rgba(15, 143, 131, 0.4);
          color: #0f8f83;
        }

        .summary-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin: 0.85rem 0;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
        }

        .summary-strip > div {
          min-width: 0;
          display: flex;
          align-items: baseline;
          gap: 0.55rem;
          padding: 0.75rem 0.9rem;
          border-right: 1px solid var(--border);
        }

        .summary-strip > div:last-child {
          border-right: 0;
        }

        .summary-strip span {
          font-size: 1.3rem;
          font-weight: 900;
        }

        .summary-strip small {
          color: var(--muted);
          overflow-wrap: anywhere;
        }

        .workbench {
          display: grid;
          grid-template-columns: minmax(18rem, 0.72fr) minmax(0, 1.55fr);
          gap: 0.85rem;
          align-items: start;
        }

        .case-queue,
        .case-editor {
          min-width: 0;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
        }

        .case-queue {
          position: sticky;
          top: 1rem;
          max-height: calc(100vh - 2rem);
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          overflow: hidden;
        }

        .section-heading {
          justify-content: space-between;
          gap: 0.8rem;
          padding: 0.85rem;
          border-bottom: 1px solid var(--border);
        }

        .section-heading h2 {
          margin-top: 0.16rem;
          font-size: 1.05rem;
        }

        .section-heading select {
          width: min(11rem, 48%);
          min-height: 2.75rem;
        }

        .queue-list {
          overflow-y: auto;
          overscroll-behavior: contain;
          padding: 0.35rem;
        }

        .queue-list > button {
          width: 100%;
          display: grid;
          gap: 0.38rem;
          padding: 0.75rem;
          border: 1px solid transparent;
          border-radius: 6px;
          background: transparent;
          color: var(--text);
          text-align: left;
          cursor: pointer;
        }

        .queue-list > button + button {
          border-top-color: var(--border);
          border-top-left-radius: 0;
          border-top-right-radius: 0;
        }

        .queue-list > button:hover,
        .queue-list > button.selected {
          border-color: rgba(237, 90, 42, 0.35);
          background: rgba(237, 90, 42, 0.07);
        }

        .queue-row-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.6rem;
        }

        .queue-row-top strong {
          overflow-wrap: anywhere;
        }

        .queue-row-top em,
        .status-badge {
          flex: 0 0 auto;
          padding: 0.18rem 0.4rem;
          border-radius: 999px;
          background: var(--surface-3);
          color: var(--muted);
          font-size: 0.68rem;
          font-style: normal;
          font-weight: 900;
        }

        .queue-list > button > small {
          color: var(--muted);
          overflow-wrap: anywhere;
        }

        .queue-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem 0.65rem;
          color: var(--muted);
          font-size: 0.72rem;
        }

        .queue-meta span {
          display: inline-flex;
          align-items: center;
          gap: 0.24rem;
        }

        .queue-meta :global(svg) {
          width: 0.78rem;
          height: 0.78rem;
        }

        .queue-empty,
        .editor-empty {
          display: grid;
          justify-items: center;
          align-content: center;
          gap: 0.55rem;
          padding: 2rem 1rem;
          color: var(--muted);
          text-align: center;
        }

        .queue-empty :global(svg),
        .editor-empty :global(svg) {
          width: 1.5rem;
          height: 1.5rem;
          color: var(--accent);
        }

        .queue-empty p,
        .editor-empty p {
          max-width: 34rem;
          margin: 0;
        }

        .case-editor {
          overflow: hidden;
        }

        .editor-empty {
          min-height: 24rem;
        }

        .editor-header {
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
          padding: 1rem;
          border-bottom: 1px solid var(--border);
        }

        .editor-header h2 {
          margin-top: 0.2rem;
          font-size: 1.45rem;
          overflow-wrap: anywhere;
        }

        .editor-header p {
          margin-top: 0.35rem;
          max-width: 48rem;
          font-size: 0.9rem;
        }

        .form-section,
        .context-links,
        .history-section {
          padding: 1rem;
          border-bottom: 1px solid var(--border);
        }

        .form-section-heading {
          align-items: flex-start;
          gap: 0.65rem;
          margin-bottom: 0.85rem;
        }

        .form-section-heading.compact {
          margin-bottom: 0.75rem;
        }

        .form-section-heading :global(svg) {
          flex: 0 0 auto;
          width: 1.1rem;
          height: 1.1rem;
          margin-top: 0.18rem;
          color: var(--accent);
        }

        .form-section-heading h3,
        .context-links h3,
        .history-section h3 {
          font-size: 1rem;
        }

        .form-section-heading p {
          margin-top: 0.2rem;
          font-size: 0.82rem;
        }

        .form-grid {
          display: grid;
          gap: 0.75rem;
        }

        .form-grid.two,
        .split-section {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .form-grid label,
        .status-fields label,
        .notes-section label {
          min-width: 0;
          display: grid;
          gap: 0.38rem;
        }

        label > span {
          font-size: 0.78rem;
          font-weight: 800;
        }

        input,
        select,
        textarea {
          min-width: 0;
          width: 100%;
          min-height: 2.75rem;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--surface-2);
          color: var(--text);
        }

        input,
        select {
          padding: 0 0.68rem;
        }

        textarea {
          min-height: 6rem;
          padding: 0.7rem;
          resize: vertical;
        }

        .split-section {
          display: grid;
          gap: 1rem;
        }

        .choice-list {
          display: grid;
          gap: 0.42rem;
        }

        .choice-list > label,
        .confirm-row {
          min-height: 3.3rem;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: start;
          gap: 0.65rem;
          padding: 0.65rem;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--surface-2);
          cursor: pointer;
        }

        .choice-list input,
        .confirm-row input {
          width: 1.1rem;
          min-height: 1.1rem;
          margin: 0.12rem 0 0;
          accent-color: var(--accent);
        }

        .choice-list label > span {
          display: grid;
          gap: 0.18rem;
        }

        .choice-list small {
          color: var(--muted);
          font-weight: 400;
          line-height: 1.35;
        }

        .status-fields {
          display: grid;
          align-content: start;
          gap: 0.75rem;
        }

        .next-action {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: start;
          gap: 0.55rem;
          padding: 0.72rem;
          border-left: 3px solid var(--accent);
          background: var(--surface-2);
        }

        .next-action :global(svg) {
          width: 1rem;
          height: 1rem;
          margin-top: 0.12rem;
          color: var(--accent);
        }

        .next-action span {
          display: grid;
          gap: 0.18rem;
        }

        .next-action small {
          color: var(--muted);
        }

        .permission-choices {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .permission-details {
          margin-top: 0.8rem;
          padding-top: 0.8rem;
          border-top: 1px solid var(--border);
        }

        .confirm-row {
          margin-top: 0.75rem;
          font-size: 0.82rem;
          font-weight: 700;
        }

        .context-links h3,
        .history-section h3 {
          margin-bottom: 0.65rem;
        }

        .context-links :global(.btn) {
          min-height: 2.75rem;
          gap: 0.4rem;
        }

        .history-section > div {
          display: grid;
          gap: 0.35rem;
        }

        .history-section p {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: start;
          gap: 0.55rem;
          margin: 0;
          padding: 0.55rem 0;
          border-top: 1px solid var(--border);
        }

        .history-section p :global(svg) {
          width: 1rem;
          height: 1rem;
          margin-top: 0.1rem;
          color: #0f8f83;
        }

        .history-section p span {
          display: flex;
          justify-content: space-between;
          gap: 0.7rem;
        }

        .history-section small {
          color: var(--muted);
        }

        .editor-footer {
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
        }

        .editor-footer > div {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: start;
          gap: 0.55rem;
          max-width: 44rem;
        }

        .editor-footer > div :global(svg) {
          width: 1rem;
          height: 1rem;
          margin-top: 0.15rem;
          color: #0f8f83;
        }

        .editor-footer p {
          margin: 0;
          color: var(--muted);
          font-size: 0.8rem;
          line-height: 1.4;
        }

        .editor-footer button {
          flex: 0 0 auto;
          min-height: 2.9rem;
          gap: 0.45rem;
        }

        @media (max-width: 980px) {
          .search-band,
          .workbench {
            grid-template-columns: 1fr;
          }

          .case-queue {
            position: static;
            max-height: none;
          }

          .queue-list {
            max-height: 24rem;
          }
        }

        @media (max-width: 720px) {
          .onboarding-shell {
            width: min(100% - 1rem, 1440px);
            padding-top: 1rem;
          }

          .page-header,
          .editor-header,
          .editor-footer {
            align-items: stretch;
          }

          .page-header,
          .editor-footer {
            flex-direction: column;
          }

          .header-actions .btn:not(.icon-action) {
            flex: 1 1 auto;
          }

          .summary-strip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .summary-strip > div:nth-child(2) {
            border-right: 0;
          }

          .summary-strip > div:nth-child(-n + 2) {
            border-bottom: 1px solid var(--border);
          }

          .form-grid.two,
          .split-section,
          .permission-choices {
            grid-template-columns: 1fr;
          }

          .editor-header {
            display: grid;
          }

          .status-badge {
            width: fit-content;
          }

          .editor-footer button {
            width: 100%;
          }

          .history-section p span {
            display: grid;
          }
        }

        @media (max-width: 430px) {
          .search-band,
          .form-section,
          .context-links,
          .history-section,
          .editor-header,
          .editor-footer {
            padding: 0.78rem;
          }

          .section-heading {
            display: grid;
          }

          .section-heading select {
            width: 100%;
          }

          .summary-strip > div {
            display: grid;
            gap: 0.1rem;
          }

          .context-links :global(.btn) {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
