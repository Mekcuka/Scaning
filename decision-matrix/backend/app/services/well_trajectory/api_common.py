"""Shared helpers for well trajectory HTTP handlers."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.map_deps import get_infra_object, require_infra_write
from app.models import InfrastructureObject, Project, User
from app.models.enums import AccessLevel, WriteScope
from app.schemas import InfraObjectUpdate
from app.services.infra_update import update_infra_object_record
from app.services.project_access import resolve_project
from app.services.well_trajectory.import_service import ImportOptions
from app.services.well_trajectory.pad_access import assert_pad_object
from app.services.well_trajectory.properties import (
    PAD_PYWELLGEO_TREES_JSON,
    WELL_TRAJECTORY_CLEARANCE_COMPUTED_AT,
    WELL_TRAJECTORY_CLEARANCE_PAIRS_JSON,
)
from app.services.well_trajectory.trajectory_store import finalize_pad_trajectories


def _props_for_infra_merge(
    old_props: dict[str, Any] | None,
    finalized: dict[str, Any],
) -> dict[str, Any]:
    """Mark removed pad-level keys as null so infra property merge drops them."""
    patch = dict(finalized)
    old = old_props or {}
    for key in (
        WELL_TRAJECTORY_CLEARANCE_PAIRS_JSON,
        WELL_TRAJECTORY_CLEARANCE_COMPUTED_AT,
        PAD_PYWELLGEO_TREES_JSON,
    ):
        if key in old and key not in patch:
            patch[key] = None
    return patch


def planner_unavailable_http(exc: Exception) -> HTTPException:
    msg = str(exc).strip()
    if not msg or "Well trajectory disabled" in msg or "не установлен" in msg:
        msg = (
            "Модуль расчёта траекторий (well-trajectory-planner) не установлен. "
            "В backend venv: pip install -e ../../well-trajectory-planner "
            "или перезапустите run_local.py"
        )
    return HTTPException(status_code=503, detail=msg)


def run_planner(fn: Any, /, *args: Any, **kwargs: Any) -> Any:
    try:
        return fn(*args, **kwargs)
    except RuntimeError as exc:
        raise planner_unavailable_http(exc) from exc


async def read_pad_for_read(
    project_id: UUID,
    object_id: UUID,
    user: User,
    db: AsyncSession,
) -> InfrastructureObject:
    await resolve_project(project_id, user, db, min_access=AccessLevel.read, write_scope=WriteScope.infra)
    obj = await get_infra_object(object_id, project_id, db)
    assert_pad_object(obj)
    return obj


async def read_pad_for_write(
    project_id: UUID,
    object_id: UUID,
    user: User,
    db: AsyncSession,
) -> tuple[Project, InfrastructureObject]:
    project = await require_infra_write(project_id, user, db)
    obj = await get_infra_object(object_id, project_id, db)
    assert_pad_object(obj)
    return project, obj


async def persist_pad_trajectories(
    db: AsyncSession,
    *,
    project: Project,
    project_id: UUID,
    user: User,
    obj: InfrastructureObject,
    trajectories: list[Any],
    props_postprocess: Any | None = None,
    clear_clearance: bool = True,
    clear_pywellgeo_indices: set[int] | None = None,
) -> None:
    props = finalize_pad_trajectories(
        obj.properties,
        trajectories,
        clear_clearance=clear_clearance,
        clear_pywellgeo_indices=clear_pywellgeo_indices,
    )
    if props_postprocess is not None:
        props = props_postprocess(props)
    props = _props_for_infra_merge(obj.properties, props)
    await update_infra_object_record(
        db,
        project=project,
        project_id=project_id,
        user=user,
        obj=obj,
        data=InfraObjectUpdate(properties=props),
    )
    await db.commit()


def import_options(*, step_m: float | None, interpolate: bool) -> ImportOptions:
    return ImportOptions(step_m=step_m, interpolate=interpolate)
