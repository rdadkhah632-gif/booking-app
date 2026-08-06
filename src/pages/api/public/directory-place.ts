import type { NextApiRequest, NextApiResponse } from "next";
import {
  getPublicDirectoryPlace,
  isPublicDirectoryPlaceId,
  PublicDirectoryUnavailableError,
} from "@/lib/server/publicDirectoryPlace";

function queryText(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value || "").trim();
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
  if (!isPublicDirectoryPlaceId(placeId)) {
    response.status(400).json({ error: "A valid place is required." });
    return;
  }

  try {
    const place = await getPublicDirectoryPlace(placeId, locale);
    if (!place) {
      response.status(404).json({ error: "Place not found." });
      return;
    }
    response.status(200).json({ place });
  } catch (error) {
    if (error instanceof PublicDirectoryUnavailableError) {
      response.status(503).json({ error: "Directory discovery is not ready." });
      return;
    }
    const code =
      typeof error === "object" && error && "code" in error
        ? String(error.code)
        : "unknown";
    console.error("[public-directory-place] Request failed", code);
    response
      .status(500)
      .json({ error: "Place details are temporarily unavailable." });
  }
}
