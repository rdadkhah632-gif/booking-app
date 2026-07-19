#!/usr/bin/env node

import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { createInterface } from "node:readline";

const ALLOWED_CATEGORIES = new Set([
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
]);
const ALBANIA_BOUNDS = {
  minLatitude: 39.55,
  maxLatitude: 42.75,
  minLongitude: 19,
  maxLongitude: 21.2,
};

function usage() {
  return `
Usage:
  npm run directory:import -- --input /tmp/places.jsonl
  npm run directory:import -- --input /tmp/places.jsonl --apply --confirm-review-only-import

Options:
  --input <path>                    JSONL export to validate/import (required)
  --env-file <path>                 Env file for apply mode (default: .env.local)
  --batch-size <1-500>              RPC batch size (default: 250)
  --limit <number>                  Validate/import only the first N records
  --apply                           Write through the service-only Supabase RPC
  --confirm-review-only-import      Confirm imports stay private and needs_review
  --help                            Show this message

Dry-run validation is the default and does not need Supabase credentials.
`;
}

function parseArgs(argv) {
  const options = {
    apply: false,
    batchSize: 250,
    confirmReviewOnlyImport: false,
    envFile: ".env.local",
    input: "",
    limit: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") {
      console.log(usage());
      process.exit(0);
    } else if (argument === "--apply") {
      options.apply = true;
    } else if (argument === "--confirm-review-only-import") {
      options.confirmReviewOnlyImport = true;
    } else if (argument === "--input") {
      options.input = argv[++index] ?? "";
    } else if (argument === "--env-file") {
      options.envFile = argv[++index] ?? "";
    } else if (argument === "--batch-size") {
      options.batchSize = Number(argv[++index]);
    } else if (argument === "--limit") {
      options.limit = Number(argv[++index]);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!options.input) throw new Error("--input is required.");
  if (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 500) {
    throw new Error("--batch-size must be an integer between 1 and 500.");
  }
  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error("--limit must be a positive integer.");
  }
  if (options.apply && !options.confirmReviewOnlyImport) {
    throw new Error(
      "Apply mode requires --confirm-review-only-import. Imported places are not published."
    );
  }
  return options;
}

function unquoteEnvValue(value) {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

async function loadEnvFile(filePath) {
  let contents;
  try {
    contents = await readFile(resolve(filePath), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (process.env[key] === undefined) process.env[key] = unquoteEnvValue(value);
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanOptionalString(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).trim();
  return cleaned || null;
}

function validateRecord(raw, lineNumber) {
  const errors = [];
  const source = cleanOptionalString(raw.source);
  const sourceVersion = cleanOptionalString(raw.source_version);
  const sourcePlaceId = cleanOptionalString(raw.source_place_id);
  const name = cleanOptionalString(raw.name);
  const categoryKey = cleanOptionalString(raw.category_key);
  const countryCode = cleanOptionalString(raw.country_code)?.toUpperCase();
  const latitude = Number(raw.latitude);
  const longitude = Number(raw.longitude);
  const confidence = raw.source_confidence === null ? null : Number(raw.source_confidence);

  if (source !== "overture") errors.push("source must be overture");
  if (!sourceVersion) errors.push("source_version is required");
  if (!sourcePlaceId) errors.push("source_place_id is required");
  if (!name) errors.push("name is required");
  if (!ALLOWED_CATEGORIES.has(categoryKey)) errors.push("category_key is not allowed");
  if (countryCode !== "AL") errors.push("country_code must be AL");
  if (!Number.isFinite(latitude) || latitude < ALBANIA_BOUNDS.minLatitude || latitude > ALBANIA_BOUNDS.maxLatitude) {
    errors.push("latitude is outside Albania bounds");
  }
  if (!Number.isFinite(longitude) || longitude < ALBANIA_BOUNDS.minLongitude || longitude > ALBANIA_BOUNDS.maxLongitude) {
    errors.push("longitude is outside Albania bounds");
  }
  if (confidence !== null && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)) {
    errors.push("source_confidence must be null or between 0 and 1");
  }
  if (!Array.isArray(raw.source_category_ids)) errors.push("source_category_ids must be an array");
  if (!Array.isArray(raw.social_urls)) errors.push("social_urls must be an array");
  if (!isPlainObject(raw.source_attribution)) errors.push("source_attribution must be an object");
  if (!/^[a-f0-9]{64}$/i.test(String(raw.source_fingerprint ?? ""))) {
    errors.push("source_fingerprint must be a SHA-256 hex digest");
  }

  if (errors.length) {
    throw new Error(`Line ${lineNumber}: ${errors.join("; ")}.`);
  }

  return {
    source,
    sourceVersion,
    place: {
      source_place_id: sourcePlaceId,
      name,
      category_key: categoryKey,
      source_category: cleanOptionalString(raw.source_category),
      source_category_ids: [...new Set(raw.source_category_ids.map(String).filter(Boolean))],
      description: cleanOptionalString(raw.description),
      address: cleanOptionalString(raw.address),
      city: cleanOptionalString(raw.city),
      region: cleanOptionalString(raw.region),
      country_code: countryCode,
      postcode: cleanOptionalString(raw.postcode),
      latitude,
      longitude,
      phone: cleanOptionalString(raw.phone),
      website: cleanOptionalString(raw.website),
      email: cleanOptionalString(raw.email),
      social_urls: [...new Set(raw.social_urls.map(String).filter(Boolean))],
      source_confidence: confidence,
      source_operating_status: cleanOptionalString(raw.source_operating_status),
      source_updated_at: cleanOptionalString(raw.source_updated_at),
      source_attribution: raw.source_attribution,
      source_fingerprint: String(raw.source_fingerprint).toLowerCase(),
    },
  };
}

async function readRecords(inputPath, limit) {
  const records = [];
  const seenIds = new Set();
  let source = null;
  let sourceVersion = null;
  let lineNumber = 0;

  const lines = createInterface({
    crlfDelay: Number.POSITIVE_INFINITY,
    input: createReadStream(resolve(inputPath), { encoding: "utf8" }),
  });
  for await (const rawLine of lines) {
    lineNumber += 1;
    if (!rawLine.trim()) continue;
    let parsed;
    try {
      parsed = JSON.parse(rawLine);
    } catch {
      throw new Error(`Line ${lineNumber}: invalid JSON.`);
    }
    const validated = validateRecord(parsed, lineNumber);
    source ??= validated.source;
    sourceVersion ??= validated.sourceVersion;
    if (source !== validated.source || sourceVersion !== validated.sourceVersion) {
      throw new Error(`Line ${lineNumber}: every record must use one source and source version.`);
    }
    if (seenIds.has(validated.place.source_place_id)) {
      throw new Error(`Line ${lineNumber}: duplicate source_place_id.`);
    }
    seenIds.add(validated.place.source_place_id);
    records.push(validated.place);
    if (limit && records.length >= limit) break;
  }

  if (!records.length) throw new Error("The input contains no directory records.");
  return { records, source, sourceVersion };
}

function countBy(records, key, fallback) {
  const counts = new Map();
  for (const record of records) {
    const value = record[key] || fallback;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((left, right) => right[1] - left[1]));
}

function summaryFor(records, source, sourceVersion, inputPath) {
  return {
    mode: "dry-run",
    input: resolve(inputPath),
    source,
    sourceVersion,
    validated: records.length,
    categories: countBy(records, "category_key", "unknown"),
    topCities: Object.fromEntries(
      Object.entries(countBy(records, "city", "Unknown")).slice(0, 15)
    ),
    resultingListingStatus: "needs_review",
    publicListingsCreated: 0,
  };
}

function serviceHeaders(serviceRoleKey) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!response.ok) {
    const detail = typeof body === "string" ? body : body?.message || body?.error || response.statusText;
    throw new Error(`Supabase request failed (${response.status}): ${detail}`);
  }
  return body;
}

