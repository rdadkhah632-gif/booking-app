import type { NextApiRequest, NextApiResponse } from "next";
import { publicBookableBusinessIds } from "@/lib/server/publicBusinessReadiness";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DirectoryPlaceRow = {
  id: string;
  name: string;
  category_key: string;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country_code: string;
  postcode?: string | null;
  phone?: string | null;
  website?: string | null;
  claim_status: string;
  linked_business_id?: string | null;
  source: string;
};

type DirectoryEditorialRow = {
  editorial_description_en?: string | null;
  editorial_description_sq?: string | null;
  image_url?: string | null;
  image_alt_en?: string | null;
  image_alt_sq?: string | null;
  image_attribution_label?: string | null;
  image_attribution_url?: string | null;
};

type DirectoryPublicFactsRow = {
  public_facts_reviewed?: boolean | null;
  public_name?: string | null;
  public_category_key?: string | null;
  public_address?: string | null;
  public_postcode?: string | null;
  public_phone?: string | null;
  public_website?: string | null;
};

function queryText(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value || "").trim();
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

function safeHttpsUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function missingEditorialSchema(code?: string) {
  return ["42703", "PGRST202", "PGRST205"].includes(code || "");
}

function publicImage(
  row: DirectoryEditorialRow | null,
  locale: "en" | "sq",
) {
  if (!row) return null;
  const url = safeHttpsUrl(row.image_url);
  const attributionLabel = row.image_attribution_label?.trim();
  const alt =
    locale === "sq"
      ? row.image_alt_sq?.trim() || row.image_alt_en?.trim()
      : row.image_alt_en?.trim() || row.image_alt_sq?.trim();
  if (!url || !alt || !attributionLabel) return null;

  return {
    url,
    alt,
    attribution: {
      label: attributionLabel,
      url: safeHttpsUrl(row.image_attribution_url),
    },
  };
}

function attributionFor(source: string) {
  if (source === "overture") {
    return {
      label: "Overture Maps Foundation and listed data providers",
      url: "https://docs.overturemaps.org/attribution/",
    };
  }

  return { label: "Directory data source", url: null };
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }
  response.setHeader("Cache-Control", "private, no-store");

  const placeId = queryText(request.query.id);
  const locale: "en" | "sq" =
    queryText(request.query.locale).toLowerCase() === "sq" ? "sq" : "en";
  if (!UUID_PATTERN.test(placeId)) {
    response.status(400).json({ error: "A valid place is required." });
    return;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("directory_places")
      .select(
        "id, name, category_key, description, address, city, region, country_code, postcode, phone, website, claim_status, linked_business_id, source",
      )
      .eq("id", placeId)
      .eq("listing_status", "active")
      .maybeSingle<DirectoryPlaceRow>();

    if (error) {
      if (["42P01", "42703", "PGRST205"].includes(error.code || "")) {
        response.status(503).json({ error: "Directory discovery is not ready." });
        return;
      }
      throw error;
    }

    if (!data) {
      response.status(404).json({ error: "Place not found." });
      return;
    }

    let editorial: DirectoryEditorialRow | null = null;
    const { data: editorialData, error: editorialError } = await supabase
      .from("directory_places")
      .select(
        "editorial_description_en, editorial_description_sq, image_url, image_alt_en, image_alt_sq, image_attribution_label, image_attribution_url",
      )
      .eq("id", placeId)
      .eq("listing_status", "active")
      .maybeSingle<DirectoryEditorialRow>();

    if (editorialError) {
      if (!missingEditorialSchema(editorialError.code)) {
        throw editorialError;
      }
    } else {
      editorial = editorialData;
    }

    let reviewedFacts: DirectoryPublicFactsRow | null = null;
    const { data: factsData, error: factsError } = await supabase
      .from("directory_places")
      .select(
        "public_facts_reviewed, public_name, public_category_key, public_address, public_postcode, public_phone, public_website",
      )
      .eq("id", placeId)
      .eq("listing_status", "active")
      .maybeSingle<DirectoryPublicFactsRow>();

    if (factsError) {
      if (!missingEditorialSchema(factsError.code)) {
        throw factsError;
      }
    } else {
      reviewedFacts = factsData;
    }

    const useReviewedFacts = reviewedFacts?.public_facts_reviewed === true;
    const publicName =
      (useReviewedFacts ? reviewedFacts?.public_name : data.name) || data.name;
    const publicCategoryKey =
      (useReviewedFacts
        ? reviewedFacts?.public_category_key
        : data.category_key) || data.category_key;
    const publicAddress = useReviewedFacts
      ? reviewedFacts?.public_address || null
      : data.address || null;
    const publicPostcode = useReviewedFacts
      ? reviewedFacts?.public_postcode || null
      : data.postcode || null;
    const publicPhone = useReviewedFacts
      ? reviewedFacts?.public_phone || null
      : data.phone || null;
    const publicWebsite = useReviewedFacts
      ? reviewedFacts?.public_website || null
      : data.website || null;

    let bookingBusinessId: string | null = null;
    if (data.linked_business_id) {
      try {
        const bookableBusinessIds = await publicBookableBusinessIds(supabase, [
          data.linked_business_id,
        ]);
        if (bookableBusinessIds.has(data.linked_business_id)) {
          bookingBusinessId = data.linked_business_id;
        }
      } catch (readinessError) {
        const readinessCode =
          typeof readinessError === "object" &&
          readinessError &&
          "code" in readinessError
            ? String(readinessError.code)
            : "unknown";
        console.warn(
          "[public-directory-place] Linked business readiness unavailable",
          readinessCode,
        );
      }
    }

    response.status(200).json({
      place: {
        id: data.id,
        resultType: "directory_place",
        name: publicName,
        categoryKey: publicCategoryKey,
        description:
          (locale === "sq"
            ? editorial?.editorial_description_sq ||
              editorial?.editorial_description_en
            : editorial?.editorial_description_en ||
              editorial?.editorial_description_sq) ||
          data.description ||
          null,
        address: publicAddress,
        city: data.city || null,
        region: data.region || null,
        countryCode: data.country_code,
        postcode: publicPostcode,
        phone: publicPhone,
        website: safeWebsite(publicWebsite),
        bookable: Boolean(bookingBusinessId),
        bookingBusinessId,
        claimable: data.claim_status === "unclaimed",
        linkedBusinessId: data.linked_business_id || null,
        image: publicImage(editorial, locale),
        attribution: attributionFor(data.source),
      },
    });
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String(error.code)
        : "unknown";
    console.error("[public-directory-place] Request failed", code);
    response.status(500).json({ error: "Place details are temporarily unavailable." });
  }
}
