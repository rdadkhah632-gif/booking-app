import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ExternalLink,
  Globe2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserRoundSearch,
} from "lucide-react";
import AuthNav from "@/components/AuthNav";
import OutreachDraftPanel from "@/components/admin/OutreachDraftPanel";
import { getBusinessAppUrl, getCustomerAppUrl } from "@/lib/appUrls";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/useI18n";

const STATUSES = [
  "not_started",
  "planned",
  "contacted",
  "follow_up",
  "interested",
  "declined",
  "unreachable",
] as const;
const CHANNELS = [
  "email",
  "phone",
  "social",
  "website",
  "in_person",
  "other",
] as const;
const CONTACT_RECORDED_STATUSES: OutreachStatus[] = [
  "contacted",
  "follow_up",
  "interested",
  "declined",
  "unreachable",
];

type OutreachStatus = (typeof STATUSES)[number];
type OutreachChannel = (typeof CHANNELS)[number];
type StatusFilter = OutreachStatus | "all";

type OutreachRow = {
  directory_place_id: string;
  status: OutreachStatus;
  channel?: OutreachChannel | null;
  follow_up_on?: string | null;
  notes?: string | null;
  first_contacted_at?: string | null;
  last_contacted_at?: string | null;
  updated_at: string;
};

type OutreachEvent = {
  id: string;
  directory_place_id: string;
  from_status?: OutreachStatus | null;
  to_status: OutreachStatus;
  channel?: OutreachChannel | null;
  follow_up_on?: string | null;
  notes?: string | null;
  created_at: string;
};

type OutreachCandidate = {
  id: string;
  name: string;
  categoryKey: string;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  countryCode: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  socialUrls: string[];
  outreach: OutreachRow;
  recentEvents: OutreachEvent[];
  isDue: boolean;
};

type OutreachPayload = {
  candidates: OutreachCandidate[];
  counts: Record<OutreachStatus, number>;
  dueFollowUps: number;
  trackingAvailable: boolean;
  excludedOpenClaims: number;
  filters: {
    cities: string[];
    categories: string[];
  };
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
};

type OutreachDraft = {
  status: OutreachStatus;
  channel: OutreachChannel | "";
  followUpOn: string;
  notes: string;
};

const EMPTY_COUNTS: Record<OutreachStatus, number> = {
  not_started: 0,
  planned: 0,
  contacted: 0,
  follow_up: 0,
  interested: 0,
  declined: 0,
  unreachable: 0,
};

const EMPTY_DRAFT: OutreachDraft = {
  status: "not_started",
  channel: "",
  followUpOn: "",
  notes: "",
};

function formatDate(
  value: string | null | undefined,
  locale: "en" | "sq",
  includeTime = false,
) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale === "sq" ? "sq-AL" : "en-GB", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  }).format(new Date(value));
}

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function mailtoHref(email: string) {
  return `mailto:${email.replace(/\s/g, "")}`;
}

