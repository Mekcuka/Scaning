"""Copy planner sources from decision-matrix and rewrite app.* imports."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DM = ROOT.parent / "decision-matrix" / "backend" / "app"
OUT = ROOT / "autoroad_planner"

REPLACEMENTS = [
    ("from app.services.autoroad_network.", "from autoroad_planner."),
    ("from app.services.line_split import", "from autoroad_planner.line_intersect import"),
    ("from app.services.terminal_exclusion import", "from autoroad_planner.terminal_exclusion import"),
    ("from app.services.road_graph import", "from autoroad_planner.road_graph import"),
    ("from app.services.spatial import", "from autoroad_planner.spatial import"),
    ("from app.geo.constants import", "from autoroad_planner.constants import"),
]

SOURCES: list[tuple[Path, Path]] = [
    (DM / "services" / "autoroad_network" / "plan_core.py", OUT / "plan_core.py"),
    (DM / "services" / "autoroad_network" / "schemas.py", OUT / "schemas.py"),
    (DM / "services" / "autoroad_network" / "graph_from_polylines.py", OUT / "graph_from_polylines.py"),
    (DM / "services" / "terminal_exclusion.py", OUT / "terminal_exclusion.py"),
]


def transform(text: str) -> str:
    for old, new in REPLACEMENTS:
        text = text.replace(old, new)
    return text


def main() -> None:
    for src, dst in SOURCES:
        if not src.is_file():
            raise SystemExit(f"missing source: {src}")
        raw = src.read_text(encoding="utf-8")
        dst.write_text(transform(raw), encoding="utf-8")
        print(f"synced {dst.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
