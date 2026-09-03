import type { GetServerSideProps } from "next";
import { getPublicSiteOrigin } from "@/lib/appStoreUrls";
import { publicBookableBusinessIds } from "@/lib/server/publicBusinessReadiness";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

type DirectoryPlaceRow = {
  id: string;
  linked_business_id?: string | null;
};

type BusinessRow = {
  id: string;
};

const STATIC_PUBLIC_PATHS = ["/", "/explore", "/support", "/terms", "/privacy"];

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function sitemapXml(urls: string[]) {
  const entries = urls
    .map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`)
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    "</urlset>",
  ].join("\n");
}

export default function Sitemap() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");

  try {
    const supabase = createSupabaseAdminClient();
    const [directoryResult, businessResult] = await Promise.all([
      supabase
        .from("directory_places")
        .select("id, linked_business_id")
        .eq("listing_status", "active")
        .order("id", { ascending: true })
        .returns<DirectoryPlaceRow[]>(),
      supabase
        .from("businesses")
        .select("id")
        .eq("published", true)
        .order("id", { ascending: true })
        .returns<BusinessRow[]>(),
    ]);

    if (directoryResult.error) throw directoryResult.error;
    if (businessResult.error) throw businessResult.error;

    const publishedBusinessIds = (businessResult.data || []).map(
      (business) => business.id,
    );
    const bookableBusinessIds = await publicBookableBusinessIds(
      supabase,
      publishedBusinessIds,
    );
    const origin = getPublicSiteOrigin() || "https://mirebook.com";
    const staticUrls = STATIC_PUBLIC_PATHS.map((path) =>
      path === "/" ? origin : `${origin}${path}`,
    );
    const placeUrls = (directoryResult.data || [])
      .filter(
        (place) =>
          !place.linked_business_id ||
          !bookableBusinessIds.has(place.linked_business_id),
      )
      .map((place) => `${origin}/places/${encodeURIComponent(place.id)}`);
    const businessUrls = Array.from(bookableBusinessIds)
      .sort()
      .map(
        (businessId) => `${origin}/explore/${encodeURIComponent(businessId)}`,
      );

    res.statusCode = 200;
    res.end(sitemapXml([...staticUrls, ...placeUrls, ...businessUrls]));
  } catch {
    console.error("[sitemap] Public catalogue read failed");
    res.statusCode = 503;
    res.end(sitemapXml([]));
  }

  return { props: {} };
};
