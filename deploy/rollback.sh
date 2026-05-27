#!/usr/bin/env bash
set -euo pipefail

RELEASES_DIR="/opt/decision-matrix/releases"
CURRENT_LINK="/opt/decision-matrix/current"

if [[ ! -d "${RELEASES_DIR}" ]]; then
  echo "No releases directory found: ${RELEASES_DIR}" >&2
  exit 1
fi

mapfile -t RELEASES < <(ls -1dt "${RELEASES_DIR}"/* 2>/dev/null || true)

if (( ${#RELEASES[@]} < 2 )); then
  echo "Need at least 2 releases to rollback." >&2
  exit 1
fi

PREVIOUS="${RELEASES[1]}"
ln -sfn "${PREVIOUS}" "${CURRENT_LINK}"
cd "${CURRENT_LINK}"
docker compose pull || true
docker compose up -d --remove-orphans
echo "Rollback completed to ${PREVIOUS}"
