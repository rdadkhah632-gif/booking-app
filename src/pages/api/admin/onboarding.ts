import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

type OnboardingStatus = (typeof STATUSES)[number];
type AssetsStatus = (typeof ASSET_STATUSES)[number];
type PermissionSource = (typeof PERMISSION_SOURCES)[number];

type OnboardingCaseRow = {
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

type OnboardingEventRow = {
  id: string;
  case_id: string;
  from_status?: OnboardingStatus | null;
  to_status: OnboardingStatus;
  action: string;
  snapshot?: Record<string, unknown> | null;
  created_at: string;
};

type DirectorySuggestionRow = {
  id: string;
  name: string;
  public_name?: string | null;
  city?: string | null;
  category_key?: string | null;
  public_category_key?: string | null;
  address?: string | null;
  public_address?: string | null;
  phone?: string | null;
  public_phone?: string | null;
  website?: string | null;
  public_website?: string | null;
  email?: string | null;
  social_urls?: unknown;
  listing_status: string;
  claim_status: string;
  linked_business_id?: string | null;
};

type BusinessSuggestionRow = {
  id: string;
  user_id?: string | null;
  name: string;
  city?: string | null;
  category?: string | null;
  address?: string | null;
  phone?: string | null;
  billing_email?: string | null;
  published?: boolean | null;
};

type ProfileRow = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  phone?: string | null;
};

type OnboardingBody = {
  caseId?: unknown;
  directoryPlaceId?: unknown;
  businessId?: unknown;
  prospectName?: unknown;
  categoryKey?: unknown;
  city?: unknown;
  address?: unknown;
  website?: unknown;
  socialUrl?: unknown;
  ownerName?: unknown;
  ownerEmail?: unknown;
  ownerPhone?: unknown;
  preferredLanguage?: unknown;
  status?: unknown;
  listingInterest?: unknown;
  bookingInterest?: unknown;
  businessAppInterest?: unknown;
  assetsStatus?: unknown;
  profileMediaPermission?: unknown;
  marketingMediaPermission?: unknown;
  permissionSource?: unknown;
  permissionGrantedBy?: unknown;
  permissionNote?: unknown;
  permissionGrantedAt?: unknown;
  permissionConfirmed?: unknown;
  privateNotes?: unknown;
};

const CASE_SELECT = `
  id,
  directory_place_id,
  business_id,
  prospect_name,
  category_key,
  city,
  address,
  website,
  social_url,
  owner_name,
  owner_email,
  owner_phone,
  preferred_language,
  status,
  listing_interest,
  booking_interest,
  business_app_interest,
  assets_status,
  profile_media_permission,
  marketing_media_permission,
  permission_source,
  permission_granted_by,
  permission_note,
  permission_granted_at,
  private_notes,
  created_at,
  updated_at
`;

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

