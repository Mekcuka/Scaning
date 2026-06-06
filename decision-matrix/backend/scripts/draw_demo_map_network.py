"""Draw demo map: 10 pads, 2 sand quarries, road network with nodes and intersections.

Usage (from decision-matrix/backend):
  python scripts/draw_demo_map_network.py --list-projects
  python scripts/draw_demo_map_network.py --project-name "третий проект"
  python scripts/draw_demo_map_network.py --replace
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

# Same SQLite file as run_local.py / seed.py (ignore .env Postgres for this script)
_db_file = (BACKEND_ROOT / "data" / "sppr.db").resolve()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_db_file.as_posix()}"

from sqlalchemy import delete, select, update

from app.services.infra_create import create_infra_object_record as _create_infra_object_record
from app.core.database import async_session
from app.models import (
    InfrastructureEdge,
    InfrastructureLayer,
    InfrastructureNode,
    InfrastructureNetwork,
    InfrastructureObject,
    PointOfInterest,
    Project,
    PoiInfrastructureAnalysis,
)
from app.schemas import InfraObjectCreate
from app.services.graph_builder import build_network_from_lines

# ~37.62°E, 55.74°N — рядом с демо-участком seed
def _pt(lon: float, lat: float) -> tuple[float, float]:
    return (lon, lat)


# Узлы перекрёстков
NODES: list[tuple[str, float, float]] = [
    ("Узел Центр", *_pt(37.620, 55.740)),
    ("Узел Север", *_pt(37.620, 55.768)),
    ("Узел Юг", *_pt(37.620, 55.712)),
    ("Узел Восток", *_pt(37.658, 55.740)),
    ("Узел Запад", *_pt(37.582, 55.740)),
    ("Узел СВ", *_pt(37.648, 55.758)),
    ("Узел СЗ", *_pt(37.592, 55.758)),
    ("Узел ЮВ", *_pt(37.648, 55.722)),
    ("Узел ЮЗ", *_pt(37.592, 55.722)),
    ("Перекрёсток 1", *_pt(37.638, 55.752)),
    ("Перекрёсток 2", *_pt(37.602, 55.728)),
]

PADS: list[tuple[str, float, float]] = [
    ("Куст №1", *_pt(37.620, 55.782)),
    ("Куст №2", *_pt(37.620, 55.698)),
    ("Куст №3", *_pt(37.678, 55.740)),
    ("Куст №4", *_pt(37.562, 55.740)),
    ("Куст №5", *_pt(37.655, 55.772)),
    ("Куст №6", *_pt(37.585, 55.755)),
    ("Куст №7", *_pt(37.662, 55.708)),
    ("Куст №8", *_pt(37.578, 55.725)),
    ("Куст №9", *_pt(37.642, 55.738)),
    ("Куст №10", *_pt(37.598, 55.738)),
]

QUARRIES: list[tuple[str, float, float]] = [
    ("Карьер песка СЗ", *_pt(37.575, 55.765)),
    ("Карьер песка ЮВ", *_pt(37.665, 55.715)),
]

# Дороги: концы цепочки должны совпадать с точечными объектами (допуск 0.3 км)
ROADS: list[tuple[str, list[tuple[float, float]]]] = [
    ("Магистраль С–Ю", [NODES[1][1:], NODES[0][1:], NODES[9][1:], NODES[10][1:], NODES[2][1:]]),
    ("Магистраль З–В", [NODES[4][1:], NODES[0][1:], NODES[3][1:]]),
    ("Дуга север", [NODES[5][1:], NODES[1][1:], NODES[6][1:]]),
    ("Дуга юг", [NODES[7][1:], NODES[2][1:], NODES[8][1:]]),
    ("Кольцо север–запад", [NODES[6][1:], NODES[4][1:], NODES[8][1:], NODES[7][1:], NODES[5][1:]]),
    ("Диагональ 1", [NODES[9][1:], NODES[3][1:]]),
    ("Диагональ 2", [NODES[10][1:], NODES[4][1:]]),
    ("Съезд на карьер СЗ", [NODES[6][1:], QUARRIES[0][1:]]),
    ("Съезд на карьер ЮВ", [NODES[7][1:], QUARRIES[1][1:]]),
    ("Подъезд куст 1", [NODES[1][1:], PADS[0][1:]]),
    ("Подъезд куст 2", [NODES[2][1:], PADS[1][1:]]),
    ("Подъезд куст 3", [NODES[3][1:], PADS[2][1:]]),
    ("Подъезд куст 4", [NODES[4][1:], PADS[3][1:]]),
    ("Подъезд куст 5", [NODES[5][1:], PADS[4][1:]]),
    ("Подъезд куст 6", [NODES[6][1:], PADS[5][1:]]),
    ("Подъезд куст 7", [NODES[7][1:], PADS[6][1:]]),
    ("Подъезд куст 8", [NODES[8][1:], PADS[7][1:]]),
    ("Подъезд куст 9", [NODES[0][1:], PADS[8][1:]]),
    ("Подъезд куст 10", [NODES[10][1:], PADS[9][1:]]),
]


async def list_projects() -> None:
    async with async_session() as db:
        rows = (
            await db.execute(select(Project.id, Project.name).order_by(Project.updated_at.desc()).limit(20))
        ).all()
        if not rows:
            print("Нет проектов в БД.")
            return
        for pid, name in rows:
            print(f"{pid}  {name}")


async def clear_infra(db, project_id: UUID) -> int:
    layer_ids_sq = select(InfrastructureLayer.id).where(InfrastructureLayer.project_id == project_id)
    poi_ids_sq = select(PointOfInterest.id).where(PointOfInterest.project_id == project_id)
    network_ids_sq = select(InfrastructureNetwork.id).where(InfrastructureNetwork.project_id == project_id)

    n_objects = len(
        (await db.execute(select(InfrastructureObject.id).where(InfrastructureObject.layer_id.in_(layer_ids_sq)))).all()
    )

    await db.execute(
        update(PoiInfrastructureAnalysis)
        .where(PoiInfrastructureAnalysis.poi_id.in_(poi_ids_sq))
        .values(nearest_object_id=None, overridden_object_id=None, nearest_node_id=None)
    )
    await db.execute(delete(InfrastructureEdge).where(InfrastructureEdge.network_id.in_(network_ids_sq)))
    await db.execute(delete(InfrastructureNode).where(InfrastructureNode.network_id.in_(network_ids_sq)))
    await db.execute(delete(InfrastructureObject).where(InfrastructureObject.layer_id.in_(layer_ids_sq)))
    return n_objects


async def resolve_project(db, *, project_id: UUID | None, project_name: str | None) -> Project:
    if project_id:
        project = await db.get(Project, project_id)
        if not project:
            raise SystemExit(f"Проект не найден: {project_id}")
        return project
    q = select(Project).order_by(Project.updated_at.desc())
    if project_name:
        q = q.where(Project.name == project_name)
    project = (await db.execute(q.limit(1))).scalar_one_or_none()
    if not project:
        hint = f" с именем «{project_name}»" if project_name else ""
        raise SystemExit(f"Проект{hint} не найден. Запустите с --list-projects.")
    return project


async def draw(project_id: UUID, *, replace: bool) -> None:
    async with async_session() as db:
        if replace:
            removed = await clear_infra(db, project_id)
            print(f"Удалено объектов инфраструктуры: {removed}")

        created_points = 0
        created_lines = 0

        for name, lon, lat in NODES:
            await _create_infra_object_record(
                db,
                project_id=project_id,
                data=InfraObjectCreate(name=name, subtype="node", lon=lon, lat=lat),
            )
            created_points += 1

        for name, lon, lat in PADS:
            await _create_infra_object_record(
                db,
                project_id=project_id,
                data=InfraObjectCreate(name=name, subtype="oil_pad", lon=lon, lat=lat),
            )
            created_points += 1

        for name, lon, lat in QUARRIES:
            await _create_infra_object_record(
                db,
                project_id=project_id,
                data=InfraObjectCreate(name=name, subtype="sand_quarry", lon=lon, lat=lat),
            )
            created_points += 1

        for road_name, chain in ROADS:
            coords = [[lon, lat] for lon, lat in chain]
            lon0, lat0 = coords[0]
            await _create_infra_object_record(
                db,
                project_id=project_id,
                data=InfraObjectCreate(
                    name=road_name,
                    subtype="autoroad",
                    lon=lon0,
                    lat=lat0,
                    coordinates=coords,
                ),
            )
            created_lines += 1

        await build_network_from_lines(db, project_id)
        await db.commit()
        print(
            f"Готово: {created_points} точечных объектов, {created_lines} участков дорог, "
            f"топология сети пересчитана (project_id={project_id})."
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Нарисовать демо-сеть на карте проекта")
    parser.add_argument("--list-projects", action="store_true")
    parser.add_argument("--project-id", type=UUID, default=None)
    parser.add_argument("--project-name", type=str, default=None)
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Удалить существующую инфраструктуру проекта перед отрисовкой",
    )
    args = parser.parse_args()

    if args.list_projects:
        asyncio.run(list_projects())
        return

    async def run() -> None:
        async with async_session() as db:
            project = await resolve_project(
                db, project_id=args.project_id, project_name=args.project_name
            )
            pid = project.id
            name = project.name
        print(f"Проект: {name}")
        await draw(pid, replace=args.replace)

    asyncio.run(run())


if __name__ == "__main__":
    main()