function dateAfterDays(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function preferredOutreachChannel(candidate: OutreachCandidate): OutreachChannel {
  if (candidate.email) return "email";
  if (candidate.socialUrls.length > 0) return "social";
  if (candidate.phone) return "phone";
  if (candidate.website) return "website";
  return "in_person";
}

export default function AdminOutreachPage() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [adminReady, setAdminReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [trackingAvailable, setTrackingAvailable] = useState(true);
  const [candidates, setCandidates] = useState<OutreachCandidate[]>([]);
  const [counts, setCounts] =
    useState<Record<OutreachStatus, number>>(EMPTY_COUNTS);
  const [dueFollowUps, setDueFollowUps] = useState(0);
  const [excludedOpenClaims, setExcludedOpenClaims] = useState(0);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
  });
  const [selectedId, setSelectedId] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedCity, setAppliedCity] = useState("");
  const [appliedCategory, setAppliedCategory] = useState("");
  const [draft, setDraft] = useState<OutreachDraft>(EMPTY_DRAFT);
  const [claimLink, setClaimLink] = useState("");
  const [publicPlaceLink, setPublicPlaceLink] = useState("");
  const [manualContactConfirmed, setManualContactConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedCandidate = useMemo(
    () =>
      candidates.find((candidate) => candidate.id === selectedId) ||
      candidates[0] ||
      null,
    [candidates, selectedId],
  );

  const totalCandidates = useMemo(
    () => Object.values(counts).reduce((total, count) => total + count, 0),
    [counts],
  );

  useEffect(() => {
    if (!selectedCandidate) {
      setDraft(EMPTY_DRAFT);
      setClaimLink("");
      setPublicPlaceLink("");
      setManualContactConfirmed(false);
      return;
    }

    setDraft({
      status: selectedCandidate.outreach.status,
      channel: selectedCandidate.outreach.channel || "",
      followUpOn: selectedCandidate.outreach.follow_up_on || "",
      notes: selectedCandidate.outreach.notes || "",
    });
    setManualContactConfirmed(false);

    const claimPath = getBusinessAppUrl(
      `/claim/${encodeURIComponent(selectedCandidate.id)}`,
    );
    const publicPath = getCustomerAppUrl(
      `/places/${encodeURIComponent(selectedCandidate.id)}`,
    );
    setClaimLink(
      typeof window === "undefined"
        ? claimPath
        : new URL(claimPath, window.location.origin).toString(),
    );
    setPublicPlaceLink(
      typeof window === "undefined"
        ? publicPath
        : new URL(publicPath, window.location.origin).toString(),
    );
  }, [selectedCandidate]);

  useEffect(() => {
    if (!router.isReady) return;
    let cancelled = false;

    async function authenticate() {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login?redirectTo=/admin/outreach");
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
      await loadCandidates({
        token: session.access_token,
        nextOffset: 0,
        nextStatus: statusFilter,
        nextSearch: appliedSearch,
        nextCity: appliedCity,
        nextCategory: appliedCategory,
      });
    }

    void authenticate();
    return () => {
      cancelled = true;
    };
    // Initial authentication owns the first load. Later loads are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  function statusLabel(value: StatusFilter) {
    const labels: Record<StatusFilter, string> = {
      all: t("admin.outreach.status.all", "All"),
      not_started: t("admin.outreach.status.notStarted", "Not started"),
      planned: t("admin.outreach.status.planned", "Planned"),
      contacted: t("admin.outreach.status.contacted", "Contacted"),
      follow_up: t("admin.outreach.status.followUp", "Follow up"),
      interested: t("admin.outreach.status.interested", "Interested"),
      declined: t("admin.outreach.status.declined", "Declined"),
      unreachable: t("admin.outreach.status.unreachable", "Unreachable"),
    };
    return labels[value];
  }

  function channelLabel(value: OutreachChannel) {
    const labels: Record<OutreachChannel, string> = {
      email: t("admin.outreach.channel.email", "Email"),
      phone: t("admin.outreach.channel.phone", "Phone"),
      social: t("admin.outreach.channel.social", "Social"),
      website: t("admin.outreach.channel.website", "Website form"),
      in_person: t("admin.outreach.channel.inPerson", "In person"),
      other: t("admin.outreach.channel.other", "Other"),
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

  async function loadCandidates(params: {
    token?: string;
    nextOffset?: number;
    nextStatus?: StatusFilter;
    nextSearch?: string;
    nextCity?: string;
    nextCategory?: string;
  } = {}) {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = params.token || session?.access_token;
      if (!token) {
        router.replace("/login?redirectTo=/admin/outreach");
        return;
      }

      const nextOffset = params.nextOffset ?? pagination.offset;
      const nextStatus = params.nextStatus ?? statusFilter;
      const query = new URLSearchParams({
        limit: String(pagination.limit),
        offset: String(nextOffset),
      });
      if (nextStatus !== "all") query.set("status", nextStatus);
      if (params.nextSearch ?? appliedSearch) {
        query.set("search", params.nextSearch ?? appliedSearch);
      }
      if (params.nextCity ?? appliedCity) {
        query.set("city", params.nextCity ?? appliedCity);
      }
      if (params.nextCategory ?? appliedCategory) {
        query.set("category", params.nextCategory ?? appliedCategory);
      }

      const response = await fetch(`/api/admin/directory-outreach?${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as OutreachPayload & {
        error?: string;
      };
      if (response.status === 403) {
        setAdminReady(false);
        return;
      }
      if (!response.ok) throw new Error(payload.error || "load_failed");

      setCandidates(payload.candidates || []);
      setCounts(payload.counts || EMPTY_COUNTS);
      setDueFollowUps(payload.dueFollowUps || 0);
      setExcludedOpenClaims(payload.excludedOpenClaims || 0);
      setTrackingAvailable(payload.trackingAvailable !== false);
      setAvailableCities(payload.filters?.cities || []);
      setAvailableCategories(payload.filters?.categories || []);
      setPagination(payload.pagination);
      setSelectedId((current) =>
        payload.candidates.some((candidate) => candidate.id === current)
          ? current
          : payload.candidates[0]?.id || "",
      );
    } catch {
      setError(
        t(
          "admin.outreach.error.load",
          "The outreach queue could not be loaded.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedSearch(search.trim());
    setAppliedCity(city);
    setAppliedCategory(category);
    await loadCandidates({
      nextOffset: 0,
      nextSearch: search.trim(),
      nextCity: city,
      nextCategory: category,
    });
  }

  async function changeStatusFilter(nextStatus: StatusFilter) {
    setStatusFilter(nextStatus);
    await loadCandidates({ nextOffset: 0, nextStatus });
  }

  async function saveOutreach() {
    if (!selectedCandidate || !trackingAvailable) return;
    if (
      CONTACT_RECORDED_STATUSES.includes(draft.status) &&
      !draft.channel
    ) {
      setError(
        t(
          "admin.outreach.error.channel",
          "Choose how the business was contacted.",
        ),
      );
      return;
    }
    if (
      CONTACT_RECORDED_STATUSES.includes(draft.status) &&
      !manualContactConfirmed
    ) {
      setError(
        t(
          "admin.outreach.error.manualConfirmation",
          "Confirm that contact happened outside Mirëbook before saving this status.",
        ),
      );
      return;
    }
    if (draft.status === "follow_up" && !draft.followUpOn) {
      setError(
        t("admin.outreach.error.followUp", "Choose a follow-up date."),
      );
      return;
    }
    if (
      ["declined", "unreachable"].includes(draft.status) &&
      !draft.notes.trim()
    ) {
      setError(
        t(
          "admin.outreach.error.note",
          "Add a short private note for this outcome.",
        ),
      );
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("signed_out");

      const response = await fetch("/api/admin/directory-outreach", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          placeId: selectedCandidate.id,
          status: draft.status,
          channel: draft.channel || null,
          followUpOn: draft.followUpOn || null,
          notes: draft.notes.trim() || null,
          manualContactConfirmed,
        }),
      });
      const payload = (await response.json()) as {
        code?: string;
        error?: string;
        trackingAvailable?: boolean;
      };
      if (!response.ok) {
        if (response.status === 409) throw new Error("candidate_unavailable");
        if (response.status === 503) {
          setTrackingAvailable(false);
          throw new Error("tracking_unavailable");
        }
        if (payload.code === "manual_contact_confirmation_required") {
          throw new Error("manual_confirmation_required");
        }
        throw new Error("save_failed");
      }

      await loadCandidates();
      setSuccess(
        t("admin.outreach.success", "Private outreach update saved."),
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error && saveError.message === "candidate_unavailable"
          ? t(
              "admin.outreach.error.unavailable",
              "This place is no longer available in the outreach queue.",
            )
          : saveError instanceof Error &&
              saveError.message === "tracking_unavailable"
            ? t(
                "admin.outreach.preparing",
                "Private outreach tracking is being prepared. Candidates remain available to review.",
              )
            : saveError instanceof Error &&
                saveError.message === "manual_confirmation_required"
              ? t(
                  "admin.outreach.error.manualConfirmation",
                  "Confirm that contact happened outside Mirëbook before saving this status.",
                )
            : t(
                "admin.outreach.error.save",
                "The outreach update could not be saved.",
              ),
      );
    } finally {
      setSaving(false);
    }
  }

  if (!adminReady) {
    return (
      <main>
        <AuthNav />
        <section className="container outreach-state">
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
          .outreach-state {
            padding-top: 3rem;
            padding-bottom: 4rem;
          }
        `}</style>
      </main>
    );
  }

  return (
    <main>
      <Head>
        <title>
          {t("admin.outreach.metaTitle", "Owner outreach | Mirëbook")}
        </title>
      </Head>
      <AuthNav contextRole="admin" />

      <section className="container outreach-page">
        <header className="outreach-header">
          <div>
            <p className="small outreach-kicker">
              {t("admin.outreach.kicker", "Marketplace growth")}
            </p>
            <h1 className="page-title">
              {t("admin.outreach.title", "Owner outreach")}
            </h1>
            <p className="page-sub">
              {t(
                "admin.outreach.subtitle",
                "Prioritise reviewed local places, record conversations and share the correct ownership path.",
              )}
            </p>
          </div>
          <div className="outreach-header-actions">
            <Link href="/admin/directory-claims" className="btn btn-ghost">
              {t("admin.outreach.claims", "Ownership claims")}
            </Link>
            <Link href="/admin/directory" className="btn btn-ghost">
              {t("admin.outreach.directory", "Directory review")}
            </Link>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => loadCandidates({ nextOffset: 0 })}
              disabled={loading}
            >
              <RefreshCw size={17} aria-hidden="true" />
              {t("admin.outreach.refresh", "Refresh")}
            </button>
          </div>
        </header>

        <div className="outreach-safety">
          <ShieldCheck size={22} aria-hidden="true" />
          <div>
            <strong>
              {t(
                "admin.outreach.safetyTitle",
                "Private tracking, owner choice",
              )}
            </strong>
            <span>
              {t(
                "admin.outreach.safetyBody",
                "Nothing is sent automatically. Interest does not claim or publish a place; ownership still follows the reviewed claim flow.",
              )}
            </span>
          </div>
        </div>

        {!trackingAvailable && (
          <div className="outreach-message is-neutral">
            {t(
              "admin.outreach.preparing",
              "Private outreach tracking is being prepared. Candidates remain available to review.",
            )}
          </div>
        )}
        {error && <div className="outreach-message is-error">{error}</div>}
        {success && <div className="outreach-message is-success">{success}</div>}

        <div
          className="outreach-statuses"
          role="tablist"
          aria-label={t("admin.outreach.statuses", "Outreach statuses")}
        >
          {(["all", ...STATUSES] as StatusFilter[]).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={statusFilter === value}
              className={statusFilter === value ? "is-active" : ""}
              onClick={() => changeStatusFilter(value)}
            >
              <strong>
                {value === "all" ? totalCandidates : counts[value] || 0}
              </strong>
              <span>{statusLabel(value)}</span>
            </button>
          ))}
        </div>

        <div className="outreach-context">
          <span>
            <CalendarClock size={17} aria-hidden="true" />
            <strong>{dueFollowUps}</strong>{" "}
            {t("admin.outreach.due", "follow-ups due")}
          </span>
          <span>
            <ShieldCheck size={17} aria-hidden="true" />
            <strong>{excludedOpenClaims}</strong>{" "}
            {t(
              "admin.outreach.openClaims",
              "open claims handled in ownership review",
            )}
          </span>
        </div>

        <form className="outreach-filters" onSubmit={applyFilters}>
          <label>
            <span>{t("admin.outreach.filter.search", "Search")}</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t(
                "admin.outreach.filter.searchPlaceholder",
                "Place, city or contact",
              )}
            />
          </label>
          <label>
            <span>{t("admin.outreach.filter.city", "City")}</span>
            <select value={city} onChange={(event) => setCity(event.target.value)}>
              <option value="">
                {t("admin.outreach.filter.allCities", "All cities")}
              </option>
              {availableCities.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("admin.outreach.filter.category", "Category")}</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="">
                {t("admin.outreach.filter.allCategories", "All categories")}
              </option>
              {availableCategories.map((value) => (
                <option key={value} value={value}>
                  {categoryLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-accent">
            {t("admin.outreach.filter.apply", "Apply")}
          </button>
        </form>

        <div className="outreach-workspace">
          <section className="outreach-list">
            <header>
              <div>
                <strong>{statusLabel(statusFilter)}</strong>
                <span>
                  {pagination.total}{" "}
                  {t("admin.outreach.results", "candidates")}
                </span>
              </div>
              {loading && (
                <span>{t("admin.outreach.loading", "Loading...")}</span>
              )}
            </header>

            {!loading && candidates.length === 0 ? (
              <div className="outreach-empty">
                <UserRoundSearch size={30} aria-hidden="true" />
                <strong>
                  {t(
                    "admin.outreach.emptyTitle",
                    "No candidates in this view",
                  )}
                </strong>
                <span>
                  {t(
                    "admin.outreach.emptyBody",
                    "Change the filters or open Directory review to prepare more places.",
                  )}
                </span>
              </div>
            ) : (
              <div className="outreach-rows">
                {candidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    className={
                      selectedCandidate?.id === candidate.id
                        ? "is-selected"
                        : ""
                    }
                    onClick={() => setSelectedId(candidate.id)}
                  >
                    <span className="outreach-row-main">
                      <span>
                        <strong>{candidate.name}</strong>
                        {candidate.isDue && (
                          <small className="is-due">
                            {t("admin.outreach.dueNow", "Due")}
                          </small>
                        )}
                      </span>
                      <small>
                        {[categoryLabel(candidate.categoryKey), candidate.city]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </span>
                    <span className={`outreach-pill is-${candidate.outreach.status}`}>
                      {statusLabel(candidate.outreach.status)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {pagination.total > pagination.limit && (
              <footer>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={pagination.offset === 0 || loading}
                  onClick={() =>
                    loadCandidates({
                      nextOffset: Math.max(
                        0,
                        pagination.offset - pagination.limit,
                      ),
                    })
                  }
                >
                  {t("admin.outreach.previous", "Previous")}
                </button>
                <span>
                  {pagination.offset + 1}–
                  {Math.min(
                    pagination.offset + pagination.limit,
                    pagination.total,
                  )}{" "}
                  / {pagination.total}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={
                    pagination.offset + pagination.limit >= pagination.total ||
                    loading
                  }
                  onClick={() =>
                    loadCandidates({
                      nextOffset: pagination.offset + pagination.limit,
                    })
                  }
                >
                  {t("admin.outreach.next", "Next")}
                </button>
              </footer>
            )}
          </section>

          <section className="outreach-detail">
            {!selectedCandidate ? (
              <div className="outreach-empty">
                <UserRoundSearch size={30} aria-hidden="true" />
                <strong>
                  {t("admin.outreach.selectTitle", "Select a candidate")}
                </strong>
                <span>
                  {t(
                    "admin.outreach.selectBody",
                    "Choose a place to see contact routes and record the next step.",
                  )}
                </span>
              </div>
            ) : (
              <>
                <header className="outreach-detail-header">
                  <div>
                    <span className={`outreach-pill is-${selectedCandidate.outreach.status}`}>
                      {statusLabel(selectedCandidate.outreach.status)}
                    </span>
                    <h2>{selectedCandidate.name}</h2>
                    <p>
                      {[categoryLabel(selectedCandidate.categoryKey), selectedCandidate.city]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Link
                    href={`/places/${encodeURIComponent(selectedCandidate.id)}`}
                    className="btn btn-ghost"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={16} aria-hidden="true" />
                    {t("admin.outreach.publicPlace", "Public place")}
                  </Link>
                </header>

                <div className="outreach-contact-section">
                  <h3>{t("admin.outreach.contactTitle", "Contact routes")}</h3>
                  {selectedCandidate.address && (
                    <p className="outreach-address">
                      <MapPin size={17} aria-hidden="true" />
                      <span>{selectedCandidate.address}</span>
                    </p>
                  )}
                  <div className="outreach-contact-actions">
                    {selectedCandidate.phone && (
                      <a
                        href={telHref(selectedCandidate.phone)}
                        className="btn btn-ghost"
                      >
                        <Phone size={16} aria-hidden="true" />
                        {selectedCandidate.phone}
                      </a>
                    )}
                    {selectedCandidate.email && (
                      <a
                        href={mailtoHref(selectedCandidate.email)}
                        className="btn btn-ghost"
                      >
                        <Mail size={16} aria-hidden="true" />
                        {selectedCandidate.email}
                      </a>
                    )}
                    {selectedCandidate.website && (
                      <a
                        href={selectedCandidate.website}
                        className="btn btn-ghost"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Globe2 size={16} aria-hidden="true" />
                        {t("admin.outreach.website", "Website")}
                      </a>
                    )}
                    {selectedCandidate.socialUrls.map((url, index) => (
                      <a
                        key={url}
                        href={url}
                        className="btn btn-ghost"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink size={16} aria-hidden="true" />
                        {t("admin.outreach.social", "Social")} {index + 1}
                      </a>
                    ))}
                  </div>
                  {!selectedCandidate.phone &&
                    !selectedCandidate.email &&
                    !selectedCandidate.website &&
                    selectedCandidate.socialUrls.length === 0 && (
                      <p className="muted">
                        {t(
                          "admin.outreach.noContact",
                          "No direct contact route is stored. Verify one in Directory review before outreach.",
                        )}
                      </p>
                    )}
                </div>

                {claimLink && publicPlaceLink && (
                  <OutreachDraftPanel
                    key={`${selectedCandidate.id}:${locale}:${claimLink}:${publicPlaceLink}`}
                    candidateId={selectedCandidate.id}
                    placeName={selectedCandidate.name}
                    email={selectedCandidate.email}
                    claimLink={claimLink}
                    publicPlaceLink={publicPlaceLink}
                    preferredChannel={preferredOutreachChannel(selectedCandidate)}
                    uiLocale={locale}
                    t={t}
                  />
                )}

                <div className="outreach-history-section">
                  <h3>{t("admin.outreach.historyTitle", "Recent activity")}</h3>
                  {selectedCandidate.recentEvents.length === 0 ? (
                    <p className="muted">
                      {t(
                        "admin.outreach.historyEmpty",
                        "No private outreach changes have been recorded.",
                      )}
                    </p>
                  ) : (
                    <div className="outreach-history">
                      {selectedCandidate.recentEvents.map((event) => (
                        <div key={event.id} className="outreach-history-row">
                          <div>
                            <strong>
                              {event.from_status
                                ? `${statusLabel(event.from_status)} → ${statusLabel(
                                    event.to_status,
                                  )}`
                                : statusLabel(event.to_status)}
                            </strong>
                            <time>
                              {formatDate(event.created_at, locale, true)}
                            </time>
                          </div>
                          {(event.channel || event.follow_up_on) && (
                            <p>
                              {event.channel
                                ? `${t("admin.outreach.via", "Via")} ${channelLabel(
                                    event.channel,
                                  )}`
                                : ""}
                              {event.channel && event.follow_up_on ? " · " : ""}
                              {event.follow_up_on
                                ? `${t(
                                    "admin.outreach.followUpShort",
                                    "Follow up",
                                  )} ${formatDate(event.follow_up_on, locale)}`
                                : ""}
                            </p>
                          )}
                          {event.notes && <p>{event.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="outreach-edit-section">
                  <div className="outreach-form-grid">
                    <label>
                      <span>{t("admin.outreach.statusLabel", "Status")}</span>
                      <select
                        value={draft.status}
                        onChange={(event) => {
                          const nextStatus = event.target
                            .value as OutreachStatus;
                          setManualContactConfirmed(false);
                          setDraft((current) => ({
                            ...current,
                            status: nextStatus,
                            ...(nextStatus === "not_started"
                              ? {
                                  channel: "",
                                  followUpOn: "",
                                  notes: "",
                                }
                              : CONTACT_RECORDED_STATUSES.includes(nextStatus) &&
                                  !current.channel
                                ? {
                                    channel:
                                      preferredOutreachChannel(
                                        selectedCandidate,
                                      ),
                                  }
                              : {}),
                          }));
                        }}
                        disabled={!trackingAvailable}
                      >
                        {STATUSES.map((value) => (
                          <option key={value} value={value}>
                            {statusLabel(value)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>{t("admin.outreach.channelLabel", "Channel")}</span>
                      <select
                        value={draft.channel}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            channel: event.target.value as
                              | OutreachChannel
                              | "",
                          }))
                        }
                        disabled={
                          !trackingAvailable || draft.status === "not_started"
                        }
                      >
                        <option value="">
                          {t(
                            "admin.outreach.channel.choose",
                            "Choose channel",
                          )}
                        </option>
                        {CHANNELS.map((value) => (
                          <option key={value} value={value}>
                            {channelLabel(value)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="outreach-date-control">
                      <label htmlFor="outreach-follow-up-date">
                        {t("admin.outreach.followUpLabel", "Follow-up date")}
                      </label>
                      <input
                        id="outreach-follow-up-date"
                        type="date"
                        value={draft.followUpOn}
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            followUpOn: event.target.value,
                          }))
                        }
                        disabled={
                          !trackingAvailable || draft.status === "not_started"
                        }
                      />
                      {draft.status !== "not_started" && (
                        <div
                          className="outreach-date-presets"
                          aria-label={t(
                            "admin.outreach.quickFollowUp",
                            "Quick follow-up dates",
                          )}
                        >
                          {[1, 3, 7].map((days) => (
                            <button
                              key={days}
                              type="button"
                              onClick={() =>
                                setDraft((current) => ({
                                  ...current,
                                  followUpOn: dateAfterDays(days),
                                }))
                              }
                              disabled={!trackingAvailable}
                            >
                              {days === 1
                                ? t("admin.outreach.tomorrow", "Tomorrow")
                                : t(
                                    `admin.outreach.inDays.${days}`,
                                    `+${days} days`,
                                  )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <label className="outreach-note">
                    <span>
                      {t("admin.outreach.noteLabel", "Private operator note")}
                    </span>
                    <textarea
                      rows={4}
                      maxLength={2000}
                      value={draft.notes}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      placeholder={t(
                        "admin.outreach.notePlaceholder",
                        "Record what happened and the next useful step. Never add sensitive personal data.",
                      )}
                      disabled={
                        !trackingAvailable || draft.status === "not_started"
                      }
                    />
                  </label>
                  {CONTACT_RECORDED_STATUSES.includes(draft.status) && (
                    <label className="outreach-confirmation">
                      <input
                        type="checkbox"
                        checked={manualContactConfirmed}
                        onChange={(event) =>
                          setManualContactConfirmed(event.target.checked)
                        }
                        disabled={!trackingAvailable}
                      />
                      <span>
                        <strong>
                          {t(
                            "admin.outreach.manualConfirmationTitle",
                            "Contact happened outside Mirëbook",
                          )}
                        </strong>
                        <small>
                          {t(
                            "admin.outreach.manualConfirmationBody",
                            "Confirm only after you personally sent the message or completed the conversation.",
                          )}
                        </small>
                      </span>
                    </label>
                  )}
                  <div className="outreach-save-row">
                    <button
                      type="button"
                      className="btn btn-accent"
                      onClick={saveOutreach}
                      disabled={saving || !trackingAvailable}
                    >
                      {saving
                        ? t("admin.outreach.saving", "Saving...")
                        : t("admin.outreach.save", "Save outreach update")}
                    </button>
                    <span>
                      {selectedCandidate.outreach.updated_at &&
                      new Date(selectedCandidate.outreach.updated_at).getTime() > 0
                        ? `${t("admin.outreach.updated", "Updated")} ${formatDate(
                            selectedCandidate.outreach.updated_at,
                            locale,
                            true,
                          )}`
                        : t(
                            "admin.outreach.noActivity",
                            "No outreach activity recorded",
                          )}
                    </span>
                  </div>
                </div>
                {draft.status === "interested" && (
                  <div className="outreach-handoff">
                    <div>
                      <strong>
                        {t(
                          "admin.outreach.handoffTitle",
                          "Ready for ownership handoff",
                        )}
                      </strong>
                      <span>
                        {t(
                          "admin.outreach.handoffBody",
                          "Share the secure claim link. Once submitted, this place leaves Outreach and moves to Ownership claims.",
                        )}
                      </span>
                    </div>
                    <Link href="/admin/directory-claims" className="btn btn-ghost">
                      {t("admin.outreach.handoffAction", "Open claims")}
                    </Link>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </section>

      <style jsx>{`
        .outreach-page {
          max-width: 1320px;
          padding-top: 2.4rem;
          padding-bottom: 5rem;
          display: grid;
          gap: 1rem;
        }

        .outreach-header,
        .outreach-detail-header,
        .outreach-save-row,
        .outreach-context {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }

        .outreach-header {
          align-items: flex-start;
        }

        .outreach-kicker {
          color: var(--accent);
          font-weight: 800;
        }

        .outreach-header-actions,
        .outreach-contact-actions {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          flex-wrap: wrap;
        }

        .outreach-header-actions :global(.btn),
        .outreach-contact-actions :global(.btn),
        .outreach-detail-header :global(.btn) {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
        }

        .outreach-safety {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.8rem;
          align-items: start;
          padding: 0.9rem 1rem;
          border: 1px solid rgba(6, 214, 160, 0.3);
          border-radius: var(--radius);
          background: var(--success-dim);
          color: var(--success);
        }

        .outreach-safety div {
          display: grid;
          gap: 0.2rem;
        }

        .outreach-safety span {
          color: var(--text);
          line-height: 1.45;
        }

        .outreach-message {
          padding: 0.8rem 1rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface);
        }

        .outreach-message.is-error {
          border-color: rgba(255, 77, 109, 0.35);
          color: var(--danger);
        }

        .outreach-message.is-success {
          border-color: rgba(6, 214, 160, 0.35);
          color: var(--success);
        }

        .outreach-message.is-neutral {
          color: var(--muted);
        }

        .outreach-statuses {
          display: grid;
          grid-template-columns: repeat(8, minmax(0, 1fr));
          border: 1px solid var(--border);
          border-radius: var(--radius);
          overflow: hidden;
          background: var(--surface);
        }

        .outreach-statuses button {
          min-width: 0;
          min-height: 4.4rem;
          padding: 0.65rem 0.5rem;
          border: 0;
          border-right: 1px solid var(--border);
          background: transparent;
          color: var(--muted);
          cursor: pointer;
          display: grid;
          place-content: center;
          gap: 0.15rem;
          text-align: center;
        }

        .outreach-statuses button:last-child {
          border-right: 0;
        }

        .outreach-statuses button.is-active {
          background: var(--accent-dim);
          color: var(--text);
          box-shadow: inset 0 -2px 0 var(--accent);
        }

        .outreach-statuses strong {
          font-size: 1.15rem;
        }

        .outreach-statuses span {
          font-size: 0.74rem;
          line-height: 1.2;
        }

        .outreach-context {
          justify-content: flex-start;
          flex-wrap: wrap;
          color: var(--muted);
          font-size: 0.88rem;
        }

        .outreach-context > span {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
        }

        .outreach-filters {
          display: grid;
          grid-template-columns: minmax(220px, 1.4fr) minmax(150px, 0.8fr) minmax(180px, 1fr) auto;
          gap: 0.75rem;
          align-items: end;
          padding: 0.8rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface);
        }

        .outreach-filters label,
        .outreach-form-grid label,
        .outreach-date-control,
        .outreach-note {
          min-width: 0;
          display: grid;
          gap: 0.35rem;
        }

        .outreach-filters label > span,
        .outreach-form-grid label > span,
        .outreach-date-control > label,
        .outreach-note > span {
          color: var(--muted);
          font-size: 0.78rem;
          font-weight: 800;
        }

        .outreach-filters input,
        .outreach-filters select,
        .outreach-form-grid input,
        .outreach-form-grid select,
        .outreach-date-control input,
        .outreach-note textarea {
          width: 100%;
          min-width: 0;
        }

        .outreach-workspace {
          display: grid;
          grid-template-columns: minmax(300px, 0.82fr) minmax(0, 1.18fr);
          gap: 1rem;
          align-items: start;
        }

        .outreach-list,
        .outreach-detail {
          min-width: 0;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface);
          overflow: hidden;
        }

        .outreach-list {
          max-height: calc(100vh - 7rem);
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
        }

        .outreach-list > header {
          min-height: 4rem;
          padding: 0.8rem 0.9rem;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.7rem;
          color: var(--muted);
          font-size: 0.82rem;
        }

        .outreach-list > header div {
          display: grid;
          gap: 0.15rem;
        }

        .outreach-list > header strong {
          color: var(--text);
          font-size: 0.96rem;
        }

        .outreach-rows {
          overflow: auto;
        }

        .outreach-rows > button {
          width: 100%;
          min-width: 0;
          min-height: 4.7rem;
          padding: 0.75rem 0.9rem;
          border: 0;
          border-bottom: 1px solid var(--border);
          background: transparent;
          color: var(--text);
          cursor: pointer;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 0.65rem;
          align-items: center;
          text-align: left;
        }

        .outreach-rows > button:hover,
        .outreach-rows > button.is-selected {
          background: var(--surface-2);
        }

        .outreach-rows > button.is-selected {
          box-shadow: inset 3px 0 0 var(--accent);
        }

        .outreach-row-main {
          min-width: 0;
          display: grid;
          gap: 0.25rem;
        }

        .outreach-row-main > span {
          min-width: 0;
          display: flex;
          gap: 0.4rem;
          align-items: center;
        }

        .outreach-row-main strong,
        .outreach-row-main small {
          overflow-wrap: anywhere;
        }

        .outreach-row-main small {
          color: var(--muted);
          line-height: 1.3;
        }

        .outreach-row-main .is-due {
          flex: 0 0 auto;
          padding: 0.15rem 0.35rem;
          border-radius: 999px;
          background: var(--warning-dim);
          color: var(--warning);
          font-weight: 800;
        }

        .outreach-pill {
          max-width: 8rem;
          padding: 0.28rem 0.48rem;
          border-radius: 999px;
          background: var(--surface-3);
          color: var(--muted);
          font-size: 0.72rem;
          font-weight: 800;
          line-height: 1.2;
          text-align: center;
          overflow-wrap: anywhere;
        }

        .outreach-pill.is-follow_up {
          background: var(--warning-dim);
          color: var(--warning);
        }

        .outreach-pill.is-interested {
          background: var(--success-dim);
          color: var(--success);
        }

        .outreach-pill.is-planned,
        .outreach-pill.is-contacted {
          background: var(--accent-dim);
          color: var(--accent);
        }

        .outreach-list footer {
          padding: 0.7rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          color: var(--muted);
          font-size: 0.8rem;
        }

        .outreach-detail {
          position: sticky;
          top: 6rem;
          max-height: calc(100vh - 7rem);
          overflow-x: hidden;
          overflow-y: auto;
        }

        .outreach-detail-header,
        .outreach-contact-section,
        .outreach-history-section,
        .outreach-edit-section {
          padding: 1rem;
          border-bottom: 1px solid var(--border);
        }

        .outreach-detail-header {
          align-items: flex-start;
        }

        .outreach-detail-header > div {
          min-width: 0;
          display: grid;
          justify-items: start;
          gap: 0.35rem;
        }

        .outreach-detail-header h2 {
          font-size: 1.35rem;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }

        .outreach-detail-header p {
          color: var(--muted);
          line-height: 1.45;
        }

        .outreach-contact-section,
        .outreach-history-section,
        .outreach-edit-section {
          display: grid;
          gap: 0.8rem;
        }

        .outreach-contact-section h3,
        .outreach-history-section h3 {
          font-size: 1rem;
        }

        .outreach-address {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.45rem;
          align-items: start;
          color: var(--muted);
          line-height: 1.4;
        }

        .outreach-contact-actions :global(.btn) {
          max-width: 100%;
          overflow-wrap: anywhere;
          white-space: normal;
          text-align: left;
        }

        .outreach-form-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.75rem;
        }

        .outreach-date-presets {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.3rem;
        }

        .outreach-date-presets button {
          min-width: 0;
          min-height: 2rem;
          padding: 0.25rem 0.35rem;
          border: 1px solid var(--border);
          border-radius: calc(var(--radius) * 0.65);
          background: var(--surface-2);
          color: var(--muted);
          font-size: 0.7rem;
          font-weight: 800;
          cursor: pointer;
        }

        .outreach-date-presets button:hover {
          border-color: var(--accent);
          color: var(--text);
        }

        .outreach-date-presets button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .outreach-history {
          display: grid;
          border-top: 1px solid var(--border);
        }

        .outreach-history-row {
          min-width: 0;
          padding: 0.65rem 0;
          border-bottom: 1px solid var(--border);
          display: grid;
          gap: 0.25rem;
        }

        .outreach-history-row:last-child {
          border-bottom: 0;
          padding-bottom: 0;
        }

        .outreach-history-row > div {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .outreach-history-row time,
        .outreach-history-row p {
          color: var(--muted);
          font-size: 0.78rem;
          line-height: 1.4;
          overflow-wrap: anywhere;
        }

        .outreach-note textarea {
          resize: vertical;
          min-height: 6.5rem;
        }

        .outreach-confirmation {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.65rem;
          align-items: start;
          padding: 0.75rem;
          border: 1px solid rgba(255, 107, 53, 0.3);
          border-radius: var(--radius);
          background: var(--accent-dim);
          cursor: pointer;
        }

        .outreach-confirmation input {
          width: 1rem;
          height: 1rem;
          margin-top: 0.15rem;
          accent-color: var(--accent);
        }

        .outreach-confirmation span {
          display: grid;
          gap: 0.2rem;
        }

        .outreach-confirmation small {
          color: var(--muted);
          line-height: 1.4;
        }

        .outreach-handoff {
          padding: 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          background: var(--success-dim);
        }

        .outreach-handoff > div {
          min-width: 0;
          display: grid;
          gap: 0.25rem;
        }

        .outreach-handoff span {
          color: var(--muted);
          font-size: 0.84rem;
          line-height: 1.4;
        }

        .outreach-handoff :global(.btn) {
          flex: 0 0 auto;
        }

        .outreach-save-row {
          justify-content: flex-start;
          flex-wrap: wrap;
        }

        .outreach-save-row span {
          color: var(--muted);
          font-size: 0.82rem;
        }

        .outreach-empty {
          min-height: 12rem;
          padding: 2rem 1rem;
          display: grid;
          place-content: center;
          justify-items: center;
          gap: 0.45rem;
          color: var(--muted);
          text-align: center;
        }

        .outreach-empty strong {
          color: var(--text);
        }

        @media (max-width: 1040px) {
          .outreach-statuses {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          .outreach-statuses button:nth-child(4) {
            border-right: 0;
          }

          .outreach-statuses button:nth-child(-n + 4) {
            border-bottom: 1px solid var(--border);
          }

          .outreach-filters {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 820px) {
          .outreach-page {
            padding-top: 1.4rem;
          }

          .outreach-workspace {
            grid-template-columns: minmax(0, 1fr);
          }

          .outreach-detail {
            position: static;
            max-height: none;
            overflow: hidden;
          }

          .outreach-list {
            max-height: none;
            display: block;
          }

          .outreach-rows {
            max-height: 30rem;
          }
        }

        @media (max-width: 560px) {
          .outreach-page {
            width: 100%;
            padding-left: 0.75rem;
            padding-right: 0.75rem;
          }

          .outreach-header,
          .outreach-detail-header {
            display: grid;
          }

          .outreach-header-actions {
            width: 100%;
          }

          .outreach-header-actions :global(.btn) {
            flex: 1 1 0;
            justify-content: center;
          }

          .outreach-statuses {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .outreach-statuses button {
            border-right: 1px solid var(--border);
            border-bottom: 1px solid var(--border);
          }

          .outreach-statuses button:nth-child(even) {
            border-right: 0;
          }

          .outreach-statuses button:nth-last-child(-n + 2) {
            border-bottom: 0;
          }

          .outreach-filters,
          .outreach-form-grid {
            grid-template-columns: minmax(0, 1fr);
          }

          .outreach-filters :global(.btn),
          .outreach-detail-header :global(.btn),
          .outreach-save-row :global(.btn) {
            width: 100%;
            justify-content: center;
          }

          .outreach-context {
            display: grid;
            justify-content: stretch;
          }

          .outreach-rows > button {
            grid-template-columns: minmax(0, 1fr);
          }

          .outreach-pill {
            justify-self: start;
          }

          .outreach-contact-actions {
            display: grid;
          }

          .outreach-contact-actions :global(.btn) {
            width: 100%;
          }

          .outreach-handoff {
            display: grid;
          }

          .outreach-handoff :global(.btn) {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  );
}
