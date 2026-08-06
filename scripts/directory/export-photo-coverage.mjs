import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

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
];

const APPOINTMENT_FRIENDLY = new Set([
  "beauty_grooming",
  "dental_health",
  "wellness_fitness",
  "events",
  "learning_lessons",
  "tours_activities",
  "rentals",
]);

function numberOption(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix));
  const parsed = Number(value?.slice(prefix.length));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function coverageFor(rows, keys, keyFor) {
  return keys.map((key) => {
    const matching = rows.filter((row) => keyFor(row) === key);
    const withPhoto = matching.filter((row) => row.image_url).length;
    return {
      key,
      total: matching.length,
      withPhoto,
      missingPhoto: matching.length - withPhoto,
    };
  });
}

function assetGuidance(category) {
  if (["attractions", "food_drink", "tours_activities"].includes(category)) {
    return "Owner-supplied place photo or clearly labelled licensed destination context";
  }
  return "Owner-supplied premises, team or service photo";
}

function balancedPriority(rows, cities, categories, limit) {
  const cityCoverage = Object.fromEntries(cities.map((item) => [item.key, item]));
  const categoryCoverage = Object.fromEntries(
    categories.map((item) => [item.key, item]),
  );

  const ranked = rows
    .filter((row) => !row.image_url)
    .map((row) => {
      const city = row.city || "Albania";
      const category = row.public_category_key || row.category_key;
      const cityItem = cityCoverage[city];
      const categoryItem = categoryCoverage[category];
      const cityGap = cityItem
        ? cityItem.missingPhoto / Math.max(1, cityItem.total)
        : 1;
      const categoryGap = categoryItem
        ? categoryItem.missingPhoto / Math.max(1, categoryItem.total)
        : 1;
      const contactAvailable = Boolean(
        row.public_phone || row.phone || row.public_website || row.website,
      );
      const score = Math.round(
        cityGap * 30 +
          categoryGap * 25 +
          (APPOINTMENT_FRIENDLY.has(category) ? 15 : 0) +
          (contactAvailable ? 10 : 0) +
          (row.editorial_description_en && row.editorial_description_sq
            ? 8
            : 0) +
          (row.source_confidence || 0) * 12,
      );
      const reasons = [];

      if (!cityItem || cityItem.withPhoto === 0 || cityGap >= 0.8) {
        reasons.push("city_coverage_gap");
      }
      if (
        !categoryItem ||
        categoryItem.withPhoto === 0 ||
        categoryGap >= 0.8
      ) {
        reasons.push("category_coverage_gap");
      }
      if (APPOINTMENT_FRIENDLY.has(category)) reasons.push("booking_relevant");
      if (contactAvailable) reasons.push("contact_route_available");
      if ((row.source_confidence || 0) >= 0.9) {
        reasons.push("high_source_confidence");
      }

      return {
        placeId: row.id,
        name: row.public_name || row.name,
        city,
        category,
        score,
        reasons: reasons.slice(0, 3),
        assetGuidance: assetGuidance(category),
        publicUrl: `https://mirebook.com/places/${row.id}`,
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score || left.name.localeCompare(right.name, "sq"),
    );

  const shortlist = [];
  const citySelections = new Map();
  const categorySelections = new Map();
  for (const place of ranked) {
    if (shortlist.length >= limit) break;
    if ((citySelections.get(place.city) || 0) >= 2) continue;
    if ((categorySelections.get(place.category) || 0) >= 4) continue;
    shortlist.push(place);
    citySelections.set(place.city, (citySelections.get(place.city) || 0) + 1);
    categorySelections.set(
      place.category,
      (categorySelections.get(place.category) || 0) + 1,
    );
  }

  for (const place of ranked) {
    if (shortlist.length >= limit) break;
    if (!shortlist.some((item) => item.placeId === place.placeId)) {
      shortlist.push(place);
    }
  }

  return shortlist;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from("directory_places")
    .select(
      "id, name, public_name, city, category_key, public_category_key, image_url, image_attribution_label, editorial_description_en, editorial_description_sq, public_facts_reviewed, phone, public_phone, website, public_website, source_confidence",
    )
    .eq("listing_status", "active")
    .order("city", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  const rows = data || [];
  const cityKeys = Array.from(
    new Set(rows.flatMap((row) => (row.city ? [row.city] : []))),
  ).sort((left, right) => left.localeCompare(right, "sq"));
  const cities = coverageFor(rows, cityKeys, (row) => row.city || "");
  const categories = coverageFor(
    rows,
    CATEGORY_KEYS,
    (row) => row.public_category_key || row.category_key,
  );
  const withPhoto = rows.filter((row) => row.image_url).length;
  const shortlist = balancedPriority(
    rows,
    cities,
    categories,
    numberOption("limit", 18),
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mode: "read_only",
        coverage: {
          total: rows.length,
          withPhoto,
          missingPhoto: rows.length - withPhoto,
          percent: rows.length ? Math.round((withPhoto / rows.length) * 100) : 0,
          cities,
          categories,
        },
        shortlist,
        safety: {
          databaseWrites: 0,
          privateNotesIncluded: false,
          exactCoordinatesIncluded: false,
          sourceIdsIncluded: false,
        },
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
