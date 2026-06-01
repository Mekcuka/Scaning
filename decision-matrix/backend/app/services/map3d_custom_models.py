"""Storage and helpers for per-project custom glTF (GLB) assets."""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.geo.constants import LINE_SUBTYPES
from app.geo.render_3d_properties import RENDER_3D_MODEL_ID_KEY, RENDER_3D_STYLE_KEY
from app.models import InfrastructureLayer, InfrastructureObject, ProjectMap3dModel

CUSTOM_MODEL_ID_PREFIX = "custom:"
MAX_GLB_BYTES = 20 * 1024 * 1024
DEFAULT_TARGET_HEIGHT_M = 8.0


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


async def list_custom_models_with_assignments(
    db: AsyncSession, project_id: uuid.UUID
) -> list[tuple[ProjectMap3dModel, uuid.UUID | None]]:
    models = (
        await db.scalars(
            select(ProjectMap3dModel)
            .where(ProjectMap3dModel.project_id == project_id)
            .order_by(ProjectMap3dModel.created_at.desc())
        )
    ).all()
    if not models:
        return []

    layer_ids = (
        await db.scalars(select(InfrastructureLayer.id).where(InfrastructureLayer.project_id == project_id))
    ).all()
    if not layer_ids:
        return [(m, None) for m in models]

    objects = (
        await db.scalars(select(InfrastructureObject).where(InfrastructureObject.layer_id.in_(layer_ids)))
    ).all()
    assign_by_model: dict[uuid.UUID, uuid.UUID] = {}
    for obj in objects:
        mid = parse_custom_model_id((obj.properties or {}).get(RENDER_3D_MODEL_ID_KEY))
        if mid is not None:
            assign_by_model[mid] = obj.id

    return [(m, assign_by_model.get(m.id)) for m in models]


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


async def clear_custom_model_assignments(db: AsyncSession, project_id: uuid.UUID, model_id: uuid.UUID) -> None:
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


async def assign_custom_model_to_object(
    db: AsyncSession,
    project_id: uuid.UUID,
    model_id: uuid.UUID,
    object_id: uuid.UUID,
) -> InfrastructureObject:
    await get_custom_model(db, project_id, model_id)
    layer_ids = (
        await db.scalars(select(InfrastructureLayer.id).where(InfrastructureLayer.project_id == project_id))
    ).all()
    obj = await db.scalar(
        select(InfrastructureObject).where(
            InfrastructureObject.id == object_id,
            InfrastructureObject.layer_id.in_(layer_ids),
        )
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Infrastructure object not found")
    if obj.subtype in LINE_SUBTYPES:
        raise HTTPException(status_code=400, detail="Line objects cannot use glTF models")

    prop_id = custom_model_property_id(model_id)
    await clear_custom_model_assignments(db, project_id, model_id)

    props = dict(obj.properties or {})
    props[RENDER_3D_MODEL_ID_KEY] = prop_id
    props[RENDER_3D_STYLE_KEY] = "model"
    from app.geo.render_3d_properties import apply_default_render_3d

    obj.properties = apply_default_render_3d(obj.subtype, props)
    return obj


def assert_can_set_custom_model_id(user, project, properties: dict | None) -> None:
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
