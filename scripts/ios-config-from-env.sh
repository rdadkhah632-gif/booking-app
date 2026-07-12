#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-"$ROOT_DIR/.env.local"}"
OUTPUT_FILE="$ROOT_DIR/ios/MirebookBusiness/Config/Local.xcconfig"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

read_env_value() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)"
  line="${line#*=}"
  line="${line%\"}"
  line="${line#\"}"
  line="${line%\'}"
  line="${line#\'}"
  printf '%s' "$line"
}

escape_xcconfig_value() {
  local value="$1"
  value="${value//:\/\//:\\/\\/}"
  printf '%s' "$value"
}

api_base_url="${MIREBOOK_IOS_API_BASE_URL:-}"
if [[ -z "$api_base_url" ]]; then
  api_base_url="$(read_env_value MIREBOOK_IOS_API_BASE_URL)"
fi
if [[ -z "$api_base_url" ]]; then
  api_base_url="${NEXT_PUBLIC_APP_URL:-}"
fi
if [[ -z "$api_base_url" ]]; then
  api_base_url="$(read_env_value NEXT_PUBLIC_APP_URL)"
fi

supabase_url="${MIREBOOK_IOS_SUPABASE_URL:-}"
if [[ -z "$supabase_url" ]]; then
  supabase_url="$(read_env_value MIREBOOK_IOS_SUPABASE_URL)"
fi
if [[ -z "$supabase_url" ]]; then
  supabase_url="${NEXT_PUBLIC_SUPABASE_URL:-}"
fi
if [[ -z "$supabase_url" ]]; then
  supabase_url="$(read_env_value NEXT_PUBLIC_SUPABASE_URL)"
fi

supabase_anon_key="${MIREBOOK_IOS_SUPABASE_ANON_KEY:-}"
if [[ -z "$supabase_anon_key" ]]; then
  supabase_anon_key="$(read_env_value MIREBOOK_IOS_SUPABASE_ANON_KEY)"
fi
if [[ -z "$supabase_anon_key" ]]; then
  supabase_anon_key="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"
fi
if [[ -z "$supabase_anon_key" ]]; then
  supabase_anon_key="$(read_env_value NEXT_PUBLIC_SUPABASE_ANON_KEY)"
fi

if [[ -z "$api_base_url" ]]; then
  api_base_url="http://localhost:3000"
fi

missing=()
if [[ -z "$supabase_url" ]]; then
  missing+=("NEXT_PUBLIC_SUPABASE_URL")
fi
if [[ -z "$supabase_anon_key" ]]; then
  missing+=("NEXT_PUBLIC_SUPABASE_ANON_KEY")
fi

if [[ "${#missing[@]}" -gt 0 ]]; then
  echo "Missing required public iOS backend setting(s): ${missing[*]}" >&2
  echo "Add them to $ENV_FILE or use the MIREBOOK_IOS_* override names." >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT_FILE")"
{
  echo "MIREBOOK_API_BASE_URL = $(escape_xcconfig_value "$api_base_url")"
  echo "MIREBOOK_SUPABASE_URL = $(escape_xcconfig_value "$supabase_url")"
  echo "MIREBOOK_SUPABASE_ANON_KEY = $supabase_anon_key"
} > "$OUTPUT_FILE"

echo "Wrote $OUTPUT_FILE"
echo "iOS API base URL: $api_base_url"
echo "Supabase URL: $supabase_url"
echo "Supabase anon key: configured"
