"""Load bottomhole objects from DB for pad placement."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import InfrastructureLayer, InfrastructureObject
from app.services.pad_placement.schemas import BottomholeSnapshot
from app.services.well_trajectory.bottomhole_properties import (
    BOTTOMHOLE_SUBTYPES,
    GS_HEEL_ID,
    read_gs_heel_id,
)


async def load_bottomhole_snapshots(
    db: AsyncSession,
    project_id: UUID,
    bottomhole_ids: list[UUID],
) -> tuple[list[BottomholeSnapshot], list[str]]:
    """Fetch selected bottomholes; auto-include GS toes for selected heels."""
    if not bottomhole_ids:
        return [], ["No bottomhole ids provided"]

    id_set = set(bottomhole_ids)
    rows = (
        await db.execute(
            select(InfrastructureObject)
            .join(InfrastructureLayer)
            .where(
                InfrastructureLayer.project_id == project_id,
                InfrastructureObject.id.in_(tuple(id_set)),
            )
        )
    ).scalars().all()

    found = {obj.id: obj for obj in rows}
    warnings: list[str] = []
    for bid in bottomhole_ids:
        if bid not in found:
            warnings.append(f"Bottomhole {bid} not found in project")

    extra_toe_ids: set[UUID] = set()
    for obj in rows:
        st = (obj.subtype or "").lower().strip()
        if st == "well_bottomhole_gs_heel":
            toe = await _find_toe_for_heel(db, project_id, obj.id)
            if toe and toe.id not in id_set:
                extra_toe_ids.add(toe.id)
                found[toe.id] = toe

    for bid in list(id_set):
        obj = found.get(bid)
        if obj is None:
            continue
        st = (obj.subtype or "").lower().strip()
        if st not in BOTTOMHOLE_SUBTYPES:
            warnings.append(f"{obj.name or bid}: not a bottomhole subtype")

    snapshots: list[BottomholeSnapshot] = []
    seen: set[UUID] = set()
    for bid in bottomhole_ids:
        obj = found.get(bid)
        if obj is None or obj.id in seen:
            continue
        snapshots.append(_to_snapshot(obj))
        seen.add(obj.id)
    for toe_id in extra_toe_ids:
        if toe_id in seen:
            continue
        obj = found.get(toe_id)
        if obj:
            snapshots.append(_to_snapshot(obj))
            seen.add(toe_id)

    return snapshots, warnings


async def fetch_existing_pads(
    db: AsyncSession,
    project_id: UUID,
) -> list[InfrastructureObject]:
    from app.subtype_manifest import PAD_CLUSTER_SUBTYPES

    result = await db.execute(
        select(InfrastructureObject)
        .join(InfrastructureLayer)
        .where(
            InfrastructureLayer.project_id == project_id,
            InfrastructureObject.subtype.in_(tuple(PAD_CLUSTER_SUBTYPES)),
        )
    )
    return list(result.scalars().all())


async def _find_toe_for_heel(
    db: AsyncSession,
    project_id: UUID,
    heel_id: UUID,
) -> InfrastructureObject | None:
    result = await db.execute(
        select(InfrastructureObject)
        .join(InfrastructureLayer)
        .where(
            InfrastructureLayer.project_id == project_id,
            InfrastructureObject.subtype == "well_bottomhole_gs_toe",
        )
    )
    for obj in result.scalars().all():
        props = obj.properties or {}
        if read_gs_heel_id(props) == heel_id:
            return obj
        if props.get(GS_HEEL_ID) == str(heel_id):
            return obj
    return None


def _to_snapshot(obj: InfrastructureObject) -> BottomholeSnapshot:
    return BottomholeSnapshot(
        id=obj.id,
        subtype=obj.subtype or "",
        name=obj.name or "",
        longitude=float(obj.longitude),
        latitude=float(obj.latitude),
        properties=dict(obj.properties or {}),
    )
