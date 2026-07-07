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

api_base_url="$(read_env_value NEXT_PUBLIC_APP_URL)"
supabase_url="$(read_env_value NEXT_PUBLIC_SUPABASE_URL)"
supabase_anon_key="$(read_env_value NEXT_PUBLIC_SUPABASE_ANON_KEY)"

if [[ -z "$api_base_url" ]]; then
  api_base_url="http://localhost:3000"
fi

mkdir -p "$(dirname "$OUTPUT_FILE")"
{
  echo "MIREBOOK_API_BASE_URL = $(escape_xcconfig_value "$api_base_url")"
  echo "MIREBOOK_SUPABASE_URL = $(escape_xcconfig_value "$supabase_url")"
  echo "MIREBOOK_SUPABASE_ANON_KEY = $supabase_anon_key"
} > "$OUTPUT_FILE"

echo "Wrote $OUTPUT_FILE"
