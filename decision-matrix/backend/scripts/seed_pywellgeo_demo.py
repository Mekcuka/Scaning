"""Seed PyWellGeo multi-lateral demo on a pad inside an existing project.

Creates:
  - oil_pad «Демо PyWellGeo ML» (2 wells)
  - 3 map bottomholes (main + lateral target for Скв-1, main for Скв-2)
  - welleng survey via design-from-bottomholes
  - PyWellGeo tree for Скв-1: import → coarsen → lateral lat1 to map bottomhole

Usage (from decision-matrix/backend, venv active):
  python scripts/seed_pywellgeo_demo.py --list-projects
  python scripts/seed_pywellgeo_demo.py --project-id cffb274b-1f05-4332-b8f9-3700b7f075f8
  python scripts/seed_pywellgeo_demo.py --project-id <uuid> --replace

Open:
  http://localhost:5173/pad-clustering/<project_id>
  → select «Демо PyWellGeo ML» → tab PyWellGeo → «Дерево»
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path
from uuid import UUID

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

_db_file = (BACKEND_ROOT / "data" / "sppr.db").resolve()
os.environ.setdefault("DATABASE_URL", f"sqlite+aiosqlite:///{_db_file.as_posix()}")

from sqlalchemy import select

from app.core.database import async_session
from app.models import InfrastructureLayer, InfrastructureObject, Project
from app.schemas import InfraObjectCreate
from app.services.infra_create import create_infra_object_record
from app.services.pad_earthwork.earthwork_store import store_sketch, store_wells_local
from app.services.pad_earthwork.schemas import PlanRectangleSketchIn, PlanVertexIn
from app.services.pad_earthwork.properties import PAD_HEIGHT_M, PAD_REFERENCE_ELEVATION_M
from app.services.well_trajectory.bottomhole_properties import LINKED_PAD_ID
from app.services.well_trajectory.coord_transform import local_to_lonlat
from app.services.well_trajectory.layout_ops import apply_generate_to_properties
from app.services.well_trajectory.pywellgeo_ops import (
    add_branch_to_tree,
    coarsen_tree,
    compute_tree,
    merge_trees_put,
    sync_from_survey,
)
from app.services.well_trajectory.pywellgeo_schemas import PyWellGeoTreeRecord, PyWellGeoTreesPutRequest
from app.services.well_trajectory.schemas import WellTrajectoryDesignFromBottomholesRequest
from app.services.well_trajectory.service import design_from_bottomholes
from app.services.well_trajectory.trajectory_store import store_trajectories_json

DEMO_PAD_NAME = "Демо PyWellGeo ML"
DEFAULT_PROJECT_ID = "cffb274b-1f05-4332-b8f9-3700b7f075f8"

# (name, well_index, east_m, north_m, tvd_m)
DEMO_BOTTOMHOLES: list[tuple[str, int, float, float, float]] = [
    ("Забой Скв-1 (main)", 0, 520.0, 0.0, 2200.0),
    ("Забой lat1 Скв-1", 0, 880.0, 140.0, 2200.0),
    ("Забой Скв-2", 1, 480.0, -35.0, 2100.0),
]

WELLS_LOCAL = [
    PlanVertexIn(east_m=0.0, north_m=0.0),
    PlanVertexIn(east_m=9.0, north_m=0.0),
]


async def list_projects() -> None:
    async with async_session() as db:
        rows = (
            await db.execute(select(Project.id, Project.name).order_by(Project.updated_at.desc()).limit(30))
        ).all()
        if not rows:
            print("Нет проектов в БД.")
            return
        for pid, name in rows:
            print(f"{pid}  {name}")


async def resolve_project(db, project_id: UUID | None) -> Project:
    if project_id:
        project = await db.get(Project, project_id)
        if not project:
            raise SystemExit(f"Проект не найден: {project_id}")
        return project
    project = (
        await db.execute(select(Project).order_by(Project.updated_at.desc()).limit(1))
    ).scalar_one_or_none()
    if not project:
        raise SystemExit("Нет проектов. Запустите seed.py или укажите --project-id.")
    return project


def _layer_ids_subquery(project_id: UUID):
    return select(InfrastructureLayer.id).where(InfrastructureLayer.project_id == project_id)


async def remove_demo(db, project_id: UUID) -> None:
    layer_sq = _layer_ids_subquery(project_id)
    pads = (
        await db.execute(
            select(InfrastructureObject).where(
                InfrastructureObject.layer_id.in_(layer_sq),
                InfrastructureObject.name == DEMO_PAD_NAME,
            )
        )
    ).scalars().all()
    if not pads:
        return
    pad_ids = {str(p.id) for p in pads}
    all_objs = (
        await db.execute(select(InfrastructureObject).where(InfrastructureObject.layer_id.in_(layer_sq)))
    ).scalars().all()
    removed_bh = 0
    for obj in all_objs:
        props = obj.properties or {}
        if props.get(LINKED_PAD_ID) in pad_ids:
            await db.delete(obj)
            removed_bh += 1
    for pad in pads:
        await db.delete(pad)
    print(f"Удалено: куст {len(pads)}, забоев {removed_bh}")


def _tree_dict(node) -> dict:
    if hasattr(node, "model_dump"):
        return node.model_dump(mode="json")
    return dict(node)


def _pick_kickoff_node(tree: dict) -> dict:
    """Main-bore node deep enough for a realistic lateral kick-off."""
    node = tree
    chosen = node
    while node.get("branches"):
        child = node["branches"][0]
        tvd = -float(child.get("z", 0))
        if tvd >= 900:
            chosen = child
        node = child
    if -float(chosen.get("z", 0)) < 400 and node is not tree:
        chosen = node
    return chosen


async def seed(project_id: UUID, *, replace: bool) -> None:
    async with async_session() as db:
        project = await resolve_project(db, project_id)
        if replace:
            await remove_demo(db, project.id)

        existing = (
            await db.execute(
                select(InfrastructureObject).where(
                    InfrastructureObject.layer_id.in_(_layer_ids_subquery(project.id)),
                    InfrastructureObject.name == DEMO_PAD_NAME,
                )
            )
        ).scalar_one_or_none()
        if existing:
            raise SystemExit(
                f"Куст «{DEMO_PAD_NAME}» уже есть ({existing.id}). "
                "Запустите с --replace или откройте существующий."
            )

        # Anchor near Moscow demo area; offset if project has POI elsewhere — still valid locally.
        pad_lon, pad_lat = 37.6200, 55.7400
        pad = await create_infra_object_record(
            db,
            project_id=project.id,
            data=InfraObjectCreate(
                name=DEMO_PAD_NAME,
                subtype="oil_pad",
                lon=pad_lon,
                lat=pad_lat,
            ),
        )

        sketch = PlanRectangleSketchIn(
            kind="plan_rectangle",
            length_m=120.0,
            width_m=80.0,
            rotation_deg=90.0,
        )
        props: dict = dict(pad.properties or {})
        props = store_sketch(props, sketch)
        props = store_wells_local(props, WELLS_LOCAL)
        props[PAD_REFERENCE_ELEVATION_M] = 150.0
        props[PAD_HEIGHT_M] = 2.0
        pad.properties = props
        await db.flush()

        props = apply_generate_to_properties(pad)
        pad.properties = props

        pad_id_str = str(pad.id)
        for name, well_index, east, north, tvd in DEMO_BOTTOMHOLES:
            bh_lon, bh_lat = local_to_lonlat(pad_lon, pad_lat, east, north)
            await create_infra_object_record(
                db,
                project_id=project.id,
                data=InfraObjectCreate(
                    name=name,
                    subtype="well_bottomhole_nnb",
                    lon=bh_lon,
                    lat=bh_lat,
                    properties={
                        LINKED_PAD_ID: pad_id_str,
                        "well_bottomhole_well_index": well_index,
                        "well_bottomhole_tvd_m": tvd,
                        "well_bottomhole_target_inc": 90,
                        "well_bottomhole_target_azi": 90,
                    },
                ),
            )

        design = await design_from_bottomholes(
            db,
            pad,
            WellTrajectoryDesignFromBottomholesRequest(step_m=30.0),
            project_id=project.id,
        )
        if not design.designed:
            raise SystemExit(f"Design failed: {design.warnings}")
        pad.properties = store_trajectories_json(pad.properties, design.trajectories)

        sync0 = sync_from_survey(pad.properties, well_index=0, radius_m=None)
        tree0 = _tree_dict(sync0.tree.tree)
        record0, n_before, n_after = coarsen_tree(
            pad.properties,
            well_index=0,
            tree=tree0,
            segment_length_m=75.0,
        )
        tree0 = _tree_dict(record0.tree)

        kickoff = _pick_kickoff_node(tree0)
        lat_bh = DEMO_BOTTOMHOLES[1]
        _, _, lat_e, lat_n, lat_tvd = lat_bh
        xyz = [
            [float(kickoff["x"]), float(kickoff["y"]), float(kickoff["z"])],
            [lat_e, lat_n, -lat_tvd],
        ]
        lat_record = add_branch_to_tree(
            pad.properties,
            well_index=0,
            tree=tree0,
            xyz=xyz,
            name="lat1",
            color="orange",
            radius_m=float(kickoff.get("radius", 0.10795)),
        )
        tree0_with_lat = _tree_dict(lat_record.tree)

        sync1 = sync_from_survey(pad.properties, well_index=1, radius_m=None)
        coarse1, _, _ = coarsen_tree(
            pad.properties,
            well_index=1,
            tree=_tree_dict(sync1.tree.tree),
            segment_length_m=75.0,
        )

        computed0 = compute_tree(
            pad.properties,
            well_index=0,
            tsurface_c=10.0,
            tgrad_c_per_m=0.031,
            tree_override=tree0_with_lat,
        )
        tree_well0 = computed0.tree

        trees = [
            PyWellGeoTreeRecord(
                well_index=0,
                name=design.trajectories[0].get("name"),
                tree=_tree_dict(tree_well0.tree),
                source="demo_lateral",
                geometry=tree_well0.geometry,
                branch_stats=tree_well0.branch_stats,
            ),
            PyWellGeoTreeRecord(
                well_index=1,
                name=design.trajectories[1].get("name") if len(design.trajectories) > 1 else None,
                tree=_tree_dict(coarse1.tree),
                source="welleng_survey",
            ),
        ]
        pad.properties = merge_trees_put(
            pad.properties,
            PyWellGeoTreesPutRequest(trees=trees),
        )

        await db.commit()

        stations0 = len(design.trajectories[0].get("survey", {}).get("stations", []))
        print()
        print("PyWellGeo demo OK")
        print(f"  project:  {project.id}  ({project.name})")
        print(f"  pad:      {pad.id}  «{DEMO_PAD_NAME}»")
        print(f"  wells:    2  |  bottomholes: {len(DEMO_BOTTOMHOLES)}")
        print(f"  Skv-1:    survey {stations0} st -> coarsen {n_before}->{n_after} -> lateral lat1 (orange)")
        print(f"  Skv-2:    survey imported + coarsen (no lateral)")
        if design.warnings:
            print("  warnings:", "; ".join(design.warnings[:5]))
        print()
        print(f"  UI: http://localhost:5173/pad-clustering/{project.id}")
        print("  -> tab PyWellGeo -> tree / 3D layer «Vetvi»")
        print("  -> mode «Do zaboya kusta»: «Zaboj lat1 Skv-1» for second lateral")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed PyWellGeo multi-lateral demo pad")
    parser.add_argument("--list-projects", action="store_true")
    parser.add_argument("--project-id", type=str, default=DEFAULT_PROJECT_ID)
    parser.add_argument("--replace", action="store_true", help="Remove existing demo pad first")
    args = parser.parse_args()
    if args.list_projects:
        asyncio.run(list_projects())
        return
    pid = UUID(args.project_id)
    asyncio.run(seed(pid, replace=args.replace))


if __name__ == "__main__":
    main()
