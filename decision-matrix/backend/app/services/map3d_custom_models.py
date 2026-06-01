"""Storage and helpers for per-project custom glTF (GLB) assets."""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.geo.constants import LINE_SUBTYPES, POINT_SUBTYPES, normalize_infra_subtype
from app.geo.render_3d_properties import RENDER_3D_MODEL_ID_KEY, RENDER_3D_STYLE_KEY
from app.models import InfrastructureLayer, InfrastructureObject, ProjectMap3dModel

CUSTOM_MODEL_ID_PREFIX = "custom:"
MAX_GLB_BYTES = 20 * 1024 * 1024
DEFAULT_TARGET_HEIGHT_M = 8.0


def normalize_assigned_subtypes(raw: Any) -> list[str]:
    """Coerce DB JSON / legacy TEXT values to a list of subtype codes."""
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(x) for x in raw if str(x).strip()]
    if isinstance(raw, str):
        text = raw.strip()
        if not text or text == "[]":
            return []
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(x) for x in parsed if str(x).strip()]
        except json.JSONDecodeError:
            return [text]
        return []
    return []


def map3d_models_root() -> Path:
    root = Path(__file__).resolve().parents[2] / "data" / "map3d_models"
    root.mkdir(parents=True, exist_ok=True)
    return root


def model_file_path(project_id: uuid.UUID, model_id: uuid.UUID) -> Path:
    return map3d_models_root() / str(project_id) / f"{model_id}.glb"


def custom_model_property_id(model_id: uuid.UUID) -> str:
    return f"{CUSTOM_MODEL_ID_PREFIX}{model_id}"


def parse_custom_model_id(value: str | None) -> uuid.UUID | None:
    if not value or not isinstance(value, str):
        return None
    key = value.strip().lower()
    if not key.startswith(CUSTOM_MODEL_ID_PREFIX):
        return None
    try:
        return uuid.UUID(key[len(CUSTOM_MODEL_ID_PREFIX) :])
    except ValueError:
        return None


def validate_assignable_subtype(subtype: str) -> str:
    st = normalize_infra_subtype(subtype)
    if st in LINE_SUBTYPES:
        raise HTTPException(status_code=400, detail="Line subtypes cannot use glTF models")
    if st not in POINT_SUBTYPES:
        raise HTTPException(status_code=400, detail=f"Unknown or unsupported point subtype: {subtype}")
    return st


async def validate_glb_upload(file: UploadFile) -> bytes:
    name = (file.filename or "").lower()
    if not name.endswith(".glb"):
        raise HTTPException(status_code=400, detail="Only .glb files are supported")
    raw = await file.read()
    if len(raw) > MAX_GLB_BYTES:
        raise HTTPException(status_code=400, detail="File exceeds 20 MB limit")
    if len(raw) < 12:
        raise HTTPException(status_code=400, detail="Invalid GLB file")
    if raw[:4] != b"glTF":
        raise HTTPException(status_code=400, detail="Invalid GLB file (missing glTF header)")
    return raw


async def list_custom_models(db: AsyncSession, project_id: uuid.UUID) -> list[ProjectMap3dModel]:
    return (
        await db.scalars(
            select(ProjectMap3dModel)
            .where(ProjectMap3dModel.project_id == project_id)
            .order_by(ProjectMap3dModel.created_at.desc())
        )
    ).all()


async def get_custom_model(
    db: AsyncSession, project_id: uuid.UUID, model_id: uuid.UUID
) -> ProjectMap3dModel:
    row = await db.scalar(
        select(ProjectMap3dModel).where(
            ProjectMap3dModel.id == model_id,
            ProjectMap3dModel.project_id == project_id,
        )
    )
    if not row:
        raise HTTPException(status_code=404, detail="Custom 3D model not found")
    return row


async def clear_object_overrides_for_custom_model(
    db: AsyncSession, project_id: uuid.UUID, model_id: uuid.UUID
) -> None:
    prop_id = custom_model_property_id(model_id)
    layer_ids = (
        await db.scalars(select(InfrastructureLayer.id).where(InfrastructureLayer.project_id == project_id))
    ).all()
    if not layer_ids:
        return
    objects = (
        await db.scalars(select(InfrastructureObject).where(InfrastructureObject.layer_id.in_(layer_ids)))
    ).all()
    for obj in objects:
        props = dict(obj.properties or {})
        if props.get(RENDER_3D_MODEL_ID_KEY) == prop_id:
            props.pop(RENDER_3D_MODEL_ID_KEY, None)
            obj.properties = props


