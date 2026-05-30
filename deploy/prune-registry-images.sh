#!/usr/bin/env bash
# Delete old tags in Yandex Container Registry; keep the newest KEEP_COUNT images.
set -euo pipefail

REGISTRY_ID="${1:-}"
IMAGE_NAME="${2:-decision-matrix-backend}"
KEEP_COUNT="${3:-5}"

if [[ -z "$REGISTRY_ID" ]]; then
  echo "Usage: $0 <registry_id> [image_name] [keep_count]" >&2
  exit 1
fi

REGISTRY_ID="${REGISTRY_ID#cr.yandex/}"
REGISTRY_ID="${REGISTRY_ID%%/*}"

if ! command -v yc >/dev/null 2>&1; then
  echo "yc CLI not found; skip registry prune." >&2
  exit 0
fi

REPO="${REGISTRY_ID}/${IMAGE_NAME}"
mapfile -t ROWS < <(
  yc container image list \
    --repository-name="$REPO" \
    --format=json \
    | python3 -c "
import json, sys
rows = json.load(sys.stdin)
rows.sort(key=lambda r: r.get('created_at', ''), reverse=True)
for r in rows:
    print(r['id'])
"
)

total="${#ROWS[@]}"
if (( total <= KEEP_COUNT )); then
  echo "Registry ${REPO}: ${total} image(s), nothing to prune (keep ${KEEP_COUNT})."
  exit 0
fi

echo "Registry ${REPO}: ${total} image(s), keeping ${KEEP_COUNT}, deleting $((total - KEEP_COUNT))..."
for (( i=KEEP_COUNT; i<total; i++ )); do
  id="${ROWS[$i]}"
  echo "  delete ${id}"
  yc container image delete --id "$id" || true
done
echo "Registry prune done."