async function updateRun(restUrl, headers, runId, values) {
  await requestJson(`${restUrl}/directory_import_runs?id=eq.${encodeURIComponent(runId)}`, {
    body: JSON.stringify(values),
    headers,
    method: "PATCH",
  });
}

async function applyImport(options, input) {
  await loadEnvFile(options.envFile);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Apply mode needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Values were not printed."
    );
  }

  const restUrl = `${supabaseUrl}/rest/v1`;
  const headers = serviceHeaders(serviceRoleKey);
  const runRows = await requestJson(`${restUrl}/directory_import_runs`, {
    body: JSON.stringify({
      source: input.source,
      source_version: input.sourceVersion,
      status: "running",
      dry_run: false,
      input_count: input.records.length,
      metadata: {
        input_file: basename(resolve(options.input)),
        categories: countBy(input.records, "category_key", "unknown"),
        operator_confirmation: "review_only_import",
      },
    }),
    headers: { ...headers, Prefer: "return=representation" },
    method: "POST",
  });
  const runId = runRows?.[0]?.id;
  if (!runId) throw new Error("Supabase did not return an import run ID.");

  let processedCount = 0;
  let insertedCount = 0;
  let updatedCount = 0;
  try {
    for (let offset = 0; offset < input.records.length; offset += options.batchSize) {
      const places = input.records.slice(offset, offset + options.batchSize);
      const result = await requestJson(
        `${restUrl}/rpc/mirebook_import_albania_directory_places`,
        {
          body: JSON.stringify({
            p_places: places,
            p_source: input.source,
            p_source_version: input.sourceVersion,
          }),
          headers,
          method: "POST",
        }
      );
      const counts = result?.[0];
      if (!counts) throw new Error("Import RPC returned no batch counts.");
      processedCount += Number(counts.processed_count ?? 0);
      insertedCount += Number(counts.inserted_count ?? 0);
      updatedCount += Number(counts.updated_count ?? 0);
    }

    await updateRun(restUrl, headers, runId, {
      status: "completed",
      processed_count: processedCount,
      inserted_count: insertedCount,
      updated_count: updatedCount,
      completed_at: new Date().toISOString(),
    });
  } catch (error) {
    await updateRun(restUrl, headers, runId, {
      status: "failed",
      processed_count: processedCount,
      inserted_count: insertedCount,
      updated_count: updatedCount,
      error_summary: String(error?.message ?? error).slice(0, 1_000),
      completed_at: new Date().toISOString(),
    }).catch(() => {});
    throw error;
  }

  return {
    mode: "apply",
    runId,
    source: input.source,
    sourceVersion: input.sourceVersion,
    processed: processedCount,
    inserted: insertedCount,
    updated: updatedCount,
    resultingListingStatus: "needs_review",
    publicListingsCreated: 0,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const input = await readRecords(options.input, options.limit);
  const dryRunSummary = summaryFor(
    input.records,
    input.source,
    input.sourceVersion,
    options.input
  );

  if (!options.apply) {
    console.log(JSON.stringify(dryRunSummary, null, 2));
    console.log("Dry run only. No database writes were attempted.");
    return;
  }

  console.log(JSON.stringify({ ...dryRunSummary, mode: "validated-for-apply" }, null, 2));
  const result = await applyImport(options, input);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(`Directory import stopped: ${error.message}`);
  process.exitCode = 1;
});
