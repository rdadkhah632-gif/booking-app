#!/usr/bin/env node

import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline";

const DEFAULT_CITIES = [
  "Tiranë",
  "Durrës",
  "Vlorë",
  "Sarandë",
  "Shkodër",
  "Korçë",
  "Himarë",
  "Berat",
  "Gjirokastër",
];

const DEFAULT_CATEGORIES = [
  "beauty_grooming",
  "dental_health",
  "wellness_fitness",
  "events",
  "learning_lessons",
  "tours_activities",
  "rentals",
  "attractions",
];
const SUPPORTED_CATEGORIES = new Set([
  ...DEFAULT_CATEGORIES,
  "food_drink",
  "lodging",
]);

function usage() {
  return `
Usage:
  npm run directory:shortlist -- \\
    --input /tmp/mirebook-albania-directory.jsonl \\
    --output /tmp/mirebook-launch-shortlist.jsonl

Options:
  --input <path>                    Full exporter JSONL file (required)
  --output <path>                   Review-only shortlist JSONL file (required)
  --summary-output <path>           Optional JSON summary file
  --per-city-category <1-20>        Maximum records per city/category (default: 3)
  --cities <comma-separated>        Override the default launch cities
  --categories <comma-separated>    Override the default launch categories
  --help                            Show this message

This command is deterministic, does not connect to Supabase and never approves
or publishes a directory place. The resulting file must still pass the normal
directory importer validation and every row still imports as needs_review.
`;
}

function parseList(value, label) {
  const items = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!items.length) throw new Error(`${label} must contain at least one value.`);
  return [...new Set(items)];
}

function parseArgs(argv) {
  const options = {
    categories: DEFAULT_CATEGORIES,
    cities: DEFAULT_CITIES,
    input: "",
    output: "",
    perCityCategory: 3,
    summaryOutput: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") {
      console.log(usage());
      process.exit(0);
    } else if (argument === "--input") {
      options.input = argv[++index] ?? "";
    } else if (argument === "--output") {
      options.output = argv[++index] ?? "";
    } else if (argument === "--summary-output") {
      options.summaryOutput = argv[++index] ?? "";
    } else if (argument === "--per-city-category") {
      options.perCityCategory = Number(argv[++index]);
    } else if (argument === "--cities") {
      options.cities = parseList(argv[++index], "--cities");
    } else if (argument === "--categories") {
      options.categories = parseList(argv[++index], "--categories");
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!options.input) throw new Error("--input is required.");
  if (!options.output) throw new Error("--output is required.");
  if (resolve(options.input) === resolve(options.output)) {
    throw new Error("--output must not overwrite --input.");
  }
  if (
    !Number.isInteger(options.perCityCategory) ||
    options.perCityCategory < 1 ||
    options.perCityCategory > 20
  ) {
    throw new Error("--per-city-category must be an integer between 1 and 20.");
  }
  const unsupportedCategories = options.categories.filter(
    (category) => !SUPPORTED_CATEGORIES.has(category),
  );
  if (unsupportedCategories.length) {
    throw new Error(
      `Unsupported categories: ${unsupportedCategories.join(", ")}.`,
    );
  }
  return options;
}

function normalized(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function completeness(record) {
  return [
    record.address,
    record.phone,
    record.website,
    record.email,
    Array.isArray(record.social_urls) && record.social_urls.length > 0,
  ].filter(Boolean).length;
}

function stableCandidateKey(record) {
  const location = record.address
    ? normalized(record.address)
    : `${Number(record.latitude).toFixed(4)},${Number(record.longitude).toFixed(4)}`;
  return [
    normalized(record.name),
    normalized(record.city),
    normalized(record.category_key),
    location,
  ].join("|");
}

function compareCandidates(left, right) {
  const confidenceDifference =
    Number(right.source_confidence ?? -1) - Number(left.source_confidence ?? -1);
  if (confidenceDifference !== 0) return confidenceDifference;

  const completenessDifference = completeness(right) - completeness(left);
  if (completenessDifference !== 0) return completenessDifference;

  const updateDifference = String(right.source_updated_at || "").localeCompare(
    String(left.source_updated_at || ""),
  );
  if (updateDifference !== 0) return updateDifference;

  const nameDifference = String(left.name).localeCompare(String(right.name), "sq");
  if (nameDifference !== 0) return nameDifference;
  return String(left.source_place_id).localeCompare(String(right.source_place_id));
}

function validateRecord(record, lineNumber) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error(`Line ${lineNumber}: expected a JSON object.`);
  }

  for (const field of [
    "source",
    "source_version",
    "source_place_id",
    "name",
    "category_key",
    "country_code",
    "source_fingerprint",
  ]) {
    if (!String(record[field] || "").trim()) {
      throw new Error(`Line ${lineNumber}: ${field} is required.`);
    }
  }

  if (!Number.isFinite(Number(record.latitude)) || !Number.isFinite(Number(record.longitude))) {
    throw new Error(`Line ${lineNumber}: latitude and longitude are required.`);
  }
}

