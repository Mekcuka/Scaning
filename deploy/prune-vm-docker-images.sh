#!/usr/bin/env bash
# Keep running images + current/previous backend release tags; remove other local backend images.
set -euo pipefail

DEPLOY_ENV="/opt/decision-matrix/shared/deploy.env"
PREVIOUS_REF_FILE="/opt/decision-matrix/shared/previous_image_ref"
BACKEND_REPO_PREFIX="cr.yandex/"
BACKEND_IMAGE_NAME="decision-matrix-backend"

declare -A KEEP=()

add_keep() {
  local ref="$1"
  [[ -n "$ref" ]] || return 0
  KEEP["$ref"]=1
}

# Images used by running containers (db, caddy, api).
while read -r ref; do
  [[ -n "$ref" && "$ref" != "<none>" ]] && add_keep "$ref"
done < <(docker ps --format '{{.Image}}' | sort -u)

if [[ -f "$DEPLOY_ENV" ]]; then
  # shellcheck disable=SC1090
  set -a && source "$DEPLOY_ENV" && set +a
  add_keep "${IMAGE_REF:-}"
fi

if [[ -f "$PREVIOUS_REF_FILE" ]]; then
  add_keep "$(tr -d '[:space:]' < "$PREVIOUS_REF_FILE")"
fi

echo "Keeping ${#KEEP[@]} image reference(s):"
printf '  %s\n' "${!KEEP[@]}"

removed=0
while read -r repo tag id; do
  [[ -n "$repo" && -n "$tag" && -n "$id" ]] || continue
  [[ "$repo" == *"/${BACKEND_IMAGE_NAME}" ]] || continue
  ref="${repo}:${tag}"
  if [[ -n "${KEEP[$ref]:-}" ]]; then
    echo "  keep ${ref}"
    continue
  fi
  echo "  remove ${ref} (${id})"
  docker rmi "$id" 2>/dev/null || docker rmi "$ref" 2>/dev/null || true
  removed=$((removed + 1))
done < <(docker images --format '{{.Repository}} {{.Tag}} {{.ID}}' | grep "${BACKEND_IMAGE_NAME}" || true)

docker image prune -f >/dev/null || true
df -h /
echo "Removed ${removed} old backend image(s)."
