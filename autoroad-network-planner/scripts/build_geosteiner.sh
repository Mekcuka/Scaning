#!/usr/bin/env bash
# Build GeoSteiner 5.3 stand-alone tools (efst, bb) into vendor/geosteiner/bin.
# Requires: curl, tar, make, gcc (Linux/macOS). License: CC BY-NC 4.0 — see GeoSteiner LICENSE.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/vendor/geosteiner"
SRC="$VENDOR/src"
BIN="$VENDOR/bin"
VERSION="${GEOSTEINER_VERSION:-5.3}"
URL="https://geosteiner.net/geosteiner-${VERSION}.tar.gz"

mkdir -p "$SRC" "$BIN"

if [[ ! -f "$SRC/Makefile" ]]; then
  echo "Downloading GeoSteiner ${VERSION} from ${URL}"
  curl -fsSL "$URL" | tar -xz -C "$SRC" --strip-components=1
fi

echo "Building GeoSteiner in $SRC"
make -C "$SRC" clean || true
make -C "$SRC" -j"$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 2)"

for tool in efst bb; do
  if [[ -x "$SRC/$tool" ]]; then
    cp "$SRC/$tool" "$BIN/$tool"
    chmod +x "$BIN/$tool"
  else
    echo "Missing built tool: $SRC/$tool" >&2
    exit 1
  fi
done

echo "GeoSteiner installed to $BIN"
echo "export GEOSTEINER_BIN_DIR=$BIN"