async def _infra_object_in_project(
    db: AsyncSession, project_id: uuid.UUID, object_id: uuid.UUID
) -> InfrastructureObject:
    result = await db.execute(
        select(InfrastructureObject)
        .join(InfrastructureLayer, InfrastructureObject.layer_id == InfrastructureLayer.id)
        .where(
            InfrastructureObject.id == object_id,
            InfrastructureLayer.project_id == project_id,
        )
    )
    obj = result.scalar_one_or_none()
    if obj is None:
        raise HTTPException(status_code=404, detail="Infrastructure object not found")
    return obj


def _dedupe_subtypes(subtypes: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for raw in subtypes:
        st = validate_assignable_subtype(raw)
        if st not in seen:
            seen.add(st)
            out.append(st)
    return out


async def resolve_assign_subtypes_payload(
    db: AsyncSession,
    project_id: uuid.UUID,
    *,
    subtypes: list[str] | None,
    subtype: str | None,
    object_id: uuid.UUID | None,
) -> list[str]:
    if subtypes is not None:
        return _dedupe_subtypes(subtypes)
    if subtype and str(subtype).strip():
        return [validate_assignable_subtype(subtype)]
    if object_id is not None:
        obj = await _infra_object_in_project(db, project_id, object_id)
        return [validate_assignable_subtype(obj.subtype)]
    raise HTTPException(status_code=400, detail="subtypes, subtype or object_id is required")


async def assign_custom_model_to_subtypes(
    db: AsyncSession,
    project_id: uuid.UUID,
    model_id: uuid.UUID,
    subtypes: list[str],
) -> ProjectMap3dModel:
    row = await get_custom_model(db, project_id, model_id)
    row.assigned_subtypes = _dedupe_subtypes(subtypes) if subtypes else []
    await db.flush()
    return row


async def assert_custom_model_allowed_for_object(
    db: AsyncSession,
    project_id: uuid.UUID,
    object_subtype: str,
    properties: dict | None,
) -> None:
    if not properties:
        return
    raw = properties.get(RENDER_3D_MODEL_ID_KEY)
    if not isinstance(raw, str) or not raw.strip().lower().startswith(CUSTOM_MODEL_ID_PREFIX):
        return
    model_id = parse_custom_model_id(raw)
    if model_id is None:
        raise HTTPException(status_code=400, detail="Invalid custom 3D model id")
    row = await get_custom_model(db, project_id, model_id)
    obj_st = normalize_infra_subtype(object_subtype)
    assigned = normalize_assigned_subtypes(row.assigned_subtypes)
    if obj_st not in assigned:
        raise HTTPException(
            status_code=400,
            detail="Custom 3D model is not assigned to this object subtype",
        )


def assert_can_set_custom_model_id(
    user,
    project,
    properties: dict | None,
    *,
    db: AsyncSession | None = None,
    project_id: uuid.UUID | None = None,
    object_subtype: str | None = None,
) -> None:
    from app.models import Project
    from app.services.project_access import can_assign_map3d_custom_model

    if not properties:
        return
    raw = properties.get(RENDER_3D_MODEL_ID_KEY)
    if isinstance(raw, str) and raw.strip().lower().startswith(CUSTOM_MODEL_ID_PREFIX):
        if not isinstance(project, Project) or not can_assign_map3d_custom_model(user, project):
            raise HTTPException(
                status_code=403,
                detail="Only administrators and project owners can assign custom 3D models",
            )


async def assert_can_set_custom_model_id_async(
    db: AsyncSession,
    user,
    project,
    project_id: uuid.UUID,
    object_subtype: str,
    properties: dict | None,
) -> None:
    assert_can_set_custom_model_id(user, project, properties)
    await assert_custom_model_allowed_for_object(db, project_id, object_subtype, properties)
