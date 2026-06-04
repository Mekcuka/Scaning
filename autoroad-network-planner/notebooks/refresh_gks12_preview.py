"""Пересчёт GKS12 и артефакты для autoroad_network_preview.ipynb (без Jupyter)."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from uuid import UUID, uuid4

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from autoroad_planner import compute_network_plan_sync
from autoroad_planner.constants import TERMINAL_EXCLUSION_RADIUS_KM
from autoroad_planner.schemas import NetworkPlanRequest, PlanTerminalInput
from autoroad_planner.terminal_exclusion import exclusion_boundary_point

GKS_RAW = [
    ("6e0a2599-f391-4ca2-be46-565b71657222", "GKS_1", 37.142939119144025, 56.04061323280081),
    ("53c1e053-c2aa-4265-b972-2550efb98ef6", "GKS_2", 37.209717990505276, 56.04061323280081),
    ("3c7b0733-faa8-4f2a-bcda-c1daaf97592a", "GKS_3", 37.16123879581562, 55.94803530058053),
    ("e2357a2f-4410-4345-9429-28c76c93815c", "GKS_4", 37.22213184325423, 55.94938438681757),
    ("434f9bd5-cfca-4edd-8b5f-d73e46665cc7", "GKS_5", 37.28356554653648, 55.9487153552989),
    ("5045d9d3-df96-42bf-ac0d-ad1b3991582e", "GKS_6", 37.35034441789771, 55.9487153552989),
    ("a3c3ca43-917b-4992-a71a-4539722936ed", "GKS_7", 37.1387474374583, 56.0873732793855),
    ("24485248-e0ac-4267-b4d7-c975237cac4d", "GKS_8", 37.199455502332164, 56.08872847268688),
    ("9fd68e18-ff37-4e4b-99da-bb85a17d0718", "GKS_9", 37.34092558425556, 56.05552410800988),
    ("d0f04c1e-5cc3-436b-8f03-323a8eddb796", "GKS_10", 37.407704455616795, 56.05552410800988),
    ("3e95964b-ad96-451c-9b87-8a9a1afc3830", "GKS_11", 37.41338266237315, 55.99696486312589),
    ("5b4ea7ec-fc0b-42ef-aecf-aa4ade221282", "GKS_12", 37.47409072724702, 55.9983232116441),
]


def exclusion_zone_ring(lon: float, lat: float, *, radius_km: float, n: int = 72):
    ring = []
    for i in range(n):
        bearing = 2 * math.pi * i / n
        toward_lon = lon + math.sin(bearing) * 0.05
        toward_lat = lat + math.cos(bearing) * 0.05
        blon, blat = exclusion_boundary_point(
            lon, lat, toward_lon, toward_lat, radius_km=radius_km
        )
        ring.append([blon, blat])
    ring.append(ring[0])
    return ring


def main() -> None:
    terminals = [
        PlanTerminalInput(
            id=UUID(oid),
            subtype="gas_processing",
            subtype_label="ГКС",
            category="area_facility",
            name=name,
            lon=lon,
            lat=lat,
            coordinates=[lon, lat],
            properties={},
        )
        for oid, name, lon, lat in GKS_RAW
    ]
    req = NetworkPlanRequest(project_id=uuid4(), terminals=terminals, existing_autoroads=[])
    out = compute_network_plan_sync(req)

    data = ROOT / "data"
    data.mkdir(parents=True, exist_ok=True)
    (data / "gks12_request.json").write_text(req.model_dump_json(indent=2), encoding="utf-8")
    (data / "gks12_response.json").write_text(out.model_dump_json(indent=2), encoding="utf-8")

    features = []
    for t in terminals:
        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [exclusion_zone_ring(t.lon, t.lat, radius_km=TERMINAL_EXCLUSION_RADIUS_KM)],
                },
                "properties": {"kind": "exclusion_zone", "name": t.name},
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
                "properties": {"kind": "node", "reason": nd.reason},
            }
        )
    for t in terminals:
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [t.lon, t.lat]},
                "properties": {"kind": "terminal", "name": t.name},
            }
        )
    geo = {"type": "FeatureCollection", "features": features}
    (data / "gks12_from_jupyter.geojson").write_text(
        json.dumps(geo, ensure_ascii=False), encoding="utf-8"
    )

    import matplotlib.pyplot as plt
    from matplotlib.lines import Line2D
    from matplotlib.patches import Patch

    fig, ax = plt.subplots(figsize=(14, 10))
    for t in terminals:
        ring = exclusion_zone_ring(t.lon, t.lat, radius_km=TERMINAL_EXCLUSION_RADIUS_KM)
        xs, ys = zip(*[(p[0], p[1]) for p in ring])
        ax.fill(xs, ys, color="#e74c3c", alpha=0.14, edgecolor="#c0392b", linewidth=1.0, linestyle="--", zorder=0)
    for ln in out.new_lines:
        xs = [c[0] for c in ln.coordinates]
        ys = [c[1] for c in ln.coordinates]
        color = "#e67e22" if ln.kind == "connector" else "#2980b9"
        lw = 2.2 if ln.kind == "connector" else 1.4
        ax.plot(xs, ys, color=color, linewidth=lw, zorder=2 if ln.kind == "connector" else 1)
    for nd in out.new_nodes:
        ax.plot(nd.lon, nd.lat, "o", color="#8e44ad", markersize=5, zorder=3)
    for t in terminals:
        ax.plot(t.lon, t.lat, "s", color="#27ae60", markersize=11, zorder=4)
        ax.annotate(t.name, (t.lon, t.lat), xytext=(6, 6), textcoords="offset points", fontsize=9)
    connected = "terminals_not_connected" not in out.warnings
    ax.set_title(f"План сети: {out.total_new_km:.1f} км | связность: {'да' if connected else 'нет'}")
    ax.set_aspect("equal", adjustable="box")
    ax.grid(True, linestyle="--", alpha=0.35)
    png = data / "gks12_plan_preview.png"
    fig.savefig(png, dpi=120, bbox_inches="tight")
    plt.close(fig)

    print("Связность:", connected)
    print("warnings:", out.warnings)
    print("total_new_km:", out.total_new_km)
    print("connectors:", sum(1 for ln in out.new_lines if ln.kind == "connector"))
    print("links:", sum(1 for ln in out.new_lines if ln.kind == "link"))
    print("nodes:", len(out.new_nodes))
    print("saved:", data / "gks12_response.json")
    print("PNG:", png)


if __name__ == "__main__":
    main()
