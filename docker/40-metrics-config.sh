#!/bin/sh
# Write the SPA's runtime config (assets/config.json) from environment variables at container start.
# Unset variables fall back to the same root-relative defaults the app ships with, so the image runs
# out of the box and a deployment only overrides what it needs to (URLs, endpoints, version).
set -eu

CONFIG_DIR=/usr/share/nginx/html/assets
mkdir -p "$CONFIG_DIR"

cat > "$CONFIG_DIR/config.json" <<EOF
{
  "apiURLRepo": "${API_URL_REPO:-/rmm/usagemetrics/repo}",
  "apiURLUsageRecord": "${API_URL_USAGE:-/rmm/usagemetrics/records}",
  "apiURLRecords": "${API_URL_RECORDS:-/rmm/records}",
  "dataciteApi": "${DATACITE_API:-https://api.datacite.org/dois}",
  "version": "${APP_VERSION:-unknown}"
}
EOF

echo "metrics-dashboard: wrote ${CONFIG_DIR}/config.json (version ${APP_VERSION:-unknown})"
