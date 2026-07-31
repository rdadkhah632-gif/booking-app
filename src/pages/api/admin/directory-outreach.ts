import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
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
const CONTACT_RECORDED_STATUSES = [
  "contacted",
  "follow_up",
  "interested",
  "declined",
  "unreachable",
] as const;
const PILOT_LIMIT = 10;
const PILOT_CITY_LIMIT = 2;
const PILOT_CATEGORY_LIMIT = 3;
const PILOT_ACTIVE_STATUSES = [
  "planned",
  "contacted",
  "follow_up",
  "interested",
] as const;
const OUTREACH_CATEGORIES = [
  "beauty_grooming",
  "dental_health",
  "wellness_fitness",
  "events",
  "learning_lessons",
  "tours_activities",
  "rentals",
  "food_drink",
  "lodging",
] as const;

type OutreachStatus = (typeof STATUSES)[number];
type OutreachChannel = (typeof CHANNELS)[number];
type LaunchFit = "strong" | "ready" | "prepare";
type LaunchReason =
  | "direct_email"
  | "social_contact"
  | "phone_contact"
  | "website_contact"
  | "bilingual_profile"
  | "image_ready"
  | "appointment_fit";

type DirectoryCandidateRow = {
  id: string;
  name: string;
  category_key: string;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country_code: string;
  phone?: string | null;
  website?: string | null;
  email?: string | null;
  social_urls?: unknown;
  public_facts_reviewed?: boolean | null;
  public_name?: string | null;
  public_category_key?: string | null;
  public_address?: string | null;
  public_phone?: string | null;
  public_website?: string | null;
  editorial_description_en?: string | null;
  editorial_description_sq?: string | null;
  image_url?: string | null;
  listing_status: string;
  claim_status: string;
  linked_business_id?: string | null;
};

type OutreachRow = {
  directory_place_id: string;
  status: OutreachStatus;
  channel?: OutreachChannel | null;
  follow_up_on?: string | null;
  notes?: string | null;
  first_contacted_at?: string | null;
  last_contacted_at?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
};

type OutreachEventRow = {
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
  address: string | null;
  city: string | null;
  region: string | null;
  countryCode: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  socialUrls: string[];
  outreach: OutreachRow;
  recentEvents: OutreachEventRow[];
  isDue: boolean;
  launchPilot: {
    rank: number | null;
    score: number;
    fit: LaunchFit;
    recommendedChannel: OutreachChannel;
    contactRoutes: number;
    reasons: LaunchReason[];
  };
};

function bearerToken(request: NextApiRequest) {
  const authorization = request.headers.authorization || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanQuery(value: string | string[] | undefined, maxLength = 100) {
  return cleanText(Array.isArray(value) ? value[0] : value, maxLength);
}

function numberQuery(
  value: string | string[] | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

function safeWebUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function socialUrls(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.flatMap((item) => {
        if (typeof item === "string") {
          const url = safeWebUrl(item);
          return url ? [url] : [];
        }
        if (item && typeof item === "object") {
          const row = item as Record<string, unknown>;
          const url = safeWebUrl(row.url || row.href || row.value);
          return url ? [url] : [];
        }
        return [];
      }),
    ),
  ).slice(0, 8);
}

