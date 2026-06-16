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
    GS_HEEL_LABEL,
    GS_HEEL_TVD_M,
    GS_TOE_LABEL,
    GS_TOE_TVD_M,
    LINKED_PAD_ID,
    PARENT_ID,
    assert_pad_subtype,
    apply_lateral_inheritance_from_parent,
    is_bottomhole_subtype,
    is_lateral_bottomhole,
    is_main_bottomhole,
    read_bottomhole_role,
    read_gs_heel_id,
    read_linked_pad_id,
    read_parent_id,
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


async def _count_laterals_for_parent(
    db: AsyncSession,
    project_id: UUID,
    parent_id: UUID,
    *,
    exclude_id: UUID | None,
    also_exclude_ids: set[UUID] | None = None,
) -> int:
    result = await db.execute(
        select(InfrastructureObject)
        .join(InfrastructureLayer)
        .where(InfrastructureLayer.project_id == project_id)
    )
    count = 0
    for obj in result.scalars().all():
        if not is_bottomhole_subtype(obj.subtype or ""):
            continue
        if exclude_id is not None and obj.id == exclude_id:
            continue
        if also_exclude_ids and obj.id in also_exclude_ids:
            continue
        props = obj.properties or {}
        if not is_lateral_bottomhole(props):
            continue
        if read_parent_id(props) == parent_id:
            count += 1
    return count


async def resolve_bottomhole_delete_cascade(
    db: AsyncSession,
    project_id: UUID,
    delete_ids: set[UUID],
) -> set[UUID]:
    """Expand delete set with lateral bottomholes and GS toes tied to deleted parents."""
    if not delete_ids:
        return delete_ids

    expanded = set(delete_ids)
    result = await db.execute(
        select(InfrastructureObject)
        .join(InfrastructureLayer)
        .where(InfrastructureLayer.project_id == project_id)
    )
    bottomholes = [
        obj for obj in result.scalars().all() if is_bottomhole_subtype(obj.subtype or "")
    ]
    main_ids = {
        obj.id
        for obj in bottomholes
        if obj.id in expanded and is_main_bottomhole(obj.properties or {})
    }
    heel_ids = {
        obj.id
        for obj in bottomholes
        if obj.id in expanded and (obj.subtype or "").lower().strip() == "well_bottomhole_gs_heel"
    }

    for obj in bottomholes:
        if obj.id in expanded:
            continue
        props = obj.properties or {}
        parent_id = read_parent_id(props)
        if parent_id is not None and parent_id in main_ids:
            expanded.add(obj.id)
            continue
        if (obj.subtype or "").lower().strip() == "well_bottomhole_gs_toe":
            heel_id = read_gs_heel_id(props)
            if heel_id is not None and heel_id in heel_ids:
                expanded.add(obj.id)

    return expanded


async def _validate_bottomhole_role_chain(
    db: AsyncSession,
    *,
    project_id: UUID,
    props: dict,
    obj_id: UUID | None,
) -> dict:
    """Validate main/lateral role and inherit pad/slot from parent for laterals."""
    merged = dict(props)
    role = read_bottomhole_role(merged)

    if role == "main":
        if read_parent_id(merged) is not None:
            raise ValueError("Основной забой не может иметь parent_id.")
        return merged

    parent_id = read_parent_id(merged)
    if parent_id is None:
        raise ValueError("Доп.ствол: укажите родительский основной забой (parent_id).")
    if obj_id is not None and parent_id == obj_id:
        raise ValueError("Доп.ствол: parent_id не может ссылаться на сам объект.")

    parent = await _get_object_in_project(db, project_id, parent_id)
    if parent is None:
        raise ValueError("Доп.ствол: родительский забой не найден в проекте.")
    if not is_bottomhole_subtype(parent.subtype or ""):
        raise ValueError("Доп.ствол: parent_id должен ссылаться на объект-забой.")
    parent_props = parent.properties or {}
    if not is_main_bottomhole(parent_props):
        raise ValueError("Доп.ствол: parent_id должен ссылаться на основной забой (не на другой доп.ствол).")

    merged = apply_lateral_inheritance_from_parent(merged, parent)
    return merged


