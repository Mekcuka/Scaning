"""Atomic clipboard paste: POIs, infra points, then lines with twin snap refs."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.geo.constants import LINE_SUBTYPES, normalize_infra_subtype
from app.models import InfrastructureLayer, InfrastructureObject, Project, User
from app.schemas import (
    InfraObjectCreate,
    InfraObjectUpdate,
    MapBatchPasteRequest,
    MapBatchPasteResponse,
    InfraObjectResponse,
    POIResponse,
)
from app.services.graph_builder import build_network_from_lines
from app.services.infra_create import create_infra_object_record
from app.services.infra_update import update_infra_object_record
from app.services.poi_create import create_poi_for_project
from app.services.serializers import infra_to_response, poi_to_response


def _json_safe_properties(properties: dict | None, *, is_line: bool) -> dict:
    if not properties:
        return {}
    safe: dict = {}
    for key, value in properties.items():
        if value is None:
            continue
        if key in {"render_3d_effective", "id", "category"}:
            continue
        if not is_line and key == "coordinates":
            continue
        safe[key] = value
    return safe


def _sanitize_infra_create(create: InfraObjectCreate, *, is_line: bool) -> InfraObjectCreate:
    return create.model_copy(
        update={"properties": _json_safe_properties(create.properties, is_line=is_line)}
    )


async def _resolve_snap_ref(
    db: AsyncSession,
    project_id: UUID,
    ref_map: dict[str, UUID],
    ref: str | None,
    snap_object_cache: dict[UUID, InfrastructureObject],
) -> UUID | None:
    if not ref or not ref.strip():
        return None
    key = ref.strip()
    resolved = ref_map.get(key)
    if resolved is not None:
        return resolved
    try:
        uid = UUID(key)
    except ValueError as exc:
        raise ValueError(f"Unknown snap reference: {ref}") from exc
    cached = snap_object_cache.get(uid)
    if cached is not None:
        return uid
    obj = await db.get(InfrastructureObject, uid)
    if obj is not None:
        layer = await db.get(InfrastructureLayer, obj.layer_id)
        if layer is not None and layer.project_id == project_id:
            snap_object_cache[uid] = obj
            return uid
    raise ValueError(f"Unknown snap reference: {ref}")


async def apply_map_batch_paste(
    db: AsyncSession,
    *,
    project: Project,
    project_id: UUID,
    user: User,
    data: MapBatchPasteRequest,
) -> MapBatchPasteResponse:
    ref_map: dict[str, UUID] = {}
    snap_object_cache: dict[UUID, InfrastructureObject] = {}
    created_pois: list[POIResponse] = []
    created_infra: list[InfraObjectResponse] = []
    has_lines = len(data.infra_lines) > 0

    for item in data.pois:
        if item.client_ref in ref_map:
            raise ValueError(f"Duplicate client_ref: {item.client_ref}")
        poi = await create_poi_for_project(db, project_id, item.create, commit=False)
        ref_map[item.client_ref] = poi.id
        created_pois.append(poi_to_response(poi))

    for item in data.infra_points:
        if item.client_ref in ref_map:
            raise ValueError(f"Duplicate client_ref: {item.client_ref}")
        obj = await create_infra_object_record(
            db,
            project_id=project_id,
            data=_sanitize_infra_create(item.create, is_line=False),
            rebuild_network=False,
            snap_object_cache=snap_object_cache,
        )
        target = item.target_subtype
        if target:
            target_st = normalize_infra_subtype(target)
            if target_st != normalize_infra_subtype(obj.subtype):
                obj = await update_infra_object_record(
                    db,
                    project=project,
                    project_id=project_id,
                    user=user,
                    obj=obj,
                    data=InfraObjectUpdate(subtype=target_st),
                )
        ref_map[item.client_ref] = obj.id
        snap_object_cache[obj.id] = obj
        created_infra.append(infra_to_response(obj))

    for item in data.infra_lines:
        if item.client_ref in ref_map:
            raise ValueError(f"Duplicate client_ref: {item.client_ref}")
        create_data = _sanitize_infra_create(
            item.create.model_copy(
                update={
                    "line_snap_start_object_id": await _resolve_snap_ref(
                        db,
                        project_id,
                        ref_map,
                        item.snap_start_ref,
                        snap_object_cache,
                    ),
                    "line_snap_finish_object_id": await _resolve_snap_ref(
                        db,
                        project_id,
                        ref_map,
                        item.snap_finish_ref,
                        snap_object_cache,
                    ),
                    "line_preserve_geometry": True,
                }
            ),
            is_line=True,
        )
        subtype = normalize_infra_subtype(create_data.subtype)
        if subtype not in LINE_SUBTYPES:
            raise ValueError(f"Invalid line subtype: {create_data.subtype}")
        obj = await create_infra_object_record(
            db,
            project_id=project_id,
            data=create_data,
            rebuild_network=False,
            snap_object_cache=snap_object_cache,
        )
        ref_map[item.client_ref] = obj.id
        snap_object_cache[obj.id] = obj
        created_infra.append(infra_to_response(obj))

    network_rebuilt = False
    if has_lines:
        await build_network_from_lines(db, project_id)
        network_rebuilt = True

    return MapBatchPasteResponse(
        created_pois=created_pois,
        created_infra=created_infra,
        network_rebuilt=network_rebuilt,
    )