function isMissingOutreachSchema(error: { code?: string | null } | null) {
  return ["42P01", "42703", "PGRST202", "PGRST205"].includes(
    error?.code || "",
  );
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function virtualOutreach(placeId: string): OutreachRow {
  const now = new Date(0).toISOString();
  return {
    directory_place_id: placeId,
    status: "not_started",
    channel: null,
    follow_up_on: null,
    notes: null,
    first_contacted_at: null,
    last_contacted_at: null,
    updated_by: null,
    created_at: now,
    updated_at: now,
  };
}

function statusRank(status: OutreachStatus) {
  const order: Record<OutreachStatus, number> = {
    follow_up: 0,
    interested: 1,
    planned: 2,
    contacted: 3,
    not_started: 4,
    unreachable: 5,
    declined: 6,
  };
  return order[status];
}

function pilotStatusRank(status: OutreachStatus) {
  const order: Record<OutreachStatus, number> = {
    interested: 0,
    follow_up: 1,
    contacted: 2,
    planned: 3,
    not_started: 4,
    unreachable: 5,
    declined: 6,
  };
  return order[status];
}

function launchPilotProfile(
  place: DirectoryCandidateRow,
  candidateSocialUrls: string[],
) {
  const hasEmail = Boolean(place.email?.trim());
  const hasSocial = candidateSocialUrls.length > 0;
  const hasPhone = Boolean((place.public_phone || place.phone)?.trim());
  const hasWebsite = Boolean(
    safeWebUrl(place.public_website || place.website),
  );
  const hasBilingualProfile = Boolean(
    place.editorial_description_en?.trim() &&
      place.editorial_description_sq?.trim(),
  );
  const hasImage = Boolean(place.image_url?.trim());
  const categoryKey = place.public_category_key || place.category_key;
  const contactRoutes = [hasEmail, hasSocial, hasPhone, hasWebsite].filter(
    Boolean,
  ).length;
  const categoryScores: Record<string, number> = {
    beauty_grooming: 24,
    dental_health: 24,
    wellness_fitness: 22,
    learning_lessons: 20,
    tours_activities: 18,
    rentals: 16,
    events: 14,
    food_drink: 12,
    lodging: 10,
  };
  const reasons: LaunchReason[] = [];

  if (hasEmail) reasons.push("direct_email");
  if (hasSocial) reasons.push("social_contact");
  if (hasPhone) reasons.push("phone_contact");
  if (hasWebsite) reasons.push("website_contact");
  if (hasBilingualProfile) reasons.push("bilingual_profile");
  if (hasImage) reasons.push("image_ready");
  reasons.push("appointment_fit");

  const score =
    (hasEmail ? 34 : 0) +
    (hasSocial ? 28 : 0) +
    (hasPhone ? 24 : 0) +
    (hasWebsite ? 12 : 0) +
    Math.max(0, contactRoutes - 1) * 3 +
    (hasBilingualProfile ? 8 : 0) +
    (hasImage ? 3 : 0) +
    (categoryScores[categoryKey] || 8);
  const recommendedChannel: OutreachChannel = hasEmail
    ? "email"
    : hasSocial
      ? "social"
      : hasPhone
        ? "phone"
        : hasWebsite
          ? "website"
          : "in_person";
  const fit: LaunchFit =
    hasBilingualProfile && contactRoutes >= 2
      ? "strong"
      : hasBilingualProfile && contactRoutes >= 1
        ? "ready"
        : "prepare";

  return {
    rank: null,
    score,
    fit,
    recommendedChannel,
    contactRoutes,
    reasons,
  };
}

function selectLaunchPilotCandidates(candidates: OutreachCandidate[]) {
  const ranked = candidates
    .filter(
      (candidate) =>
        !["declined", "unreachable"].includes(candidate.outreach.status),
    )
    .sort((left, right) => {
      const statusDifference =
        pilotStatusRank(left.outreach.status) -
        pilotStatusRank(right.outreach.status);
      if (statusDifference !== 0) return statusDifference;
      if (left.launchPilot.score !== right.launchPilot.score) {
        return right.launchPilot.score - left.launchPilot.score;
      }
      return left.name.localeCompare(right.name, "en");
    });
  const selected: OutreachCandidate[] = [];
  const deferred: OutreachCandidate[] = [];
  const cityCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();

  const addCandidate = (candidate: OutreachCandidate) => {
    selected.push(candidate);
    cityCounts.set(candidate.city, (cityCounts.get(candidate.city) || 0) + 1);
    categoryCounts.set(
      candidate.categoryKey,
      (categoryCounts.get(candidate.categoryKey) || 0) + 1,
    );
  };

  for (const candidate of ranked) {
    if (selected.length >= PILOT_LIMIT) break;

    const isActive = PILOT_ACTIVE_STATUSES.some(
      (status) => status === candidate.outreach.status,
    );
    const cityHasRoom =
      (cityCounts.get(candidate.city) || 0) < PILOT_CITY_LIMIT;
    const categoryHasRoom =
      (categoryCounts.get(candidate.categoryKey) || 0) <
      PILOT_CATEGORY_LIMIT;

    if (isActive || (cityHasRoom && categoryHasRoom)) {
      addCandidate(candidate);
    } else {
      deferred.push(candidate);
    }
  }

  for (const candidate of deferred) {
    if (selected.length >= PILOT_LIMIT) break;
    addCandidate(candidate);
  }

  return selected;
}

async function requireAdmin(request: NextApiRequest) {
  const token = bearerToken(request);
  if (!token) return null;

  const supabase = createSupabaseAdminClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, is_admin")
    .eq("id", user.id)
    .maybeSingle<{ id: string; is_admin?: boolean | null }>();

  return profileError || !profile?.is_admin ? null : { supabase, user };
}

async function handleGet(
  request: NextApiRequest,
  response: NextApiResponse,
  admin: NonNullable<Awaited<ReturnType<typeof requireAdmin>>>,
) {
  const requestedStatus = cleanQuery(request.query.status, 30);
  const status = STATUSES.includes(requestedStatus as OutreachStatus)
    ? (requestedStatus as OutreachStatus)
    : "";
  const category = cleanQuery(request.query.category, 50);
  const city = cleanQuery(request.query.city, 80);
  const search = cleanQuery(request.query.search, 100).toLocaleLowerCase();
  const pilotOnly = cleanQuery(request.query.pilot, 10) === "1";
  const limit = numberQuery(request.query.limit, 50, 1, 100);
  const offset = numberQuery(request.query.offset, 0, 0, 10_000);

  const { data: candidateRows, error: candidatesError } = await admin.supabase
    .from("directory_places")
    .select(
      "id, name, category_key, address, city, region, country_code, phone, website, email, social_urls, public_facts_reviewed, public_name, public_category_key, public_address, public_phone, public_website, editorial_description_en, editorial_description_sq, image_url, listing_status, claim_status, linked_business_id",
    )
    .eq("listing_status", "active")
    .eq("claim_status", "unclaimed")
    .is("linked_business_id", null)
    .eq("public_facts_reviewed", true)
    .order("public_name", { ascending: true })
    .limit(1_000)
    .returns<DirectoryCandidateRow[]>();

  if (candidatesError) throw candidatesError;

  const eligibleRows = (candidateRows || []).filter((place) => {
    const categoryKey = place.public_category_key || place.category_key;
    return OUTREACH_CATEGORIES.includes(
      categoryKey as (typeof OUTREACH_CATEGORIES)[number],
    );
  });
  const placeIds = eligibleRows.map((place) => place.id);

  const [{ data: openClaimRows, error: openClaimsError }, outreachResult] =
    await Promise.all([
      placeIds.length
        ? admin.supabase
            .from("business_claims")
            .select("directory_place_id")
            .in("directory_place_id", placeIds)
            .in("status", ["pending", "needs_more_info"])
        : Promise.resolve({ data: [], error: null }),
      placeIds.length
        ? admin.supabase
            .from("directory_place_outreach")
            .select(
              "directory_place_id, status, channel, follow_up_on, notes, first_contacted_at, last_contacted_at, updated_by, created_at, updated_at",
            )
            .in("directory_place_id", placeIds)
            .returns<OutreachRow[]>()
        : Promise.resolve({ data: [] as OutreachRow[], error: null }),
    ]);

  if (openClaimsError) throw openClaimsError;

  let trackingAvailable = !outreachResult.error;
  if (outreachResult.error && !isMissingOutreachSchema(outreachResult.error)) {
    throw outreachResult.error;
  }

  let outreachEvents: OutreachEventRow[] = [];
  if (trackingAvailable && placeIds.length) {
    const { data: eventRows, error: eventsError } = await admin.supabase
      .from("directory_place_outreach_events")
      .select(
        "id, directory_place_id, from_status, to_status, channel, follow_up_on, notes, created_at",
      )
      .in("directory_place_id", placeIds)
      .order("created_at", { ascending: false })
      .limit(500)
      .returns<OutreachEventRow[]>();

    if (eventsError) {
      if (isMissingOutreachSchema(eventsError)) {
        trackingAvailable = false;
      } else {
        throw eventsError;
      }
    } else {
      outreachEvents = eventRows || [];
    }
  }

  const openClaimPlaceIds = new Set(
    (openClaimRows || []).map((claim) => claim.directory_place_id),
  );
  const outreachByPlace = new Map(
    (outreachResult.data || []).map((row) => [row.directory_place_id, row]),
  );
  const eventsByPlace = new Map<string, OutreachEventRow[]>();
  outreachEvents.forEach((event) => {
    const current = eventsByPlace.get(event.directory_place_id) || [];
    if (current.length < 5) {
      current.push(event);
      eventsByPlace.set(event.directory_place_id, current);
    }
  });
  const today = todayIso();

  const candidates: OutreachCandidate[] = eligibleRows
    .filter((place) => !openClaimPlaceIds.has(place.id))
    .map((place) => {
      const outreach = outreachByPlace.get(place.id) || virtualOutreach(place.id);
      const candidateSocialUrls = socialUrls(place.social_urls);
      return {
        id: place.id,
        name: place.public_name || place.name,
        categoryKey: place.public_category_key || place.category_key,
        address: place.public_address || place.address || null,
        city: place.city || null,
        region: place.region || null,
        countryCode: place.country_code,
        phone: place.public_phone || place.phone || null,
        email: place.email || null,
        website: safeWebUrl(place.public_website || place.website),
        socialUrls: candidateSocialUrls,
        outreach,
        recentEvents: eventsByPlace.get(place.id) || [],
        isDue: Boolean(
          outreach.follow_up_on &&
            outreach.follow_up_on <= today &&
            !["declined", "unreachable"].includes(outreach.status),
        ),
        launchPilot: launchPilotProfile(
          place,
          candidateSocialUrls,
        ),
      };
    });

  const pilotCandidates = selectLaunchPilotCandidates(candidates);
  const pilotRankById = new Map(
    pilotCandidates.map((candidate, index) => [candidate.id, index + 1]),
  );
  candidates.forEach((candidate) => {
    candidate.launchPilot.rank = pilotRankById.get(candidate.id) || null;
  });

  const categoryFiltered = category
    ? candidates.filter((candidate) => candidate.categoryKey === category)
    : candidates;
  const cityFiltered = city
    ? categoryFiltered.filter((candidate) => candidate.city === city)
    : categoryFiltered;
  const searchFiltered = search
    ? cityFiltered.filter((candidate) =>
        [
          candidate.name,
          candidate.city,
          candidate.address,
          candidate.phone,
          candidate.email,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase().includes(search)),
      )
    : cityFiltered;

  const pilotFiltered = pilotOnly
    ? searchFiltered.filter((candidate) => candidate.launchPilot.rank !== null)
    : searchFiltered;

  const counts = Object.fromEntries(
    STATUSES.map((value) => [
      value,
      pilotFiltered.filter(
        (candidate) => candidate.outreach.status === value,
      ).length,
    ]),
  ) as Record<OutreachStatus, number>;
  const dueFollowUps = pilotFiltered.filter((candidate) => candidate.isDue).length;
  const statusFiltered = status
    ? pilotFiltered.filter(
        (candidate) => candidate.outreach.status === status,
      )
    : pilotFiltered;
  const sorted = statusFiltered.sort((left, right) => {
    if (pilotOnly) {
      const leftRank = left.launchPilot.rank || Number.MAX_SAFE_INTEGER;
      const rightRank = right.launchPilot.rank || Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) return leftRank - rightRank;
    }
    if (left.isDue !== right.isDue) return left.isDue ? -1 : 1;
    const statusDifference =
      statusRank(left.outreach.status) - statusRank(right.outreach.status);
    if (statusDifference !== 0) return statusDifference;
    const leftFollowUp = left.outreach.follow_up_on || "9999-12-31";
    const rightFollowUp = right.outreach.follow_up_on || "9999-12-31";
    if (leftFollowUp !== rightFollowUp) {
      return leftFollowUp.localeCompare(rightFollowUp);
    }
    return left.name.localeCompare(right.name, "en");
  });

  const cities = Array.from(
    new Set(candidates.flatMap((candidate) => (candidate.city ? [candidate.city] : []))),
  ).sort((left, right) => left.localeCompare(right, "sq"));
  const categories = Array.from(
    new Set(candidates.map((candidate) => candidate.categoryKey)),
  ).sort();

  response.status(200).json({
    candidates: sorted.slice(offset, offset + limit),
    counts,
    dueFollowUps,
    trackingAvailable,
    excludedOpenClaims: openClaimPlaceIds.size,
    pilotSummary: {
      limit: PILOT_LIMIT,
      selected: pilotCandidates.length,
      ready: pilotCandidates.filter(
        (candidate) => candidate.launchPilot.fit !== "prepare",
      ).length,
      inProgress: pilotCandidates.filter((candidate) =>
        PILOT_ACTIVE_STATUSES.some(
          (status) => status === candidate.outreach.status,
        ),
      ).length,
      interested: pilotCandidates.filter(
        (candidate) => candidate.outreach.status === "interested",
      ).length,
    },
    filters: { cities, categories },
    pagination: {
      total: sorted.length,
      limit,
      offset,
    },
  });
}

