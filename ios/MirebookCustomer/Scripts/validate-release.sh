#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
customer_dir="$(cd "${script_dir}/.." && pwd)"
repo_dir="$(cd "${customer_dir}/../.." && pwd)"
project_path="${customer_dir}/MirebookCustomer.xcodeproj"
app_dir="${customer_dir}/MirebookCustomer"
icon_path="${app_dir}/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png"

fail() {
  printf 'Release validation failed: %s\n' "$1" >&2
  exit 1
}

for plist_path in \
  "${app_dir}/Info.plist" \
  "${app_dir}/PrivacyInfo.xcprivacy" \
  "${app_dir}/MirebookCustomer.entitlements" \
  "${app_dir}/Resources/en.lproj/Localizable.strings" \
  "${app_dir}/Resources/sq.lproj/Localizable.strings" \
  "${project_path}/project.pbxproj"
do
  plutil -lint "${plist_path}" >/dev/null
done

xmllint --noout \
  "${project_path}/xcshareddata/xcschemes/MirebookCustomer.xcscheme"

[[ -f "${icon_path}" ]] || fail "Missing 1024px App Store icon."

icon_width="$(sips -g pixelWidth "${icon_path}" | awk '/pixelWidth/ {print $2}')"
icon_height="$(sips -g pixelHeight "${icon_path}" | awk '/pixelHeight/ {print $2}')"
icon_alpha="$(sips -g hasAlpha "${icon_path}" | awk '/hasAlpha/ {print $2}')"

[[ "${icon_width}" == "1024" ]] || fail "App icon width is not 1024px."
[[ "${icon_height}" == "1024" ]] || fail "App icon height is not 1024px."
[[ "${icon_alpha}" == "no" ]] || fail "App icon must not contain alpha."

en_keys="$(mktemp /tmp/mirebook-customer-en-keys.XXXXXX)"
sq_keys="$(mktemp /tmp/mirebook-customer-sq-keys.XXXXXX)"
build_settings="$(mktemp /tmp/mirebook-customer-build-settings.XXXXXX)"
trap 'rm -f "${en_keys}" "${sq_keys}" "${build_settings}"' EXIT

rg -o '^"[^"]+"' \
  "${app_dir}/Resources/en.lproj/Localizable.strings" | sort >"${en_keys}"
rg -o '^"[^"]+"' \
  "${app_dir}/Resources/sq.lproj/Localizable.strings" | sort >"${sq_keys}"
cmp -s "${en_keys}" "${sq_keys}" || fail "English and Albanian keys differ."

xcodebuild \
  -project "${project_path}" \
  -scheme MirebookCustomer \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -showBuildSettings >"${build_settings}"

require_setting() {
  local key="$1"
  local expected="$2"
  rg -q "^[[:space:]]*${key} = ${expected}$" "${build_settings}" \
    || fail "${key} is not ${expected}."
}

setting_value() {
  local key="$1"
  awk -F ' = ' -v key="${key}" '$1 ~ "^[[:space:]]*" key "$" {print $2; exit}' \
    "${build_settings}"
}

require_setting ASSETCATALOG_COMPILER_APPICON_NAME AppIcon
require_setting CODE_SIGN_STYLE Automatic
require_setting CODE_SIGN_ENTITLEMENTS MirebookCustomer/MirebookCustomer.entitlements
require_setting DEVELOPMENT_TEAM 42V884483P
require_setting PRODUCT_BUNDLE_IDENTIFIER com.mirebook.ios.customer

rg -q 'SWIFT_ACTIVE_COMPILATION_CONDITIONS = .*MIREBOOK_PUSH_NOTIFICATIONS' \
  "${build_settings}" \
  || fail "Release does not compile the Push Notifications path."

build_number="$(setting_value CURRENT_PROJECT_VERSION)"
marketing_version="$(setting_value MARKETING_VERSION)"
[[ "${build_number}" =~ ^[1-9][0-9]*$ ]] \
  || fail "CURRENT_PROJECT_VERSION must be a positive integer."
[[ "${marketing_version}" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?$ ]] \
  || fail "MARKETING_VERSION must be a dotted numeric version."

rg -q '^MIREBOOK_API_BASE_URL = https:\\/\\/mirebook\.com$' \
  "${customer_dir}/Config/Release.xcconfig" \
  || fail "Release API origin is not the production HTTPS origin."

if rg -n \
  'SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY|sk_(live|test)_' \
  "${customer_dir}/MirebookCustomer" \
  "${customer_dir}/Config"
then
  fail "A server-side secret marker exists in the customer iOS source."
fi

node "${repo_dir}/scripts/verify-customer-ios-production.mjs"

printf 'Release validation passed: Mirëbook Customer %s (%s), %s localization keys.\n' \
  "${marketing_version}" \
  "${build_number}" \
  "$(wc -l <"${en_keys}" | tr -d ' ')"
