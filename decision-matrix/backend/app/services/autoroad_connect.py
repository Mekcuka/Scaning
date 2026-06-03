"""Connect selected point infrastructure objects via autoroad (MST on road network)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import InfrastructureLayer, InfrastructureObject
from app.schemas import InfraObjectCreate
from app.services.graph_builder import build_network_from_lines
from app.services.line_split import build_line_split_plan

MAX_CONNECT_OBJECTS = 50
NODE_DEDUP_KM = 0.05


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
    snap_start_object_id: UUID | None = None
    snap_finish_object_id: UUID | None = None
    snap_start_terminal_id: UUID | None = None
    snap_finish_terminal_id: UUID | None = None
    kind: str = "connector"  # connector | link | network_tie | bridge (legacy)


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
    terminal_id: UUID | None = None


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


async def build_autoroad_connect_plan(
    db: AsyncSession,
    project_id: UUID,
    object_ids: list[UUID],
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

    req = await build_plan_request(db, project_id, object_ids)
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
    from app.api.v1.map import _create_infra_object_record

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

    access_node_by_terminal: dict[UUID, InfrastructureObject] = {}

    for pn in plan.new_nodes:
        key = _coord_key(pn.lon, pn.lat)
        if key in node_by_key:
            if pn.terminal_id is not None:
                access_node_by_terminal[pn.terminal_id] = node_by_key[key]
            continue
        n_node += 1
        name = (
            f"Узел_доступа_{n_node}"
            if pn.reason == "terminal_access"
            else f"Узел_{n_node}"
        )
        data = InfraObjectCreate(
            name=name,
            subtype="node",
            lon=pn.lon,
            lat=pn.lat,
            layer_id=layer.id,
        )
        obj = await _create_infra_object_record(db, project_id=project_id, data=data)
        node_by_key[key] = obj
        created_nodes.append(obj)
        if pn.terminal_id is not None:
            access_node_by_terminal[pn.terminal_id] = obj

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
            node_obj = await _create_infra_object_record(
                db,
                project_id=project_id,
                data=InfraObjectCreate(
                    name=f"Узел_{n_node}",
                    subtype="node",
                    lon=sp.split_lon,
                    lat=sp.split_lat,
                    layer_id=layer.id,
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
        second = await _create_infra_object_record(db, project_id=project_id, data=second_data)
        created_lines.append(second)
        split_done.add(sp.line_id)

    for pl in plan.new_lines:
        n_road += 1
        start_id = pl.snap_start_object_id
        if pl.snap_start_terminal_id is not None:
            access = access_node_by_terminal.get(pl.snap_start_terminal_id)
            if access is not None:
                start_id = access.id

        finish_id = pl.snap_finish_object_id
        if pl.snap_finish_terminal_id is not None:
            access = access_node_by_terminal.get(pl.snap_finish_terminal_id)
            if access is not None:
                finish_id = access.id
        else:
            sk = _coord_key(pl.end_lon, pl.end_lat)
            if sk in node_by_key:
                finish_id = node_by_key[sk].id

        data = InfraObjectCreate(
            name=f"Автодорога_{n_road}",
            subtype="autoroad",
            lon=pl.start_lon,
            lat=pl.start_lat,
            end_lon=pl.end_lon,
            end_lat=pl.end_lat,
            layer_id=layer.id,
            line_snap_start_object_id=start_id,
            line_snap_finish_object_id=finish_id,
        )
        obj = await _create_infra_object_record(db, project_id=project_id, data=data)
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
) -> dict[str, Any]:
    plan = await build_autoroad_connect_plan(db, project_id, object_ids)
    out = plan.to_response_dict()
    if dry_run:
        out["dry_run"] = True
        return out
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
