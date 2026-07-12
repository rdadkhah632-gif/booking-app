#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-"$ROOT_DIR/.env.local"}"

"$ROOT_DIR/scripts/ios-config-from-env.sh" "$ENV_FILE"

if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
  echo "Missing node_modules. Run npm install before starting the iOS test backend." >&2
  exit 1
fi

echo "Starting Mirëbook web/API backend for the iOS simulator test setup."
echo "Keep this terminal running while using the native app."
cd "$ROOT_DIR"
exec npm run dev
