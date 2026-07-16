export type LocationPrecision =
  "exact" | "street" | "postcode" | "city" | "approximate";

export type GeocodingCandidate = {
  providerPlaceId: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  precision: LocationPrecision;
};

type MapboxFeature = {
  id?: string;
  geometry?: {
    coordinates?: unknown;
  };
  properties?: {
    mapbox_id?: string;
    name?: string;
    name_preferred?: string;
    full_address?: string;
    place_formatted?: string;
    feature_type?: string;
    coordinates?: {
      latitude?: number;
      longitude?: number;
      accuracy?: string;
    };
  };
};

type MapboxResponse = {
  features?: MapboxFeature[];
  message?: string;
};

const COUNTRY_CODES: Record<string, string> = {
  albania: "al",
  shqiperi: "al",
  shqipëri: "al",
  kosovo: "xk",
  kosova: "xk",
  "united kingdom": "gb",
  uk: "gb",
  "great britain": "gb",
  england: "gb",
  scotland: "gb",
  wales: "gb",
  italy: "it",
  italia: "it",
  france: "fr",
  germany: "de",
  deutschland: "de",
  greece: "gr",
  "north macedonia": "mk",
  montenegro: "me",
};

export class GeocodingError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "GeocodingError";
    this.code = code;
  }
}

function cleanText(value?: string | null) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function countryCode(country: string) {
  const cleaned = cleanText(country).toLowerCase();
  if (/^[a-z]{2}$/.test(cleaned)) return cleaned;
  return COUNTRY_CODES[cleaned] || "";
}

function featureCoordinates(feature: MapboxFeature) {
  const longitude = feature.properties?.coordinates?.longitude;
  const latitude = feature.properties?.coordinates?.latitude;

  if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
    return { longitude: longitude as number, latitude: latitude as number };
  }

  const geometryCoordinates = feature.geometry?.coordinates;
  if (
    Array.isArray(geometryCoordinates) &&
    Number.isFinite(geometryCoordinates[0]) &&
    Number.isFinite(geometryCoordinates[1])
  ) {
    return {
      longitude: geometryCoordinates[0] as number,
      latitude: geometryCoordinates[1] as number,
    };
  }

  return null;
}

function featureAddress(feature: MapboxFeature) {
  const properties = feature.properties;
  const name = cleanText(properties?.name_preferred || properties?.name);
  const place = cleanText(properties?.place_formatted);

  return (
    cleanText(properties?.full_address) ||
    [name, place].filter(Boolean).join(", ") ||
    name
  );
}

function featurePrecision(feature: MapboxFeature): LocationPrecision {
  const featureType = cleanText(feature.properties?.feature_type).toLowerCase();
  const accuracy = cleanText(
    feature.properties?.coordinates?.accuracy,
  ).toLowerCase();

  if (featureType === "address") {
    if (["rooftop", "parcel", "point"].includes(accuracy)) return "exact";
    return "street";
  }

  if (["street", "neighborhood"].includes(featureType)) return "street";
  if (featureType === "postcode") return "postcode";
  if (["place", "locality", "district", "region"].includes(featureType)) {
    return "city";
  }

  return "approximate";
}

function parseFeature(feature: MapboxFeature): GeocodingCandidate | null {
  const providerPlaceId = cleanText(
    feature.properties?.mapbox_id || feature.id,
  );
  const formattedAddress = featureAddress(feature);
  const coordinates = featureCoordinates(feature);

  if (!providerPlaceId || !formattedAddress || !coordinates) return null;
  if (
    coordinates.latitude < -90 ||
    coordinates.latitude > 90 ||
    coordinates.longitude < -180 ||
    coordinates.longitude > 180
  ) {
    return null;
  }

  return {
    providerPlaceId,
    formattedAddress,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    precision: featurePrecision(feature),
  };
}

export async function geocodeBusinessAddress({
  address,
  city,
  country,
  permanent,
}: {
  address?: string | null;
  city?: string | null;
  country?: string | null;
  permanent: boolean;
}) {
  const cleanedAddress = cleanText(address);
  const cleanedCity = cleanText(city);
  const cleanedCountry = cleanText(country);

  if (!cleanedAddress || !cleanedCity || !cleanedCountry) {
    throw new GeocodingError(
      "address_incomplete",
      "A saved address, city and country are required.",
    );
  }

  const accessToken = process.env.MAPBOX_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    throw new GeocodingError(
      "geocoding_not_configured",
      "Business location verification is not configured.",
    );
  }

  const search = new URLSearchParams({
    q: [cleanedAddress, cleanedCity, cleanedCountry].join(", "),
    access_token: accessToken,
    autocomplete: "false",
    limit: "5",
    permanent: permanent ? "true" : "false",
  });
  const restrictedCountry = countryCode(cleanedCountry);
  if (restrictedCountry) search.set("country", restrictedCountry);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      `https://api.mapbox.com/search/geocode/v6/forward?${search.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new GeocodingError(
        "geocoding_unavailable",
        "The location provider could not verify this address.",
      );
    }

    const payload = (await response.json()) as MapboxResponse;
    const candidates = (payload.features || [])
      .map(parseFeature)
      .filter((candidate): candidate is GeocodingCandidate =>
        Boolean(candidate),
      )
      .slice(0, 3);

    if (candidates.length === 0) {
      throw new GeocodingError(
        "location_not_found",
        "No matching map location was found.",
      );
    }

    return candidates;
  } catch (error) {
    if (error instanceof GeocodingError) throw error;

    throw new GeocodingError(
      "geocoding_unavailable",
      "The location provider could not verify this address.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function renderBusinessLocationMap(candidate: GeocodingCandidate) {
  const accessToken = process.env.MAPBOX_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    throw new GeocodingError(
      "geocoding_not_configured",
      "Business location verification is not configured.",
    );
  }

  const longitude = Number(candidate.longitude.toFixed(6));
  const latitude = Number(candidate.latitude.toFixed(6));
  const marker = `pin-s+ff6b35(${longitude},${latitude})`;
  const search = new URLSearchParams({
    access_token: accessToken,
    attribution: "true",
    logo: "true",
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${marker}/${longitude},${latitude},15/640x240@2x?${search.toString()}`,
      { signal: controller.signal },
    );

    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.startsWith("image/")) {
      throw new GeocodingError(
        "map_preview_unavailable",
        "The map preview is temporarily unavailable.",
      );
    }

    const image = Buffer.from(await response.arrayBuffer()).toString("base64");
    return `data:${contentType};base64,${image}`;
  } catch (error) {
    if (error instanceof GeocodingError) throw error;

    throw new GeocodingError(
      "map_preview_unavailable",
      "The map preview is temporarily unavailable.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
