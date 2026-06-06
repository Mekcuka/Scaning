"""Connect selected point infrastructure objects via autoroad (MST on road network)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.geo.constants import MAX_AUTOROAD_NETWORK_OBJECTS
from app.models import InfrastructureLayer, InfrastructureObject
from app.schemas import InfraObjectCreate
from app.services.graph_builder import build_network_from_lines
from app.services.line_split import build_line_split_plan

MAX_CONNECT_OBJECTS = MAX_AUTOROAD_NETWORK_OBJECTS
NODE_DEDUP_KM = 0.05
AUTOROAD_NETWORK_SOURCE = "autoroad_network"
NETWORK_REBUILD_SUBTYPES = frozenset({"autoroad", "node"})


@dataclass
class TerminalSnap:
    object_id: UUID
    name: str
    lon: float
    lat: float
    graph_node_id: UUID | None = None
    snap_lon: float | None = None
    snap_lat: float | None = None
    warning: str | None = None


@dataclass
class PlannedLine:
    start_lon: float
    start_lat: float
    end_lon: float
    end_lat: float
    coordinates: list[list[float]] | None = None
    snap_start_object_id: UUID | None = None
    snap_finish_object_id: UUID | None = None
    kind: str = "connector"  # connector | link | bridge (legacy)


@dataclass
class PlannedSplit:
    line_id: UUID
    segment_index: int
    split_lon: float
    split_lat: float


@dataclass
class PlannedNode:
    lon: float
    lat: float
    reason: str = "intersection"


@dataclass
class AutoroadConnectPlan:
    terminals: list[TerminalSnap] = field(default_factory=list)
    new_lines: list[PlannedLine] = field(default_factory=list)
    splits: list[PlannedSplit] = field(default_factory=list)
    new_nodes: list[PlannedNode] = field(default_factory=list)
    used_existing_edge_ids: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    total_new_km: float = 0.0

    def to_response_dict(self) -> dict[str, Any]:
        preview_features: list[dict[str, Any]] = []
        for ln in self.new_lines:
            preview_features.append(
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [
                            [ln.start_lon, ln.start_lat],
                            [ln.end_lon, ln.end_lat],
                        ],
                    },
                    "properties": {"kind": ln.kind},
                }
            )
        for nd in self.new_nodes:
            preview_features.append(
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [nd.lon, nd.lat]},
                    "properties": {"reason": nd.reason},
                }
            )
        return {
            "terminals": [
                {
                    "object_id": str(t.object_id),
                    "name": t.name,
                    "graph_node_id": str(t.graph_node_id) if t.graph_node_id else None,
                    "warning": t.warning,
                }
                for t in self.terminals
            ],
            "new_line_count": len(self.new_lines),
            "new_node_count": len(self.new_nodes),
            "split_count": len(self.splits),
            "used_existing_edge_ids": self.used_existing_edge_ids,
            "total_new_km": round(self.total_new_km, 3),
            "warnings": self.warnings,
            "preview": {"type": "FeatureCollection", "features": preview_features},
        }


def _coord_key(lon: float, lat: float) -> tuple[int, int]:
    return (round(lon * 1e5), round(lat * 1e5))


async def clear_network_for_rebuild(
    db: AsyncSession,
    project_id: UUID,
    preserve_terminal_ids: set[UUID],
) -> int:
    """Remove autoroad/node objects before a full autoroad-network rebuild."""
    from app.services.infra_delete import delete_infra_objects_batch

    rows = (
        await db.execute(
            select(InfrastructureObject.id, InfrastructureObject.subtype)
            .join(InfrastructureLayer)
            .where(
                InfrastructureLayer.project_id == project_id,
                InfrastructureObject.subtype.in_(NETWORK_REBUILD_SUBTYPES),
            )
        )
    ).all()
    delete_ids = {
        oid
        for oid, subtype in rows
        if oid not in preserve_terminal_ids and subtype in NETWORK_REBUILD_SUBTYPES
    }
    if not delete_ids:
        return 0
    deleted, _ = await delete_infra_objects_batch(db, project_id, delete_ids)
    return deleted


async def build_autoroad_connect_plan(
    db: AsyncSession,
    project_id: UUID,
    object_ids: list[UUID],
    *,
    full_network_rebuild: bool = False,
) -> AutoroadConnectPlan:
    from app.geo.constants import NODE_CLUSTER_SUBTYPES
    from app.services.autoroad_network.bridge import plan_response_to_connect_plan
    from app.services.autoroad_network.client import compute_network_plan
    from app.services.autoroad_network.snapshot import build_plan_request

    plan = AutoroadConnectPlan()
    if len(object_ids) < 2:
        plan.warnings.append("need_at_least_two_objects")
        return plan
    if len(object_ids) > MAX_CONNECT_OBJECTS:
        plan.warnings.append(f"too_many_objects_max_{MAX_CONNECT_OBJECTS}")
        return plan

    points_q = (
        select(InfrastructureObject)
        .join(InfrastructureLayer)
        .where(
            InfrastructureLayer.project_id == project_id,
            InfrastructureObject.id.in_(object_ids),
        )
    )
    rows = (await db.execute(points_q)).scalars().all()
    for obj in rows:
        if obj.subtype in NODE_CLUSTER_SUBTYPES:
            plan.warnings.append(f"excluded_terminal_subtype:{obj.subtype}")
            return plan

    req = await build_plan_request(
        db,
        project_id,
        object_ids,
        use_existing_autoroads=not full_network_rebuild,
    )
    if len(req.terminals) < 2:
        plan.warnings.append("need_at_least_two_objects")
        missing = [str(i) for i in object_ids if i not in {t.id for t in req.terminals}]
        if missing:
            plan.warnings.append(f"invalid_or_line_objects:{','.join(missing[:5])}")
        return plan

    resp = await compute_network_plan(req)
    coords = {t.id: (t.lon, t.lat) for t in req.terminals}
    return plan_response_to_connect_plan(resp, coords_by_id=coords)


async def apply_autoroad_connect_plan(
    db: AsyncSession,
    project_id: UUID,
    plan: AutoroadConnectPlan,
) -> dict[str, Any]:
    from app.services.infra_create import create_infra_object_record

    created_nodes: list[InfraObject] = []
    created_lines: list[InfraObject] = []
    node_by_key: dict[tuple[int, int], InfrastructureObject] = {}

    layer = await db.scalar(
        select(InfrastructureLayer)
        .where(InfrastructureLayer.project_id == project_id)
        .order_by(InfrastructureLayer.sort_order)
        .limit(1)
    )
    if not layer:
        layer = InfrastructureLayer(
            project_id=project_id,
            name="Инфраструктура",
            layer_type="infrastructure",
            source_type="manual",
        )
        db.add(layer)
        await db.flush()

    n_node = len(
        (
            await db.execute(
                select(InfrastructureObject).join(InfrastructureLayer).where(
                    InfrastructureLayer.project_id == project_id,
                    InfrastructureObject.subtype == "node",
                )
            )
        ).all()
    )
    n_road = len(
        (
            await db.execute(
                select(InfrastructureObject).join(InfrastructureLayer).where(
                    InfrastructureLayer.project_id == project_id,
                    InfrastructureObject.subtype == "autoroad",
                )
            )
        ).all()
    )

    existing_nodes = (
        await db.execute(
            select(InfrastructureObject)
            .join(InfrastructureLayer)
            .where(
                InfrastructureLayer.project_id == project_id,
                InfrastructureObject.subtype == "node",
            )
        )
    ).scalars().all()
    for node_obj in existing_nodes:
        node_by_key[_coord_key(float(node_obj.longitude), float(node_obj.latitude))] = node_obj

    network_props = {"source": AUTOROAD_NETWORK_SOURCE}

    for pn in plan.new_nodes:
        key = _coord_key(pn.lon, pn.lat)
        if key in node_by_key:
            continue
        n_node += 1
        obj = await create_infra_object_record(
            db,
            project_id=project_id,
            data=InfraObjectCreate(
                name=f"Узел_{n_node}",
                subtype="node",
                lon=pn.lon,
                lat=pn.lat,
                layer_id=layer.id,
                properties=dict(network_props),
            ),
        )
        node_by_key[key] = obj
        created_nodes.append(obj)

    split_done: set[UUID] = set()
    for sp in plan.splits:
        if sp.line_id in split_done:
            continue
        line = await db.get(InfrastructureObject, sp.line_id)
        if not line:
            continue
        key = _coord_key(sp.split_lon, sp.split_lat)
        node_obj = node_by_key.get(key)
        if node_obj is None:
            n_node += 1
            node_obj = await create_infra_object_record(
                db,
                project_id=project_id,
                data=InfraObjectCreate(
                    name=f"Узел_{n_node}",
                    subtype="node",
                    lon=sp.split_lon,
                    lat=sp.split_lat,
                    layer_id=layer.id,
                    properties=dict(network_props),
                ),
            )
            node_by_key[key] = node_obj
            created_nodes.append(node_obj)

        split_plan = build_line_split_plan(
            line,
            sp.segment_index,
            sp.split_lon,
            sp.split_lat,
            f"{line.name} (2)",
        )
        if not split_plan:
            continue
        from app.geo.geometry_utils import build_infra_geometry, line_coordinates_for_storage

        props = dict(line.properties or {})
        props["coordinates"] = split_plan.first_coords
        line.name = line.name
        line.longitude = split_plan.first_coords[0][0]
        line.latitude = split_plan.first_coords[0][1]
        line.end_longitude = split_plan.first_coords[-1][0]
        line.end_latitude = split_plan.first_coords[-1][1]
        line.properties = props
        line.geometry = build_infra_geometry(
            line.subtype,
            line.longitude,
            line.latitude,
            end_lon=line.end_longitude,
            end_lat=line.end_latitude,
            coordinates=split_plan.first_coords,
        )
        second_data = InfraObjectCreate(
            name=split_plan.second_name,
            subtype=line.subtype,
            lon=split_plan.second_coords[0][0],
            lat=split_plan.second_coords[0][1],
            end_lon=split_plan.second_coords[-1][0],
            end_lat=split_plan.second_coords[-1][1],
            coordinates=split_plan.second_coords,
            layer_id=line.layer_id,
            properties={k: v for k, v in props.items() if k != "coordinates"},
        )
        second = await create_infra_object_record(db, project_id=project_id, data=second_data)
        created_lines.append(second)
        split_done.add(sp.line_id)

    for pl in plan.new_lines:
        n_road += 1
        start_id = pl.snap_start_object_id
        finish_id = pl.snap_finish_object_id
        if start_id is None:
            sk = _coord_key(pl.start_lon, pl.start_lat)
            if sk in node_by_key:
                start_id = node_by_key[sk].id
        if finish_id is None:
            sk = _coord_key(pl.end_lon, pl.end_lat)
            if sk in node_by_key:
                finish_id = node_by_key[sk].id

        line_coords = (
            pl.coordinates
            if pl.coordinates and len(pl.coordinates) >= 2
            else [[pl.start_lon, pl.start_lat], [pl.end_lon, pl.end_lat]]
        )
        data = InfraObjectCreate(
            name=f"Автодорога_{n_road}",
            subtype="autoroad",
            lon=line_coords[0][0],
            lat=line_coords[0][1],
            end_lon=line_coords[-1][0],
            end_lat=line_coords[-1][1],
            coordinates=line_coords,
            layer_id=layer.id,
            properties=dict(network_props),
            line_snap_start_object_id=start_id,
            line_snap_finish_object_id=finish_id,
            line_preserve_geometry=True,
        )
        obj = await create_infra_object_record(db, project_id=project_id, data=data)
        created_lines.append(obj)

    await build_network_from_lines(db, project_id)

    return {
        "created_node_ids": [str(o.id) for o in created_nodes],
        "created_line_ids": [str(o.id) for o in created_lines],
        "created_nodes": len(created_nodes),
        "created_lines": len(created_lines),
    }


async def run_autoroad_connect(
    db: AsyncSession,
    project_id: UUID,
    object_ids: list[UUID],
    *,
    dry_run: bool = False,
    full_network_rebuild: bool = False,
) -> dict[str, Any]:
    from app.services.autoroad_network.pipeline import preview_legacy_dict

    if dry_run:
        out = await preview_legacy_dict(
            db,
            project_id,
            object_ids,
            full_network_rebuild=full_network_rebuild,
        )
        out["dry_run"] = True
        return out

    preserve = set(object_ids)
    if full_network_rebuild:
        await clear_network_for_rebuild(db, project_id, preserve)
    plan = await build_autoroad_connect_plan(
        db,
        project_id,
        object_ids,
        full_network_rebuild=full_network_rebuild,
    )
    out = plan.to_response_dict()
    if (
        not plan.new_lines
        and not plan.used_existing_edge_ids
        and "need_at_least_two_objects" not in plan.warnings
        and not any(w.startswith("excluded_") for w in plan.warnings)
    ):
        raise ValueError("Не удалось построить соединение между выбранными объектами")
    applied = await apply_autoroad_connect_plan(db, project_id, plan)
    out.update(applied)
    out["dry_run"] = False
    return out
