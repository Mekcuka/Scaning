import json  # обязателен в этой ячейке (не зависит от setup)
import math
import sys
from pathlib import Path

# preview_helpers — в notebooks/ или cwd
for _p in (Path.cwd(), Path.cwd() / "notebooks", Path.cwd().parent / "notebooks"):
    if (_p / "preview_helpers.py").is_file() and str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

from preview_helpers import ensure_plan_context

from autoroad_planner.constants import TERMINAL_EXCLUSION_RADIUS_KM
from autoroad_planner.terminal_exclusion import exclusion_boundary_point

req, out, terminals, ROOT = ensure_plan_context(globals())


def exclusion_zone_ring(lon: float, lat: float, *, radius_km: float = TERMINAL_EXCLUSION_RADIUS_KM, n: int = 72):
    ring: list[list[float]] = []
    for i in range(n):
        bearing = 2 * math.pi * i / n
        toward_lon = lon + math.sin(bearing) * 0.05
        toward_lat = lat + math.cos(bearing) * 0.05
        blon, blat = exclusion_boundary_point(lon, lat, toward_lon, toward_lat, radius_km=radius_km)
        ring.append([blon, blat])
    ring.append(ring[0])
    return ring


features: list[dict] = []
for t in terminals:
    features.append(
        {
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [exclusion_zone_ring(t.lon, t.lat)]},
            "properties": {
                "kind": "exclusion_zone",
                "name": t.name,
                "radius_m": int(TERMINAL_EXCLUSION_RADIUS_KM * 1000),
            },
        }
    )
    features.append(
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [t.lon, t.lat]},
            "properties": {"name": t.name},
        }
    )
for ln in out.new_lines:
    features.append(
        {
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": ln.coordinates},
            "properties": {"kind": ln.kind},
        }
    )
for nd in out.new_nodes:
    features.append(
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [nd.lon, nd.lat]},
            "properties": {"reason": nd.reason},
        }
    )

geojson_path = ROOT / "data" / "gks12_from_jupyter.geojson"
geojson_path.write_text(
    json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False),
    encoding="utf-8",
)
print(geojson_path.resolve(), "| features:", len(features))