function safeSearchTerm(value: string) {
  return value
    .replace(/[,()%_*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function safeHttpsUrl(value: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalize(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchScore(query: string, values: Array<string | null | undefined>) {
  const term = normalize(query);
  let score = 0;
  values.forEach((value, index) => {
    const candidate = normalize(value);
    if (!candidate) return;
    const weight = index === 0 ? 60 : Math.max(10, 34 - index * 4);
    if (candidate === term) score = Math.max(score, weight + 40);
    else if (candidate.startsWith(term)) score = Math.max(score, weight + 24);
    else if (candidate.includes(term)) score = Math.max(score, weight + 10);
  });
  return score;
}

function socialUrl(value: unknown) {
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    const candidate =
      typeof item === "string"
        ? item
        : item && typeof item === "object"
          ? String(
              (item as Record<string, unknown>).url ||
                (item as Record<string, unknown>).href ||
                "",
            )
          : "";
    const safeUrl = safeHttpsUrl(candidate);
    if (safeUrl) return safeUrl;
  }
  return null;
}

function isMissingOnboardingSchema(error: { code?: string | null } | null) {
  return ["42P01", "42703", "PGRST202", "PGRST205"].includes(error?.code || "");
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
  if (profileError || !profile?.is_admin) return null;

  return { supabase, user };
}

async function loadCases(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  status: string,
  query: string,
  limit = 100,
) {
  let request = supabase
    .from("business_onboarding_cases")
    .select(CASE_SELECT)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (STATUSES.includes(status as OnboardingStatus)) {
    request = request.eq("status", status);
  }
  if (query) {
    const pattern = `%${query}%`;
    request = request.or(
      [
        `prospect_name.ilike.${pattern}`,
        `city.ilike.${pattern}`,
        `owner_name.ilike.${pattern}`,
        `owner_email.ilike.${pattern}`,
        `owner_phone.ilike.${pattern}`,
      ].join(","),
    );
  }

  return request.returns<OnboardingCaseRow[]>();
}

async function searchEntities(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  query: string,
  cases: OnboardingCaseRow[],
) {
  if (query.length < 2) return [];
  const pattern = `%${query}%`;
  const [directoryResult, directBusinessResult, matchingProfileResult] =
    await Promise.all([
      supabase
        .from("directory_places")
        .select(
          "id, name, public_name, city, category_key, public_category_key, address, public_address, phone, public_phone, website, public_website, email, social_urls, listing_status, claim_status, linked_business_id",
        )
        .or(
          [
            `name.ilike.${pattern}`,
            `public_name.ilike.${pattern}`,
            `city.ilike.${pattern}`,
            `address.ilike.${pattern}`,
            `public_address.ilike.${pattern}`,
            `phone.ilike.${pattern}`,
            `public_phone.ilike.${pattern}`,
            `email.ilike.${pattern}`,
          ].join(","),
        )
        .limit(15)
        .returns<DirectorySuggestionRow[]>(),
      supabase
        .from("businesses")
        .select(
          "id, user_id, name, city, category, address, phone, billing_email, published",
        )
        .or(
          [
            `name.ilike.${pattern}`,
            `city.ilike.${pattern}`,
            `phone.ilike.${pattern}`,
            `billing_email.ilike.${pattern}`,
          ].join(","),
        )
        .limit(15)
        .returns<BusinessSuggestionRow[]>(),
      supabase
        .from("profiles")
        .select("id, email, full_name, phone")
        .or(
          [
            `email.ilike.${pattern}`,
            `full_name.ilike.${pattern}`,
            `phone.ilike.${pattern}`,
          ].join(","),
        )
        .limit(15)
        .returns<ProfileRow[]>(),
    ]);

  if (directoryResult.error) throw directoryResult.error;
  if (directBusinessResult.error) throw directBusinessResult.error;
  if (matchingProfileResult.error) throw matchingProfileResult.error;

  const matchingOwnerIds = (matchingProfileResult.data || []).map(
    (profile) => profile.id,
  );
  const ownerBusinessResult = matchingOwnerIds.length
    ? await supabase
        .from("businesses")
        .select(
          "id, user_id, name, city, category, address, phone, billing_email, published",
        )
        .in("user_id", matchingOwnerIds)
        .limit(15)
        .returns<BusinessSuggestionRow[]>()
    : { data: [] as BusinessSuggestionRow[], error: null };
  if (ownerBusinessResult.error) throw ownerBusinessResult.error;

  const businessRows = Array.from(
    new Map(
      [
        ...(directBusinessResult.data || []),
        ...(ownerBusinessResult.data || []),
      ].map((business) => [business.id, business]),
    ).values(),
  );
  const ownerIds = Array.from(
    new Set(
      businessRows.flatMap((business) =>
        business.user_id ? [business.user_id] : [],
      ),
    ),
  );
  const loadedProfiles = new Map(
    (matchingProfileResult.data || []).map((profile) => [profile.id, profile]),
  );
  const missingOwnerIds = ownerIds.filter((id) => !loadedProfiles.has(id));
  const profileResult = missingOwnerIds.length
    ? await supabase
        .from("profiles")
        .select("id, email, full_name, phone")
        .in("id", missingOwnerIds)
        .returns<ProfileRow[]>()
    : { data: [] as ProfileRow[], error: null };
  if (profileResult.error) throw profileResult.error;

  const profiles = new Map(
    [...(matchingProfileResult.data || []), ...(profileResult.data || [])].map(
      (profile) => [profile.id, profile],
    ),
  );
  const caseByDirectory = new Map(
    cases.flatMap((item) =>
      item.directory_place_id ? [[item.directory_place_id, item] as const] : [],
    ),
  );
  const caseByBusiness = new Map(
    cases.flatMap((item) =>
      item.business_id ? [[item.business_id, item] as const] : [],
    ),
  );

  const suggestions = [
    ...(directoryResult.data || []).map((place) => {
      const onboardingCase = caseByDirectory.get(place.id);
      return {
        type: "directory" as const,
        id: place.id,
        name: place.public_name || place.name,
        city: place.city || null,
        categoryKey: place.public_category_key || place.category_key || null,
        address: place.public_address || place.address || null,
        phone: place.public_phone || place.phone || null,
        email: place.email || null,
        website: place.public_website || place.website || null,
        socialUrl: socialUrl(place.social_urls),
        state: place.listing_status,
        claimStatus: place.claim_status,
        linkedBusinessId: place.linked_business_id || null,
        caseId: onboardingCase?.id || null,
        onboardingStatus: onboardingCase?.status || null,
        score: matchScore(query, [
          place.public_name || place.name,
          place.city,
          place.public_address || place.address,
          place.public_phone || place.phone,
          place.email,
        ]),
      };
    }),
    ...businessRows.map((business) => {
      const owner = business.user_id ? profiles.get(business.user_id) : null;
      const onboardingCase = caseByBusiness.get(business.id);
      return {
        type: "business" as const,
        id: business.id,
        name: business.name,
        city: business.city || null,
        categoryKey: business.category || null,
        address: business.address || null,
        phone: business.phone || owner?.phone || null,
        email: business.billing_email || owner?.email || null,
        website: null,
        socialUrl: null,
        state: business.published ? "published" : "draft",
        claimStatus: null,
        linkedBusinessId: business.id,
        ownerName: owner?.full_name || null,
        caseId: onboardingCase?.id || null,
        onboardingStatus: onboardingCase?.status || null,
        score: matchScore(query, [
          business.name,
          business.city,
          business.address,
          business.phone,
          business.billing_email,
          owner?.email,
          owner?.full_name,
        ]),
      };
    }),
    ...cases
      .filter((item) => !item.directory_place_id && !item.business_id)
      .map((item) => ({
        type: "onboarding" as const,
        id: item.id,
        name: item.prospect_name,
        city: item.city || null,
        categoryKey: item.category_key || null,
        address: item.address || null,
        phone: item.owner_phone || null,
        email: item.owner_email || null,
        website: item.website || null,
        socialUrl: item.social_url || null,
        state: item.status,
        claimStatus: null,
        linkedBusinessId: null,
        ownerName: item.owner_name || null,
        caseId: item.id,
        onboardingStatus: item.status,
        score: matchScore(query, [
          item.prospect_name,
          item.city,
          item.address,
          item.owner_name,
          item.owner_email,
          item.owner_phone,
        ]),
      })),
  ];

  return suggestions
    .filter((item) => item.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score || left.name.localeCompare(right.name, "sq"),
    )
    .slice(0, 12);
}

async function handleGet(
  request: NextApiRequest,
  response: NextApiResponse,
  admin: NonNullable<Awaited<ReturnType<typeof requireAdmin>>>,
) {
  const query = safeSearchTerm(cleanQuery(request.query.q, 80));
  const status = cleanQuery(request.query.status, 40);
  const caseId = cleanQuery(request.query.caseId, 50);
  const [caseResult, allCaseResult] = await Promise.all([
    loadCases(admin.supabase, status, query),
    loadCases(admin.supabase, "", "", 500),
  ]);

  let storageAvailable = !caseResult.error && !allCaseResult.error;
  if (caseResult.error && !isMissingOnboardingSchema(caseResult.error)) {
    throw caseResult.error;
  }
  if (allCaseResult.error && !isMissingOnboardingSchema(allCaseResult.error)) {
    throw allCaseResult.error;
  }
  const cases = caseResult.data || [];
  const allCases = allCaseResult.data || [];
  const selectedCase = UUID_PATTERN.test(caseId)
    ? allCases.find((item) => item.id === caseId) || null
    : null;
  const suggestions = await searchEntities(admin.supabase, query, allCases);

  let events: OnboardingEventRow[] = [];
  if (storageAvailable && UUID_PATTERN.test(caseId)) {
    const eventResult = await admin.supabase
      .from("business_onboarding_case_events")
      .select(
        "id, case_id, from_status, to_status, action, snapshot, created_at",
      )
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<OnboardingEventRow[]>();
    if (eventResult.error) {
      if (isMissingOnboardingSchema(eventResult.error))
        storageAvailable = false;
      else throw eventResult.error;
    } else {
      events = eventResult.data || [];
    }
  }

  const counts = Object.fromEntries(
    STATUSES.map((value) => [
      value,
      allCases.filter((item) => item.status === value).length,
    ]),
  );

  response.status(200).json({
    storageAvailable,
    sqlRequired: storageAvailable
      ? null
      : "38_assisted_business_onboarding.sql",
    cases,
    selectedCase,
    suggestions,
    events,
    counts,
  });
}

async function handlePost(
  request: NextApiRequest,
  response: NextApiResponse,
  admin: NonNullable<Awaited<ReturnType<typeof requireAdmin>>>,
) {
  const body = (request.body || {}) as OnboardingBody;
  const caseId = cleanText(body.caseId, 50);
  const directoryPlaceId = cleanText(body.directoryPlaceId, 50);
  const businessId = cleanText(body.businessId, 50);
  const prospectName = cleanText(body.prospectName, 180);
  const categoryKey = cleanText(body.categoryKey, 60);
  const city = cleanText(body.city, 120);
  const address = cleanText(body.address, 500);
  const websiteInput = cleanText(body.website, 1200);
  const socialUrlInput = cleanText(body.socialUrl, 1200);
  const ownerName = cleanText(body.ownerName, 180);
  const ownerEmail = cleanText(body.ownerEmail, 320).toLocaleLowerCase();
  const ownerPhone = cleanText(body.ownerPhone, 80);
  const preferredLanguage = cleanText(body.preferredLanguage, 2);
  const status = cleanText(body.status, 40);
  const assetsStatus = cleanText(body.assetsStatus, 40);
  const permissionSource = cleanText(body.permissionSource, 40);
  const permissionGrantedBy = cleanText(body.permissionGrantedBy, 180);
  const permissionNote = cleanText(body.permissionNote, 1000);
  const privateNotes = cleanText(body.privateNotes, 3000);
  const website = websiteInput ? safeHttpsUrl(websiteInput) : null;
  const socialUrl = socialUrlInput ? safeHttpsUrl(socialUrlInput) : null;
  const listingInterest = body.listingInterest === true;
  const bookingInterest = body.bookingInterest === true;
  const businessAppInterest = body.businessAppInterest === true;
  const profileMediaPermission = body.profileMediaPermission === true;
  const marketingMediaPermission = body.marketingMediaPermission === true;
  const hasMediaPermission = profileMediaPermission || marketingMediaPermission;

  if (caseId && !UUID_PATTERN.test(caseId)) {
    response.status(400).json({ error: "Choose a valid onboarding case." });
    return;
  }
  if (directoryPlaceId && !UUID_PATTERN.test(directoryPlaceId)) {
    response.status(400).json({ error: "Choose a valid directory place." });
    return;
  }
  if (businessId && !UUID_PATTERN.test(businessId)) {
    response.status(400).json({ error: "Choose a valid business profile." });
    return;
  }
  if (prospectName.length < 2) {
    response.status(400).json({ error: "Add the business or prospect name." });
    return;
  }
  if (websiteInput && !website) {
    response.status(400).json({ error: "Use a secure HTTPS website URL." });
    return;
  }
  if (socialUrlInput && !socialUrl) {
    response.status(400).json({ error: "Use a secure HTTPS social URL." });
    return;
  }
  if (ownerEmail && !EMAIL_PATTERN.test(ownerEmail)) {
    response.status(400).json({ error: "Enter a valid owner email." });
    return;
  }
  if (!STATUSES.includes(status as OnboardingStatus)) {
    response.status(400).json({ error: "Choose a valid onboarding status." });
    return;
  }
  if (!ASSET_STATUSES.includes(assetsStatus as AssetsStatus)) {
    response.status(400).json({ error: "Choose a valid asset status." });
    return;
  }
  if (!listingInterest && !bookingInterest && !businessAppInterest) {
    response
      .status(400)
      .json({ error: "Choose at least one onboarding goal." });
    return;
  }
  if (
    hasMediaPermission &&
    (body.permissionConfirmed !== true ||
      !PERMISSION_SOURCES.includes(permissionSource as PermissionSource) ||
      !permissionGrantedBy)
  ) {
    response.status(400).json({
      error: "Confirm who granted media permission and how it was received.",
    });
    return;
  }

  const permissionGrantedAtInput = cleanText(body.permissionGrantedAt, 40);
  const parsedPermissionDate = permissionGrantedAtInput
    ? new Date(permissionGrantedAtInput)
    : new Date();
  if (hasMediaPermission && Number.isNaN(parsedPermissionDate.getTime())) {
    response.status(400).json({ error: "Choose a valid permission date." });
    return;
  }
  const permissionGrantedAt = hasMediaPermission
    ? parsedPermissionDate.toISOString()
    : null;

  const { data, error } = await admin.supabase.rpc(
    "mirebook_save_business_onboarding_case",
    {
      p_actor_user_id: admin.user.id,
      p_case_id: caseId || null,
      p_directory_place_id: directoryPlaceId || null,
      p_business_id: businessId || null,
      p_prospect_name: prospectName,
      p_category_key: categoryKey || null,
      p_city: city || null,
      p_address: address || null,
      p_website: website,
      p_social_url: socialUrl,
      p_owner_name: ownerName || null,
      p_owner_email: ownerEmail || null,
      p_owner_phone: ownerPhone || null,
      p_preferred_language: preferredLanguage === "en" ? "en" : "sq",
      p_status: status,
      p_listing_interest: listingInterest,
      p_booking_interest: bookingInterest,
      p_business_app_interest: businessAppInterest,
      p_assets_status: assetsStatus,
      p_profile_media_permission: profileMediaPermission,
      p_marketing_media_permission: marketingMediaPermission,
      p_permission_source: hasMediaPermission ? permissionSource : null,
      p_permission_granted_by: hasMediaPermission ? permissionGrantedBy : null,
      p_permission_note: hasMediaPermission ? permissionNote || null : null,
      p_permission_granted_at: permissionGrantedAt,
      p_private_notes: privateNotes || null,
    },
  );

  if (error) {
    if (isMissingOnboardingSchema(error)) {
      response.status(503).json({
        error: "Assisted onboarding storage is not ready.",
        sqlRequired: "38_assisted_business_onboarding.sql",
      });
      return;
    }
    if (["22023", "23505", "42501", "P0002"].includes(error.code || "")) {
      response.status(error.code === "P0002" ? 404 : 400).json({
        error: error.message || "The onboarding case could not be saved.",
      });
      return;
    }
    throw error;
  }

  response.status(200).json({ ok: true, case: data?.[0] || null });
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  if (!request.method || !["GET", "POST"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  response.setHeader("Cache-Control", "private, no-store");

  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      response.status(403).json({ error: "Admin access required." });
      return;
    }

    if (request.method === "GET") {
      await handleGet(request, response, admin);
      return;
    }

    await handlePost(request, response, admin);
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String(error.code)
        : "unknown";
    console.error("[admin-onboarding] Request failed", code);
    response.status(500).json({
      error: "Assisted onboarding is temporarily unavailable.",
    });
  }
}
