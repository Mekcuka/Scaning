"""Validation for well bottomhole infrastructure objects."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import InfrastructureLayer, InfrastructureObject
from app.services.well_trajectory.bottomhole_properties import (
    BOTTOMHOLE_SUBTYPES,
    GS_ENTRY_MODE,
    GS_ENTRY_MODES,
    GS_HEEL_ID,
    GS_HEEL_TVD_M,
    GS_TOE_TVD_M,
    LINKED_PAD_ID,
    assert_pad_subtype,
    is_bottomhole_subtype,
    read_gs_heel_id,
    read_linked_pad_id,
)
from app.subtype_manifest import SUBTYPE_LABELS


async def _get_object_in_project(
    db: AsyncSession,
    project_id: UUID,
    object_id: UUID,
) -> InfrastructureObject | None:
    result = await db.execute(
        select(InfrastructureObject)
        .join(InfrastructureLayer)
        .where(
            InfrastructureLayer.project_id == project_id,
            InfrastructureObject.id == object_id,
        )
    )
    return result.scalar_one_or_none()


async def validate_bottomhole_object(
    db: AsyncSession,
    *,
    project_id: UUID,
    subtype: str,
    properties: dict,
    obj_id: UUID | None = None,
    end_lon: float | None = None,
    end_lat: float | None = None,
) -> None:
    st = subtype.lower().strip()
    if st not in BOTTOMHOLE_SUBTYPES:
        return

    props = dict(properties or {})
    linked_pad_id = read_linked_pad_id(props)

    if st == "well_bottomhole_gs_toe":
        heel_id = read_gs_heel_id(props)
        if heel_id is None:
            raise ValueError("ГС toe: укажите связанный heel (gs_heel_id).")
        heel = await _get_object_in_project(db, project_id, heel_id)
        if heel is None:
            raise ValueError("ГС toe: объект heel не найден в проекте.")
        if heel.subtype != "well_bottomhole_gs_heel":
            raise ValueError("ГС toe: gs_heel_id должен ссылаться на объект «ГС — heel».")
        if obj_id is not None and heel_id == obj_id:
            raise ValueError("ГС toe: gs_heel_id не может ссылаться на сам объект.")
        heel_pad = read_linked_pad_id(heel.properties or {})
        if linked_pad_id and heel_pad and linked_pad_id != heel_pad:
            raise ValueError("ГС toe и heel должны быть привязаны к одному кусту.")
        if linked_pad_id is None and heel_pad is not None:
            props[LINKED_PAD_ID] = str(heel_pad)
        toe_count = await _count_toe_for_heel(db, project_id, heel_id, exclude_id=obj_id)
        if toe_count > 0:
            raise ValueError("Для данного heel уже существует toe.")
        return

    if st == "well_bottomhole_gs_heel":
        if linked_pad_id is not None:
            pad = await _get_object_in_project(db, project_id, linked_pad_id)
            if pad is None:
                raise ValueError("Указанный куст (linked_pad_id) не найден.")
            assert_pad_subtype(pad)
        raw_mode = props.get(GS_ENTRY_MODE)
        if raw_mode is not None and raw_mode != "":
            mode = str(raw_mode).lower().strip()
            if mode not in GS_ENTRY_MODES:
                raise ValueError("ГС heel: gs_entry_mode должен быть any, heel или toe.")
        return

    if st == "well_bottomhole_gs":
        if linked_pad_id is not None:
            pad = await _get_object_in_project(db, project_id, linked_pad_id)
            if pad is None:
                raise ValueError("Указанный куст (linked_pad_id) не найден.")
            assert_pad_subtype(pad)
        raw_mode = props.get(GS_ENTRY_MODE)
        if raw_mode is not None and raw_mode != "":
            mode = str(raw_mode).lower().strip()
            if mode not in GS_ENTRY_MODES:
                raise ValueError("ГС: gs_entry_mode должен быть any, heel или toe.")
        if end_lon is None or end_lat is None:
            raise ValueError("ГС: укажите конечную точку (toe) линии.")
        for key, label in ((GS_HEEL_TVD_M, "heel"), (GS_TOE_TVD_M, "toe")):
            raw = props.get(key)
            if raw is None or raw == "":
                continue
            try:
                val = float(raw)
            except (TypeError, ValueError):
                raise ValueError(f"ГС: {label} TVD должна быть числом.") from None
            if val <= 0:
                raise ValueError(f"ГС: {label} TVD должна быть > 0.")
        return

    if st == "well_bottomhole_nnb":
        if linked_pad_id is None:
            return
        pad = await _get_object_in_project(db, project_id, linked_pad_id)
        if pad is None:
            raise ValueError("Указанный куст (linked_pad_id) не найден.")
        assert_pad_subtype(pad)


async def _count_toe_for_heel(
    db: AsyncSession,
    project_id: UUID,
    heel_id: UUID,
    *,
    exclude_id: UUID | None,
) -> int:
    result = await db.execute(
        select(InfrastructureObject)
        .join(InfrastructureLayer)
        .where(
            InfrastructureLayer.project_id == project_id,
            InfrastructureObject.subtype == "well_bottomhole_gs_toe",
        )
    )
    count = 0
    for obj in result.scalars().all():
        if exclude_id is not None and obj.id == exclude_id:
            continue
        if read_gs_heel_id(obj.properties or {}) == heel_id:
            count += 1
    return count


def validate_bottomhole_subtype_only(subtype: str) -> None:
    st = subtype.lower().strip()
    if st in BOTTOMHOLE_SUBTYPES:
        label = SUBTYPE_LABELS.get(st, st)
        raise ValueError(
            f"Подтип «{label}»: используйте инструмент «Забой скважины» на панели рисования карты."
        )
