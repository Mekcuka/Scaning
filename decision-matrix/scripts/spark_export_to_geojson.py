#!/usr/bin/env python3
"""
Convert Spark project export JSON to GeoJSON FeatureCollection (WGS84).

Usage:
  python scripts/spark_export_to_geojson.py path/to/export.json [-o out.geojson]

Requires: pyproj (same as backend).
Run from decision-matrix/ with PYTHONPATH=backend or from repo root.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.services.spark_import import parse_spark_project  # noqa: E402


def rows_to_feature_collection(rows: list[dict]) -> dict:
    features = []
    for r in rows:
        props = {
            "name": r["name"],
            "type": r["subtype"],
            "subtype": r["subtype"],
            **(r.get("properties") or {}),
        }
        if r.get("end_lon") is not None:
            coords = r.get("coordinates") or [
                [r["lon"], r["lat"]],
                [r["end_lon"], r["end_lat"]],
            ]
            geom = {"type": "LineString", "coordinates": coords}
        else:
            geom = {"type": "Point", "coordinates": [r["lon"], r["lat"]]}
        features.append({"type": "Feature", "properties": props, "geometry": geom})
    return {"type": "FeatureCollection", "features": features}


def main() -> int:
    parser = argparse.ArgumentParser(description="Spark export → GeoJSON")
    parser.add_argument("input", type=Path, help="Spark export.json")
    parser.add_argument("-o", "--output", type=Path, help="Output .geojson (default: stdout)")
    args = parser.parse_args()

    content = args.input.read_text(encoding="utf-8")
    rows, messages = parse_spark_project(content)
    fc = rows_to_feature_collection(rows)

    out_text = json.dumps(fc, ensure_ascii=False, indent=2)
    if args.output:
        args.output.write_text(out_text, encoding="utf-8")
        print(f"Wrote {len(rows)} features to {args.output}", file=sys.stderr)
    else:
        print(out_text)

    if messages:
        print(f"Skipped / notes ({len(messages)}):", file=sys.stderr)
        for m in messages[:20]:
            print(f"  - {m}", file=sys.stderr)
        if len(messages) > 20:
            print(f"  ... and {len(messages) - 20} more", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
