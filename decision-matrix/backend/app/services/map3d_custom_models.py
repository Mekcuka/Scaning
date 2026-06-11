"""Storage and helpers for per-project custom glTF (GLB) assets."""

from __future__ import annotations

import hashlib
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.geo.constants import LINE_SUBTYPES, POINT_SUBTYPES, normalize_infra_subtype
from app.geo.render_3d_properties import RENDER_3D_MODEL_ID_KEY, RENDER_3D_STYLE_KEY
from app.models import InfrastructureLayer, InfrastructureObject, ProjectMap3dModel

CUSTOM_MODEL_ID_PREFIX = "custom:"
MAX_GLB_BYTES = 20 * 1024 * 1024
DEFAULT_TARGET_HEIGHT_M = 8.0
ApplyMode = Literal["empty_only", "all"]


def normalize_assigned_subtypes(raw: Any) -> list[str]:
    """Coerce DB JSON / legacy TEXT values to a list of subtype codes."""
    items: list[str] = []
    if raw is None:
        return []
    if isinstance(raw, list):
        items = [str(x) for x in raw if str(x).strip()]
    elif isinstance(raw, str):
        text = raw.strip()
        if not text or text == "[]":
            return []
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                items = [str(x) for x in parsed if str(x).strip()]
            else:
                items = [text]
        except json.JSONDecodeError:
            items = [text]
    seen: set[str] = set()
    out: list[str] = []
    for raw_st in items:
        st = normalize_infra_subtype(raw_st)
        if st and st not in seen:
            seen.add(st)
            out.append(st)
    return out


def default_display_name(filename: str) -> str:
    name = (filename or "model").strip()
    if name.lower().endswith(".glb"):
        return name[:-4] or "model"
    return name or "model"