async function readRecords(inputPath) {
  const records = [];
  const sourceIds = new Set();
  let source = "";
  let sourceVersion = "";
  let lineNumber = 0;

  const lines = createInterface({
    crlfDelay: Number.POSITIVE_INFINITY,
    input: createReadStream(resolve(inputPath), { encoding: "utf8" }),
  });

  for await (const rawLine of lines) {
    lineNumber += 1;
    if (!rawLine.trim()) continue;

    let record;
    try {
      record = JSON.parse(rawLine);
    } catch {
      throw new Error(`Line ${lineNumber}: invalid JSON.`);
    }
    validateRecord(record, lineNumber);

    source ||= String(record.source);
    sourceVersion ||= String(record.source_version);
    if (record.source !== source || record.source_version !== sourceVersion) {
      throw new Error(`Line ${lineNumber}: every record must use one source and source version.`);
    }
    if (sourceIds.has(record.source_place_id)) {
      throw new Error(`Line ${lineNumber}: duplicate source_place_id.`);
    }

    sourceIds.add(record.source_place_id);
    records.push(record);
  }

  if (!records.length) throw new Error("The input contains no directory records.");
  return { records, source, sourceVersion };
}

function matrixFor(records, cities, categories) {
  return Object.fromEntries(
    cities.map((city) => [
      city,
      Object.fromEntries(
        categories.map((category) => [
          category,
          records.filter(
            (record) => record.city === city && record.category_key === category,
          ).length,
        ]),
      ),
    ]),
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const input = await readRecords(options.input);
  const cityOrder = new Map(options.cities.map((city, index) => [city, index]));
  const categoryOrder = new Map(
    options.categories.map((category, index) => [category, index]),
  );
  const eligible = input.records.filter(
    (record) => cityOrder.has(record.city) && categoryOrder.has(record.category_key),
  );
  const groups = new Map();

  for (const record of eligible) {
    const key = `${record.city}|${record.category_key}`;
    const group = groups.get(key) || [];
    group.push(record);
    groups.set(key, group);
  }

  const selected = [];
  let duplicateCandidatesSkipped = 0;
  for (const city of options.cities) {
    for (const category of options.categories) {
      const candidates = [...(groups.get(`${city}|${category}`) || [])].sort(
        compareCandidates,
      );
      const seenCandidates = new Set();
      let selectedForCell = 0;

      for (const candidate of candidates) {
        const candidateKey = stableCandidateKey(candidate);
        if (seenCandidates.has(candidateKey)) {
          duplicateCandidatesSkipped += 1;
          continue;
        }
        seenCandidates.add(candidateKey);
        selected.push(candidate);
        selectedForCell += 1;
        if (selectedForCell >= options.perCityCategory) break;
      }
    }
  }

  selected.sort((left, right) => {
    const cityDifference = cityOrder.get(left.city) - cityOrder.get(right.city);
    if (cityDifference !== 0) return cityDifference;
    const categoryDifference =
      categoryOrder.get(left.category_key) - categoryOrder.get(right.category_key);
    return categoryDifference || compareCandidates(left, right);
  });

  if (!selected.length) {
    throw new Error(
      "No records matched the selected launch cities and categories. No output was written.",
    );
  }

  const output = `${selected.map((record) => JSON.stringify(record)).join("\n")}${
    selected.length ? "\n" : ""
  }`;
  await writeFile(resolve(options.output), output, "utf8");

  const available = matrixFor(eligible, options.cities, options.categories);
  const shortlisted = matrixFor(selected, options.cities, options.categories);
  const coverageGaps = [];
  for (const city of options.cities) {
    for (const category of options.categories) {
      if (shortlisted[city][category] === 0) coverageGaps.push({ city, category });
    }
  }

  const summary = {
    mode: "review-only-shortlist",
    input: resolve(options.input),
    output: resolve(options.output),
    source: input.source,
    sourceVersion: input.sourceVersion,
    inputRecords: input.records.length,
    eligibleRecords: eligible.length,
    shortlistedRecords: selected.length,
    duplicateCandidatesSkipped,
    perCityCategory: options.perCityCategory,
    cities: options.cities,
    categories: options.categories,
    available,
    shortlisted,
    coverageGaps,
    resultingListingStatus: "needs_review",
    publicListingsCreated: 0,
  };

  if (options.summaryOutput) {
    await writeFile(
      resolve(options.summaryOutput),
      `${JSON.stringify(summary, null, 2)}\n`,
      "utf8",
    );
  }
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
