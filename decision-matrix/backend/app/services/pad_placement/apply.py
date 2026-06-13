"""Apply a cached pad placement variant to the project DB."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import InfrastructureLayer, InfrastructureObject
from app.schemas import InfraObjectCreate
from app.services.infra_create import create_infra_object_record
from app.services.pad_earthwork.earthwork_store import store_sketch, store_wells_local
from app.services.pad_earthwork.properties import PAD_LENGTH_M, PAD_ROTATION_DEG, PAD_WIDTH_M, PAD_WELL_COUNT
from app.services.pad_earthwork.schemas import PlanPolygonSketchIn, PlanRectangleSketchIn
from app.services.pad_placement.evaluate import params_to_pad_properties
from app.services.pad_placement.result_cache import get
from app.services.pad_placement.schemas import (
    BottomholeSnapshot,
    PadPlacementApplyResponse,
    PadPlacementParams,
    PlacementVariantOut,
)
from app.services.well_trajectory.bottomhole_properties import GS_HEEL_ID, LINKED_PAD_ID, WELL_INDEX
from app.services.well_trajectory.trajectory_store import store_computed_at, store_trajectories_json


class PadPlacementApplyError(Exception):
    def __init__(self, detail: str, *, status_code: int = 400) -> None:
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


async def apply_variant(
    db: AsyncSession,
    project_id: UUID,
    *,
    request_id: UUID,
    variant_index: int,
    layer_id: UUID | None = None,
) -> PadPlacementApplyResponse:
    entry = get(request_id)
    if entry is None:
        raise PadPlacementApplyError("Compute result expired or not found", status_code=404)

    variant = _find_variant(entry.response, variant_index)
    if variant is None:
        raise PadPlacementApplyError(f"Variant index {variant_index} not found", status_code=404)
    if variant.invalid:
        raise PadPlacementApplyError("Cannot apply invalid variant", status_code=400)

    snapshots: list[BottomholeSnapshot] = list(entry.snapshots or [])
    snapshots_by_id = {s.id: s for s in snapshots}
    subtype = entry.subtype or "oil_pad"
    params: PadPlacementParams = entry.params or PadPlacementParams()
    warnings: list[str] = []
    created_pad_ids: list[UUID] = []
    updated_bottomhole_ids: list[UUID] = []

    for pad_index, pad_cand in enumerate(variant.pads):
        well_count = len(pad_cand.wells_local) or len(pad_cand.trajectories)
        props = params_to_pad_properties(params, well_count)
        props[PAD_WELL_COUNT] = well_count
        if pad_cand.length_m is not None:
            props[PAD_LENGTH_M] = pad_cand.length_m
        if pad_cand.width_m is not None:
            props[PAD_WIDTH_M] = pad_cand.width_m
        if pad_cand.rotation_deg is not None:
            props[PAD_ROTATION_DEG] = pad_cand.rotation_deg
        if pad_cand.sketch:
            props = store_sketch(props, _sketch_from_dict(pad_cand.sketch))
        if pad_cand.wells_local:
            from app.services.pad_earthwork.schemas import PlanVertexIn

            props = store_wells_local(
                props,
                [PlanVertexIn.model_validate(w) for w in pad_cand.wells_local],
            )
        props = store_trajectories_json(props, pad_cand.trajectories)
        props = store_computed_at(props)

        create_data = InfraObjectCreate(
            name=f"Куст {pad_index + 1}",
            subtype=subtype,
            lon=pad_cand.center_longitude,
            lat=pad_cand.center_latitude,
            layer_id=layer_id,
            properties=props,
        )
        obj = await create_infra_object_record(
            db,
            project_id=project_id,
            data=create_data,
            rebuild_network=False,
        )
        created_pad_ids.append(obj.id)

        for well_index, logical_id in enumerate(pad_cand.assigned_logical_ids):
            for bh_id in _bottomhole_ids_for_logical(logical_id, snapshots_by_id):
                if await _link_bottomhole(
                    db,
                    project_id=project_id,
                    bottomhole_id=bh_id,
                    pad_id=obj.id,
                    well_index=well_index,
                ):
                    updated_bottomhole_ids.append(bh_id)

    await db.commit()
    return PadPlacementApplyResponse(
        created_pad_ids=created_pad_ids,
        updated_bottomhole_ids=updated_bottomhole_ids,
        warnings=warnings,
        applied_at=datetime.now(UTC),
    )


def _find_variant(response, variant_index: int) -> PlacementVariantOut | None:
    for v in response.variants:
        if v.variant_index == variant_index:
            return v
    if 0 <= variant_index < len(response.variants):
        return response.variants[variant_index]
    return None


def _sketch_from_dict(raw: dict):
    if raw.get("kind") == "plan_polygon":
        return PlanPolygonSketchIn.model_validate(raw)
    return PlanRectangleSketchIn.model_validate(raw)


def _bottomhole_ids_for_logical(
    logical_id: str,
    snapshots_by_id: dict[UUID, BottomholeSnapshot],
) -> list[UUID]:
    if logical_id.startswith("nnb:"):
        try:
            uid = UUID(logical_id[4:])
        except ValueError:
            return []
        return [uid] if uid in snapshots_by_id else []

    if logical_id.startswith("gs:"):
        try:
            heel_id = UUID(logical_id[3:])
        except ValueError:
            return []
        ids: list[UUID] = []
        if heel_id in snapshots_by_id:
            ids.append(heel_id)
        for snap in snapshots_by_id.values():
            if snap.properties.get(GS_HEEL_ID) == str(heel_id):
                ids.append(snap.id)
        return ids
    return []


async def _link_bottomhole(
    db: AsyncSession,
    *,
    project_id: UUID,
    bottomhole_id: UUID,
    pad_id: UUID,
    well_index: int,
) -> bool:
    result = await db.execute(
        select(InfrastructureObject)
        .join(InfrastructureLayer)
        .where(
            InfrastructureLayer.project_id == project_id,
            InfrastructureObject.id == bottomhole_id,
        )
    )
    obj = result.scalar_one_or_none()
    if obj is None:
        return False
    props = dict(obj.properties or {})
    props[LINKED_PAD_ID] = str(pad_id)
    props[WELL_INDEX] = well_index
    obj.properties = props
    await db.flush()
    return True