def compute_sha256(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def map3d_models_root() -> Path:
    from app.core.config import settings

    env_root = (settings.MAP3D_MODELS_ROOT or os.environ.get("MAP3D_MODELS_ROOT") or "").strip()
    if env_root:
        root = Path(env_root)
    else:
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


def _render_model_id_empty(props: dict | None) -> bool:
    if not props:
        return True
    raw = props.get(RENDER_3D_MODEL_ID_KEY)
    if raw is None:
        return True
    if isinstance(raw, str) and not raw.strip():
        return True
    return False


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


async def count_model_usage(db: AsyncSession, project_id: uuid.UUID, model_id: uuid.UUID) -> int:
    prop_id = custom_model_property_id(model_id)
    layer_ids = (
        await db.scalars(select(InfrastructureLayer.id).where(InfrastructureLayer.project_id == project_id))
    ).all()
    if not layer_ids:
        return 0
    objects = (
        await db.scalars(select(InfrastructureObject).where(InfrastructureObject.layer_id.in_(layer_ids)))
    ).all()
    count = 0
    for obj in objects:
        props = obj.properties or {}
        if props.get(RENDER_3D_MODEL_ID_KEY) == prop_id:
            count += 1
    return count


async def count_usage_for_models(
    db: AsyncSession, project_id: uuid.UUID, models: list[ProjectMap3dModel]
) -> dict[uuid.UUID, int]:
    if not models:
        return {}
    layer_ids = (
        await db.scalars(select(InfrastructureLayer.id).where(InfrastructureLayer.project_id == project_id))
    ).all()
    if not layer_ids:
        return {m.id: 0 for m in models}
    prop_ids = {custom_model_property_id(m.id): m.id for m in models}
    objects = (
        await db.scalars(select(InfrastructureObject).where(InfrastructureObject.layer_id.in_(layer_ids)))
    ).all()
    counts: dict[uuid.UUID, int] = {m.id: 0 for m in models}
    for obj in objects:
        props = obj.properties or {}
        raw = props.get(RENDER_3D_MODEL_ID_KEY)
        if not isinstance(raw, str):
            continue
        mid = prop_ids.get(raw.strip())
        if mid is not None:
            counts[mid] += 1
    return counts


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


def write_model_file_atomic(project_id: uuid.UUID, model_id: uuid.UUID, raw: bytes) -> None:
    path = model_file_path(project_id, model_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".glb.tmp")
    try:
        tmp.write_bytes(raw)
        tmp.replace(path)
    except Exception:
        if tmp.is_file():
            tmp.unlink(missing_ok=True)
        raise


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


async def _project_point_objects(db: AsyncSession, project_id: uuid.UUID) -> list[InfrastructureObject]:
    layer_ids = (
        await db.scalars(select(InfrastructureLayer.id).where(InfrastructureLayer.project_id == project_id))
    ).all()
    if not layer_ids:
        return []
    objects = (
        await db.scalars(select(InfrastructureObject).where(InfrastructureObject.layer_id.in_(layer_ids)))
    ).all()
    return [o for o in objects if normalize_infra_subtype(o.subtype) not in LINE_SUBTYPES]


def _object_matches_subtypes(obj: InfrastructureObject, subtypes: set[str]) -> bool:
    return normalize_infra_subtype(obj.subtype) in subtypes


def preview_apply_custom_model(
    objects: list[InfrastructureObject],
    subtypes: list[str],
    *,
    apply_mode: ApplyMode,
) -> tuple[int, int]:
    subtype_set = set(subtypes)
    total_matching = 0
    would_update = 0
    for obj in objects:
        if not _object_matches_subtypes(obj, subtype_set):
            continue
        total_matching += 1
        props = obj.properties or {}
        if apply_mode == "all" or _render_model_id_empty(props):
            would_update += 1
    return would_update, total_matching


async def preview_apply_custom_model_to_objects(
    db: AsyncSession,
    project_id: uuid.UUID,
    subtypes: list[str],
    *,
    apply_mode: ApplyMode,
) -> tuple[int, int]:
    objects = await _project_point_objects(db, project_id)
    return preview_apply_custom_model(objects, subtypes, apply_mode=apply_mode)


async def apply_custom_model_to_objects(
    db: AsyncSession,
    project_id: uuid.UUID,
    model_id: uuid.UUID,
    subtypes: list[str],
    *,
    apply_mode: ApplyMode,
) -> int:
    if not subtypes:
        return 0
    prop_id = custom_model_property_id(model_id)
    subtype_set = set(subtypes)
    updated = 0
    for obj in await _project_point_objects(db, project_id):
        if not _object_matches_subtypes(obj, subtype_set):
            continue
        props = dict(obj.properties or {})
        if apply_mode != "all" and not _render_model_id_empty(props):
            continue
        props[RENDER_3D_MODEL_ID_KEY] = prop_id
        props[RENDER_3D_STYLE_KEY] = "model"
        obj.properties = props
        updated += 1
    if updated:
        await db.flush()
    return updated


async def assign_custom_model_to_subtypes(
    db: AsyncSession,
    project_id: uuid.UUID,
    model_id: uuid.UUID,
    subtypes: list[str],
    *,
    apply_to_objects: bool = False,
    apply_mode: ApplyMode = "empty_only",
) -> tuple[ProjectMap3dModel, int]:
    row = await get_custom_model(db, project_id, model_id)
    row.assigned_subtypes = _dedupe_subtypes(subtypes) if subtypes else []
    await db.flush()
    objects_updated = 0
    if apply_to_objects and row.assigned_subtypes:
        objects_updated = await apply_custom_model_to_objects(
            db,
            project_id,
            model_id,
            row.assigned_subtypes,
            apply_mode=apply_mode,
        )
    return row, objects_updated


async def update_custom_model_metadata(
    db: AsyncSession,
    project_id: uuid.UUID,
    model_id: uuid.UUID,
    *,
    display_name: str | None = None,
    target_height_m: float | None = None,
) -> ProjectMap3dModel:
    row = await get_custom_model(db, project_id, model_id)
    if display_name is not None:
        name = display_name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="display_name cannot be empty")
        if len(name) > 255:
            raise HTTPException(status_code=400, detail="display_name too long")
        row.display_name = name
    if target_height_m is not None:
        height = float(target_height_m)
        if height <= 0 or height > 500:
            raise HTTPException(status_code=400, detail="target_height_m must be between 0 and 500")
        row.target_height_m = height
    row.updated_at = datetime.now(timezone.utc)
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
