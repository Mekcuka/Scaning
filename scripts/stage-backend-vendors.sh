#!/usr/bin/env bash
# Stage microservice vendor copies for backend Docker build.
# Run from repo root before: docker compose -f deploy/docker-compose.dev.yml up --build

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/decision-matrix/backend"

cp -r "$ROOT/decision-matrix/shared" "$BACKEND/shared"
echo "Staged: decision-matrix/backend/shared"

stage_vendor() {
  local src="$1"
  local dest="$2"
  if [[ ! -d "$src" ]]; then
    echo "Missing source: $src" >&2
    exit 1
  fi
  rm -rf "$dest"
  cp -r "$src" "$dest"
  echo "Staged: $dest"
}

stage_vendor "$ROOT/autoroad-network-planner" "$BACKEND/network-planner-vendor"
stage_vendor "$ROOT/pad-earthwork-planner" "$BACKEND/pad-earthwork-vendor"
stage_vendor "$ROOT/well-trajectory-planner" "$BACKEND/well-trajectory-vendor"

echo "Vendor staging complete."
