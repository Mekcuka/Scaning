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
    POIResponse,
)
from app.services.graph_builder import build_network_from_lines
from app.services.infra_create import create_infra_object_record
from app.services.infra_update import update_infra_object_record
from app.services.poi_create import create_poi_for_project
from app.services.serializers import infra_to_public_json, poi_to_response
from app.services.well_trajectory.bottomhole_properties import (
    GS_HEEL_ID,
    LINKED_PAD_ID,
    PARENT_ID,
)

_PAD_SUBTYPES = frozenset({"oil_pad", "gas_pad"})
_BOTTOMHOLE_LINE_SUBTYPES = frozenset({"well_bottomhole_gs"})
_BOTTOMHOLE_PASTE_REF_KEYS = (LINKED_PAD_ID, PARENT_ID, GS_HEEL_ID)
_BOTTOMHOLE_BATCH_TWIN_KEYS = (PARENT_ID, GS_HEEL_ID)


async def _object_in_project(
    db: AsyncSession,
    project_id: UUID,
    object_id: UUID,
    snap_object_cache: dict[UUID, InfrastructureObject],
) -> InfrastructureObject | None:
    cached = snap_object_cache.get(object_id)
    if cached is not None:
        layer = await db.get(InfrastructureLayer, cached.layer_id)
        if layer is not None and layer.project_id == project_id:
            return cached
    obj = await db.get(InfrastructureObject, object_id)
    if obj is None:
        return None
    layer = await db.get(InfrastructureLayer, obj.layer_id)
    if layer is None or layer.project_id != project_id:
        return None
    snap_object_cache[obj.id] = obj
    return obj


async def _resolve_bottomhole_paste_properties(
    db: AsyncSession,
    project_id: UUID,
    properties: dict | None,
    ref_map: dict[str, UUID],
    snap_object_cache: dict[UUID, InfrastructureObject],
) -> dict | None:
    """Remap twins from the same paste batch; drop refs missing in this project."""
    if not properties:
        return properties
    props = dict(properties)

    for key in _BOTTOMHOLE_BATCH_TWIN_KEYS:
        raw = props.get(key)
        if raw is None or raw == "":
            continue
        mapped = ref_map.get(str(raw).strip())
        if mapped is not None:
            props[key] = str(mapped)

    raw_pad = props.get(LINKED_PAD_ID)
    if raw_pad not in (None, ""):
        pad_key = str(raw_pad).strip()
        mapped_pad = ref_map.get(pad_key)
        if mapped_pad is not None:
            twin = snap_object_cache.get(mapped_pad)
            if twin is not None and normalize_infra_subtype(twin.subtype or "") in _PAD_SUBTYPES:
                props[LINKED_PAD_ID] = str(mapped_pad)

    for key in _BOTTOMHOLE_PASTE_REF_KEYS:
        raw = props.get(key)
        if raw is None or raw == "":
            continue
        try:
            uid = UUID(str(raw).strip())
        except ValueError:
            props.pop(key, None)
            continue
        obj = await _object_in_project(db, project_id, uid, snap_object_cache)
        if obj is None:
            props.pop(key, None)
            continue
        if key == LINKED_PAD_ID and normalize_infra_subtype(obj.subtype or "") not in _PAD_SUBTYPES:
            props.pop(key, None)

    return props if props else None


def _infra_point_paste_rank(item) -> tuple[int, str]:
    st = normalize_infra_subtype(item.create.subtype or "")
    props = item.create.properties or {}
    role = str(props.get("well_bottomhole_role") or "main").lower().strip()
    if st in _PAD_SUBTYPES:
        return (0, item.client_ref)
    if st == "well_bottomhole_gs_toe":
        return (3, item.client_ref)
    if role == "lateral":
        return (2, item.client_ref)
    if st.startswith("well_bottomhole"):
        return (1, item.client_ref)
    return (1, item.client_ref)


def _sort_infra_points_for_paste(items: list) -> list:
    return sorted(items, key=_infra_point_paste_rank)


async def _prepare_infra_point_create(
    db: AsyncSession,
    project_id: UUID,
    item,
    ref_map: dict[str, UUID],
    snap_object_cache: dict[UUID, InfrastructureObject],
) -> InfraObjectCreate:
    create = item.create
    props = await _resolve_bottomhole_paste_properties(
        db,
        project_id,
        create.properties,
        ref_map,
        snap_object_cache,
    )
    if props is create.properties:
        return create
    return create.model_copy(update={"properties": props})


async def _prepare_infra_line_create(
    db: AsyncSession,
    project_id: UUID,
    item,
    ref_map: dict[str, UUID],
    snap_object_cache: dict[UUID, InfrastructureObject],
) -> InfraObjectCreate:
    create = item.create
    st = normalize_infra_subtype(create.subtype or "")
    if st not in _BOTTOMHOLE_LINE_SUBTYPES:
        return create
    props = await _resolve_bottomhole_paste_properties(
        db,
        project_id,
        create.properties,
        ref_map,
        snap_object_cache,
    )
    if props is create.properties:
        return create
    return create.model_copy(update={"properties": props})


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
    created_infra: list[dict] = []
    has_lines = len(data.infra_lines) > 0

    for item in data.pois:
        if item.client_ref in ref_map:
            raise ValueError(f"Duplicate client_ref: {item.client_ref}")
        poi = await create_poi_for_project(db, project_id, item.create, commit=False)
        ref_map[item.client_ref] = poi.id
        created_pois.append(poi_to_response(poi))

    for item in _sort_infra_points_for_paste(data.infra_points):
        if item.client_ref in ref_map:
            raise ValueError(f"Duplicate client_ref: {item.client_ref}")
        obj = await create_infra_object_record(
            db,
            project_id=project_id,
            data=_sanitize_infra_create(
                await _prepare_infra_point_create(
                    db, project_id, item, ref_map, snap_object_cache
                ),
                is_line=False,
            ),
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
        created_infra.append(infra_to_public_json(obj))

    for item in data.infra_lines:
        if item.client_ref in ref_map:
            raise ValueError(f"Duplicate client_ref: {item.client_ref}")
        prepared = await _prepare_infra_line_create(
            db, project_id, item, ref_map, snap_object_cache
        )
        create_data = _sanitize_infra_create(
            prepared.model_copy(
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
        created_infra.append(infra_to_public_json(obj))

    network_rebuilt = False
    if has_lines:
        await build_network_from_lines(db, project_id)
        network_rebuilt = True

    return MapBatchPasteResponse(
        created_pois=created_pois,
        created_infra=created_infra,
        network_rebuilt=network_rebuilt,
    )
