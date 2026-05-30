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
if [[ -f "${PREVIOUS}/.image-ref" ]]; then
  IMAGE_REF="$(tr -d '[:space:]' < "${PREVIOUS}/.image-ref")"
  APP_DOMAIN="$(grep '^APP_DOMAIN=' /opt/decision-matrix/shared/deploy.env | cut -d= -f2- || true)"
  cat > /opt/decision-matrix/shared/deploy.env <<EOF
IMAGE_REF=${IMAGE_REF}
APP_DOMAIN=${APP_DOMAIN}
EOF
  set -a
  # shellcheck disable=SC1091
  source /opt/decision-matrix/shared/deploy.env
  set +a
fi
docker compose pull || true
docker compose up -d --remove-orphans
echo "Rollback completed to ${PREVIOUS}"
