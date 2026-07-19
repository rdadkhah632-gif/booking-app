import type { NextApiRequest, NextApiResponse } from "next";
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

  const placeId = queryText(request.query.id);
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

    response.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600",
    );
    response.status(200).json({
      place: {
        id: data.id,
        resultType: "directory_place",
        name: data.name,
        categoryKey: data.category_key,
        description: data.description || null,
        address: data.address || null,
        city: data.city || null,
        region: data.region || null,
        countryCode: data.country_code,
        postcode: data.postcode || null,
        phone: data.phone || null,
        website: safeWebsite(data.website),
        bookable: false,
        claimable: data.claim_status === "unclaimed",
        linkedBusinessId: data.linked_business_id || null,
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
