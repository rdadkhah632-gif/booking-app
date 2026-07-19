#!/usr/bin/env python3
"""Export conservative Albania directory candidates from Overture Places.

This command only reads Overture's public GeoParquet release and writes a
review-queue JSONL file. It never connects to Supabase or publishes listings.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

try:
    import duckdb
except ImportError:
    print(
        "DuckDB is required. Install it with "
        "`python3 -m pip install --user duckdb` and rerun this command.",
        file=sys.stderr,
    )
    raise SystemExit(2)


DEFAULT_RELEASE = "2026-06-17.0"
ALBANIA_BOUNDS = (19.0, 39.55, 21.2, 42.75)
BLOCKED_NAME_PATTERN = re.compile(
    r"(?:^|\W)(?:qa|test|testing|sample|demo|dummy|placeholder)(?:\W|$)",
    re.IGNORECASE,
)

CATEGORY_MATCHES: tuple[tuple[str, frozenset[str]], ...] = (
    (
        "beauty_grooming",
        frozenset(
            {
                "barber",
                "barber_shop",
                "beauty_and_spa",
                "beauty_salon",
                "beauty_service",
                "eyebrow_service",
                "hair_replacement",
                "hair_removal_service",
                "hair_salon",
                "health_spa",
                "makeup_artist",
                "massage_therapist",
                "nail_salon",
                "personal_or_beauty_service",
                "skin_care_clinic",
                "spa",
                "spas",
                "tanning_salon",
                "tattoo_parlor",
                "tattoo_and_piercing",
                "waxing_salon",
            }
        ),
    ),
    (
        "dental_health",
        frozenset(
            {
                "dental_clinic",
                "dental_hygienist",
                "dentist",
                "orthodontist",
                "pediatric_dentist",
            }
        ),
    ),
    (
        "wellness_fitness",
        frozenset(
            {
                "fitness_center",
                "gym",
                "health_club",
                "meditation_center",
                "personal_trainer",
                "physical_medicine_and_rehabilitation",
                "physical_therapy",
                "physical_therapist",
                "pilates_studio",
                "sport_or_fitness_facility",
                "sport_or_recreation_club",
                "wellness_center",
                "wellness_service",
                "yoga_studio",
            }
        ),
    ),
    (
        "events",
        frozenset(
            {
                "event_or_party_service",
                "event_planning",
                "event_planner",
                "event_venue",
                "party_equipment_rental_service",
                "wedding_planner",
                "wedding_planning",
                "wedding_service",
                "wedding_venue",
                "venue_and_event_space",
            }
        ),
    ),
    (
        "learning_lessons",
        frozenset(
            {
                "art_school",
                "cooking_school",
                "dance_school",
                "driving_school",
                "language_school",
                "music_school",
                "sports_school",
                "tutoring_service",
            }
        ),
    ),
    (
        "tours_activities",
        frozenset(
            {
                "adventure_sports_center",
                "boat_tour_agency",
                "horseback_riding_service",
                "outdoor_activity_organizer",
                "scuba_tour_agency",
                "sightseeing_tour_agency",
                "tour_agency",
                "tour_guide",
                "tour_operator",
                "tours",
                "tourist_information_center",
                "travel_agency",
                "travel_services",
            }
        ),
    ),
    (
        "rentals",
        frozenset(
            {
                "bicycle_rental_service",
                "boat_rental_service",
                "car_rental_agency",
                "equipment_rental_agency",
                "jet_ski_rental_service",
                "motorcycle_rental_agency",
                "rental_service",
                "scooter_rental_service",
                "sports_equipment_rental_service",
                "truck_rentals",
            }
        ),
    ),
    (
        "attractions",
        frozenset(
            {
                "amusement_park",
                "archaeological_site",
                "art_gallery",
                "beach",
                "botanical_garden",
                "castle",
                "cultural_center",
                "historic_site",
                "historical_landmark",
                "landmark_and_historical_building",
                "lake",
                "marina",
                "mountain",
                "mountain_peak",
                "museum",
                "national_park",
                "nature_reserve",
                "park",
                "tourist_attraction",
                "water_park",
                "zoo",
            }
        ),
    ),
)

FOOD_CATEGORIES = frozenset(
    {
        "bakery",
        "bar",
        "cafe",
        "coffee_shop",
        "food_and_drink",
        "ice_cream_shop",
        "restaurant",
    }
)
LODGING_CATEGORIES = frozenset(
    {
        "bed_and_breakfast",
        "campground",
        "guest_house",
        "hostel",
        "hotel",
        "lodging",
        "motel",
        "vacation_rental",
    }
)

LOCALITY_ALIASES = {
    "berat": "Berat",
    "durres": "Durrës",
    "durresit": "Durrës",
    "elbasan": "Elbasan",
    "fier": "Fier",
    "gjirokaster": "Gjirokastër",
    "himare": "Himarë",
    "korce": "Korçë",
    "kruje": "Krujë",
    "lezhe": "Lezhë",
    "sarande": "Sarandë",
    "shkoder": "Shkodër",
    "tirana": "Tiranë",
    "tirane": "Tiranë",
    "vlore": "Vlorë",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Export high-confidence Albania places from Overture into a "
            "private review-queue JSONL file."
        )
    )
    parser.add_argument("--release", default=DEFAULT_RELEASE)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--min-confidence", type=float, default=0.75)
    parser.add_argument(
        "--include-food-lodging",
        action="store_true",
        help="Include restaurants/cafes and accommodation in addition to the launch set.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Limit source rows for pipeline testing. Do not use for a final export.",
    )
    return parser.parse_args()


def ascii_key(value: str | None) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(char for char in normalized if not unicodedata.combining(char)).lower()


def canonical_city(value: str | None) -> str | None:
    if not value or not value.strip():
        return None
    cleaned = value.strip()
    return LOCALITY_ALIASES.get(ascii_key(cleaned), cleaned)


def clean_strings(value: Any) -> list[str]:
    if not isinstance(value, (list, tuple)):
        return []
    return list(dict.fromkeys(str(item).strip() for item in value if str(item).strip()))


def category_for(
    primary: str | None,
    basic: str | None,
    alternates: Iterable[str] | None,
    include_food_lodging: bool,
) -> tuple[str, list[str]] | None:
    values = list(
        dict.fromkeys(
            value
            for value in [primary, basic, *(alternates or [])]
            if isinstance(value, str) and value
        )
    )
    # Alternates are retained for provenance but are too noisy to drive the
    # product category. Prefer a specific primary match, then the basic-level
    # category. This avoids examples such as pharmacies carrying an alternate
    # beauty tag or construction firms carrying an alternate rental tag.
    for category_key, matches in CATEGORY_MATCHES:
        if primary in matches:
            return category_key, values

    for category_key, matches in CATEGORY_MATCHES:
        if basic in matches:
            return category_key, values

    if include_food_lodging and (primary in FOOD_CATEGORIES or basic in FOOD_CATEGORIES):
        return "food_drink", values
    if include_food_lodging and (primary in LODGING_CATEGORIES or basic in LODGING_CATEGORIES):
        return "lodging", values
    return None


def source_attribution(raw_sources: Any, release: str) -> tuple[dict[str, Any], str | None]:
    if isinstance(raw_sources, str):
        try:
            raw_sources = json.loads(raw_sources)
        except json.JSONDecodeError:
            raw_sources = []

    cleaned_sources: list[dict[str, Any]] = []
    latest_update: str | None = None
    for source in raw_sources or []:
        if not isinstance(source, dict):
            continue
        cleaned = {
            key: source.get(key)
            for key in ("dataset", "property", "update_time", "confidence")
            if source.get(key) is not None
        }
        if cleaned:
            cleaned_sources.append(cleaned)
        update_time = source.get("update_time")
        if isinstance(update_time, str) and (latest_update is None or update_time > latest_update):
            latest_update = update_time

    return (
        {
            "provider": "Overture Maps Foundation",
            "release": release,
            "sources": cleaned_sources,
        },
        latest_update,
    )


def stable_fingerprint(record: dict[str, Any]) -> str:
    fingerprint_fields = {
        key: record.get(key)
        for key in (
            "source_place_id",
            "name",
            "category_key",
            "source_category_ids",
            "address",
            "city",
            "region",
            "postcode",
            "latitude",
            "longitude",
            "phone",
            "website",
            "email",
            "social_urls",
            "source_confidence",
            "source_operating_status",
        )
    }
    payload = json.dumps(
        fingerprint_fields,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def output_path(args: argparse.Namespace) -> Path:
    if args.output:
        return args.output.expanduser().resolve()
    safe_release = re.sub(r"[^A-Za-z0-9._-]", "-", args.release)
    return Path(f"/tmp/mirebook-albania-directory-{safe_release}.jsonl")


def main() -> int:
    args = parse_args()
    if not 0 <= args.min_confidence <= 1:
        raise SystemExit("--min-confidence must be between 0 and 1.")
    if args.limit is not None and args.limit < 1:
        raise SystemExit("--limit must be greater than zero.")

    output = output_path(args)
    output.parent.mkdir(parents=True, exist_ok=True)

    source_uri = (
        "s3://overturemaps-us-west-2/release/"
        f"{args.release}/theme=places/type=place/*.parquet"
    )
    limit_clause = " limit ?" if args.limit else ""
    query = f"""
      select
        id,
        version,
        names.primary as name,
        categories.primary as primary_category,
        categories.alternate as alternate_categories,
        basic_category,
        confidence,
        websites,
        socials,
        emails,
        phones,
        addresses[1].freeform as address,
        addresses[1].locality as locality,
        addresses[1].postcode as postcode,
        addresses[1].region as region,
        operating_status,
        bbox.xmin as longitude,
        bbox.ymin as latitude,
        to_json(sources) as sources_json
      from read_parquet(?)
      where list_contains(list_transform(addresses, item -> item.country), 'AL')
        and bbox.xmin between {ALBANIA_BOUNDS[0]} and {ALBANIA_BOUNDS[2]}
        and bbox.ymin between {ALBANIA_BOUNDS[1]} and {ALBANIA_BOUNDS[3]}
        and confidence >= ?
        and coalesce(operating_status, 'open') <> 'permanently_closed'
      order by confidence desc nulls last, id
      {limit_clause}
    """

    connection = duckdb.connect(database=":memory:")
    connection.execute("install httpfs")
    connection.execute("load httpfs")
    connection.execute("set s3_region = 'us-west-2'")
    parameters: list[Any] = [source_uri, args.min_confidence]
    if args.limit:
        parameters.append(args.limit)
    cursor = connection.execute(query, parameters)
    columns = [description[0] for description in cursor.description]

    exported = 0
    skipped_category = 0
    skipped_name = 0
    category_counts: Counter[str] = Counter()
    city_counts: Counter[str] = Counter()

    with output.open("w", encoding="utf-8") as handle:
        while rows := cursor.fetchmany(1_000):
            for row in rows:
                item = dict(zip(columns, row))
                name = str(item.get("name") or "").strip()
                if not name or BLOCKED_NAME_PATTERN.search(name):
                    skipped_name += 1
                    continue

                classification = category_for(
                    item.get("primary_category"),
                    item.get("basic_category"),
                    item.get("alternate_categories"),
                    args.include_food_lodging,
                )
                if not classification:
                    skipped_category += 1
                    continue
                category_key, source_category_ids = classification

                attribution, source_updated_at = source_attribution(
                    item.get("sources_json"), args.release
                )
                city = canonical_city(item.get("locality"))
                websites = clean_strings(item.get("websites"))
                emails = clean_strings(item.get("emails"))
                phones = clean_strings(item.get("phones"))
                social_urls = clean_strings(item.get("socials"))

                record: dict[str, Any] = {
                    "source": "overture",
                    "source_version": args.release,
                    "source_place_id": str(item["id"]),
                    "name": name,
                    "category_key": category_key,
                    "source_category": item.get("primary_category"),
                    "source_category_ids": source_category_ids,
                    "description": None,
                    "address": item.get("address"),
                    "city": city,
                    "region": item.get("region"),
                    "country_code": "AL",
                    "postcode": item.get("postcode"),
                    "latitude": round(float(item["latitude"]), 7),
                    "longitude": round(float(item["longitude"]), 7),
                    "phone": phones[0] if phones else None,
                    "website": websites[0] if websites else None,
                    "email": emails[0] if emails else None,
                    "social_urls": social_urls,
                    "source_confidence": float(item["confidence"]),
                    "source_operating_status": item.get("operating_status"),
                    "source_updated_at": source_updated_at,
                    "source_attribution": attribution,
                }
                record["source_fingerprint"] = stable_fingerprint(record)
                handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")))
                handle.write("\n")
                exported += 1
                category_counts[category_key] += 1
                city_counts[city or "Unknown"] += 1

    connection.close()
    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "overture",
        "source_version": args.release,
        "output": str(output),
        "minimum_confidence": args.min_confidence,
        "exported": exported,
        "skipped_unaligned_category": skipped_category,
        "skipped_missing_or_test_name": skipped_name,
        "categories": dict(category_counts.most_common()),
        "top_cities": dict(city_counts.most_common(15)),
        "review_state": "Every imported row will remain needs_review.",
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if exported else 1


if __name__ == "__main__":
    raise SystemExit(main())