async function handlePost(
  request: NextApiRequest,
  response: NextApiResponse,
  admin: NonNullable<Awaited<ReturnType<typeof requireAdmin>>>,
) {
  const body = (request.body || {}) as Record<string, unknown>;
  const placeId = cleanText(body.placeId, 50);
  const status = cleanText(body.status, 30) as OutreachStatus;
  const channel = cleanText(body.channel, 30) as OutreachChannel;
  const followUpOn = cleanText(body.followUpOn, 10);
  const notes = cleanText(body.notes, 2_000);
  const manualContactConfirmed = body.manualContactConfirmed === true;

  if (!UUID_PATTERN.test(placeId)) {
    response.status(400).json({ error: "Choose a valid directory place." });
    return;
  }
  if (!STATUSES.includes(status)) {
    response.status(400).json({ error: "Choose a valid outreach status." });
    return;
  }
  if (channel && !CHANNELS.includes(channel)) {
    response.status(400).json({ error: "Choose a valid outreach channel." });
    return;
  }
  if (followUpOn && !DATE_PATTERN.test(followUpOn)) {
    response.status(400).json({ error: "Choose a valid follow-up date." });
    return;
  }
  if (followUpOn && followUpOn < todayIso()) {
    response.status(400).json({ error: "Follow-up date cannot be in the past." });
    return;
  }
  if (
    ["contacted", "follow_up", "interested", "declined", "unreachable"].includes(
      status,
    ) &&
    !channel
  ) {
    response.status(400).json({ error: "Choose how the business was contacted." });
    return;
  }
  if (status === "follow_up" && !followUpOn) {
    response.status(400).json({ error: "Choose a follow-up date." });
    return;
  }
  if (["declined", "unreachable"].includes(status) && !notes) {
    response.status(400).json({ error: "Add a short private note for this outcome." });
    return;
  }
  if (
    CONTACT_RECORDED_STATUSES.some((value) => value === status) &&
    !manualContactConfirmed
  ) {
    response.status(400).json({
      code: "manual_contact_confirmation_required",
      error: "Confirm that contact happened outside Mirëbook before saving.",
    });
    return;
  }

  const { data, error } = await admin.supabase.rpc(
    "mirebook_update_directory_outreach",
    {
      p_place_id: placeId,
      p_actor_user_id: admin.user.id,
      p_status: status,
      p_channel: channel || null,
      p_follow_up_on: followUpOn || null,
      p_notes: notes || null,
    },
  );

  if (error) {
    if (isMissingOutreachSchema(error)) {
      response.status(503).json({
        error: "Outreach tracking is being prepared.",
        trackingAvailable: false,
      });
      return;
    }
    if (["22023"].includes(error.code || "")) {
      response.status(400).json({ error: "Check the outreach details and try again." });
      return;
    }
    if (["23505", "P0002"].includes(error.code || "")) {
      response.status(409).json({
        error: "This place is no longer available in the outreach queue.",
      });
      return;
    }
    if (error.code === "42501") {
      response.status(403).json({ error: "Admin access is required." });
      return;
    }
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  response.status(200).json({ outreach: row });
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("Vary", "Authorization");

  if (!["GET", "POST"].includes(request.method || "")) {
    response.setHeader("Allow", "GET, POST");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      response.status(403).json({ error: "Admin access is required." });
      return;
    }

    if (request.method === "GET") {
      await handleGet(request, response, admin);
      return;
    }

    await handlePost(request, response, admin);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[directory-outreach]", error);
    }
    response.status(500).json({
      error: "The outreach workspace is temporarily unavailable.",
    });
  }
}