async def validate_bottomhole_object(
    db: AsyncSession,
    *,
    project_id: UUID,
    subtype: str,
    properties: dict,
    obj_id: UUID | None = None,
    end_lon: float | None = None,
    end_lat: float | None = None,
) -> dict:
    """Validate bottomhole properties; returns normalized properties (may inherit from parent)."""
    st = subtype.lower().strip()
    if st not in BOTTOMHOLE_SUBTYPES:
        return dict(properties or {})

    props = dict(properties or {})
    props = await _validate_bottomhole_role_chain(
        db,
        project_id=project_id,
        props=props,
        obj_id=obj_id,
    )
    linked_pad_id = read_linked_pad_id(props)

    if st == "well_bottomhole_gs_toe":
        heel_id = read_gs_heel_id(props)
        if heel_id is None:
            raise ValueError(f"ГС {GS_TOE_LABEL}: укажите связанный {GS_HEEL_LABEL} (gs_heel_id).")
        heel = await _get_object_in_project(db, project_id, heel_id)
        if heel is None:
            raise ValueError(f"ГС {GS_TOE_LABEL}: объект {GS_HEEL_LABEL} не найден в проекте.")
        if heel.subtype != "well_bottomhole_gs_heel":
            raise ValueError(
                f"ГС {GS_TOE_LABEL}: gs_heel_id должен ссылаться на объект «ГС — {GS_HEEL_LABEL}»."
            )
        if obj_id is not None and heel_id == obj_id:
            raise ValueError(f"ГС {GS_TOE_LABEL}: gs_heel_id не может ссылаться на сам объект.")
        heel_pad = read_linked_pad_id(heel.properties or {})
        if linked_pad_id and heel_pad and linked_pad_id != heel_pad:
            raise ValueError(f"ГС {GS_TOE_LABEL} и {GS_HEEL_LABEL} должны быть привязаны к одному кусту.")
        if linked_pad_id is None and heel_pad is not None:
            props[LINKED_PAD_ID] = str(heel_pad)
        toe_count = await _count_toe_for_heel(db, project_id, heel_id, exclude_id=obj_id)
        if toe_count > 0:
            raise ValueError(f"Для данного {GS_HEEL_LABEL} уже существует {GS_TOE_LABEL}.")
        return props

    if st == "well_bottomhole_gs_heel":
        if linked_pad_id is not None and not is_lateral_bottomhole(props):
            pad = await _get_object_in_project(db, project_id, linked_pad_id)
            if pad is None:
                raise ValueError("Указанный куст (linked_pad_id) не найден.")
            assert_pad_subtype(pad)
        raw_mode = props.get(GS_ENTRY_MODE)
        if raw_mode is not None and raw_mode != "":
            mode = str(raw_mode).lower().strip()
            if mode not in GS_ENTRY_MODES:
                raise ValueError(
                    f"ГС {GS_HEEL_LABEL}: gs_entry_mode должен быть any, {GS_HEEL_LABEL} или {GS_TOE_LABEL}."
                )
        return props

    if st == "well_bottomhole_gs":
        if linked_pad_id is not None and not is_lateral_bottomhole(props):
            pad = await _get_object_in_project(db, project_id, linked_pad_id)
            if pad is None:
                raise ValueError("Указанный куст (linked_pad_id) не найден.")
            assert_pad_subtype(pad)
        raw_mode = props.get(GS_ENTRY_MODE)
        if raw_mode is not None and raw_mode != "":
            mode = str(raw_mode).lower().strip()
            if mode not in GS_ENTRY_MODES:
                raise ValueError(
                    f"ГС: gs_entry_mode должен быть any, {GS_HEEL_LABEL} или {GS_TOE_LABEL}."
                )
        if end_lon is None or end_lat is None:
            raise ValueError(f"ГС: укажите конечную точку ({GS_TOE_LABEL}) линии.")
        for key, label in ((GS_HEEL_TVD_M, GS_HEEL_LABEL), (GS_TOE_TVD_M, GS_TOE_LABEL)):
            raw = props.get(key)
            if raw is None or raw == "":
                continue
            try:
                val = float(raw)
            except (TypeError, ValueError):
                raise ValueError(f"ГС: {label} TVD должна быть числом.") from None
            if val <= 0:
                raise ValueError(f"ГС: {label} TVD должна быть > 0.")
        return props

    if st == "well_bottomhole_nnb":
        if linked_pad_id is None:
            return props
        if not is_lateral_bottomhole(props):
            pad = await _get_object_in_project(db, project_id, linked_pad_id)
            if pad is None:
                raise ValueError("Указанный куст (linked_pad_id) не найден.")
            assert_pad_subtype(pad)
        return props

    return props


async def validate_bottomhole_can_delete(
    db: AsyncSession,
    *,
    project_id: UUID,
    obj: InfrastructureObject,
    delete_ids: set[UUID] | None = None,
) -> None:
    if not is_bottomhole_subtype(obj.subtype or ""):
        return
    props = obj.properties or {}
    if not is_main_bottomhole(props):
        return
    lateral_count = await _count_laterals_for_parent(
        db,
        project_id,
        obj.id,
        exclude_id=None,
        also_exclude_ids=delete_ids,
    )
    if lateral_count > 0:
        raise ValueError(
            "Нельзя удалить основной забой: сначала удалите или перепривяжите связанные доп.стволы."
        )


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
