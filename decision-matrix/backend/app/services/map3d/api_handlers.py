"""HTTP orchestration for map 3D custom models BFF."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.map_deps import get_user_project
from app.models import Project, ProjectMap3dModel, User
from app.schemas import (
    Map3dCustomModelApplyPreview,
    Map3dCustomModelAssign,
    Map3dCustomModelAssignResponse,
    Map3dCustomModelResponse,
    Map3dCustomModelUpdate,
)
from app.services.map3d.storage import (
    DEFAULT_TARGET_HEIGHT_M,
    assign_custom_model_to_subtypes,
    clear_object_overrides_for_custom_model,
    compute_sha256,
    count_usage_for_models,
    default_display_name,
    get_custom_model,
    list_custom_models,
    model_file_path,
    normalize_assigned_subtypes,
    preview_apply_custom_model_to_objects,
    resolve_assign_subtypes_payload,
    update_custom_model_metadata,
    validate_glb_upload,
    write_model_file_atomic,
)
from app.services.map3d.optimize import optimize_glb_upload
from app.services.project_access import can_assign_map3d_custom_model


async def require_map3d_assign(project_id: UUID, user: User, db: AsyncSession) -> Project:
    project = await get_user_project(project_id, user, db)
    if not can_assign_map3d_custom_model(user, project):
        raise HTTPException(
            status_code=403,
            detail="Only administrators and project owners can assign custom 3D models",
        )
    return project


def to_response(row: ProjectMap3dModel, *, usage_count: int = 0) -> Map3dCustomModelResponse:
    display = (row.display_name or "").strip() or default_display_name(row.filename)
    return Map3dCustomModelResponse(
        id=row.id,
        project_id=row.project_id,
        filename=row.filename,
        display_name=display,
        target_height_m=float(row.target_height_m),
        file_size_bytes=int(row.file_size_bytes or 0),
        created_at=row.created_at,
        updated_at=row.updated_at,
        assigned_subtypes=normalize_assigned_subtypes(row.assigned_subtypes),
        usage_count=usage_count,
    )


async def handle_list(
    project_id: UUID,
    user: User,
    db: AsyncSession,
) -> list[Map3dCustomModelResponse]:
    await get_user_project(project_id, user, db)
    rows = await list_custom_models(db, project_id)
    usage = await count_usage_for_models(db, project_id, rows)
    return [to_response(m, usage_count=usage.get(m.id, 0)) for m in rows]


async def handle_upload(
    project_id: UUID,
    file: UploadFile,
    user: User,
    db: AsyncSession,
    *,
    target_height_m: float | None = None,
) -> Map3dCustomModelResponse:
    await get_user_project(project_id, user, db)
    raw = await validate_glb_upload(file)
    stored, _compressed = optimize_glb_upload(raw)
    height = float(target_height_m) if target_height_m is not None else DEFAULT_TARGET_HEIGHT_M
    if height <= 0 or height > 500:
        raise HTTPException(status_code=400, detail="target_height_m must be between 0 and 500")

    filename = file.filename or "model.glb"
    row = ProjectMap3dModel(
        project_id=project_id,
        filename=filename,
        display_name=default_display_name(filename),
        target_height_m=height,
        file_size_bytes=len(stored),
        content_sha256=compute_sha256(stored),
        created_by_user_id=user.id,
    )
    db.add(row)
    await db.flush()

    try:
        write_model_file_atomic(project_id, row.id, stored)
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to store model file") from None

    await db.commit()
    await db.refresh(row)
    return to_response(row)


async def handle_patch(
    project_id: UUID,
    model_id: UUID,
    data: Map3dCustomModelUpdate,
    user: User,
    db: AsyncSession,
) -> Map3dCustomModelResponse:
    await require_map3d_assign(project_id, user, db)
    if data.display_name is None and data.target_height_m is None:
        raise HTTPException(status_code=400, detail="No fields to update")
    row = await update_custom_model_metadata(
        db,
        project_id,
        model_id,
        display_name=data.display_name,
        target_height_m=data.target_height_m,
    )
    await db.commit()
    await db.refresh(row)
    usage = await count_usage_for_models(db, project_id, [row])
    return to_response(row, usage_count=usage.get(row.id, 0))


async def handle_apply_preview(
    project_id: UUID,
    model_id: UUID,
    user: User,
    db: AsyncSession,
    *,
    subtypes: str,
    mode: str = "empty_only",
) -> Map3dCustomModelApplyPreview:
    await require_map3d_assign(project_id, user, db)
    await get_custom_model(db, project_id, model_id)
    if mode not in ("empty_only", "all"):
        raise HTTPException(status_code=400, detail="mode must be empty_only or all")
    subtype_list = [s.strip() for s in subtypes.split(",") if s.strip()]
    would_update, total_matching = await preview_apply_custom_model_to_objects(
        db,
        project_id,
        subtype_list,
        apply_mode=mode,  # type: ignore[arg-type]
    )
    return Map3dCustomModelApplyPreview(would_update=would_update, total_matching=total_matching)


async def handle_get_file(
    project_id: UUID,
    model_id: UUID,
    user: User,
    db: AsyncSession,
) -> FileResponse:
    await get_user_project(project_id, user, db)
    row = await get_custom_model(db, project_id, model_id)
    path = model_file_path(project_id, row.id)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Model file not found on disk")
    return FileResponse(path, media_type="model/gltf-binary", filename=row.filename)


async def handle_delete(
    project_id: UUID,
    model_id: UUID,
    user: User,
    db: AsyncSession,
) -> None:
    await get_user_project(project_id, user, db)
    row = await get_custom_model(db, project_id, model_id)
    await clear_object_overrides_for_custom_model(db, project_id, model_id)
    path = model_file_path(project_id, row.id)
    await db.delete(row)
    await db.commit()
    if path.is_file():
        path.unlink()


async def handle_assign(
    project_id: UUID,
    model_id: UUID,
    data: Map3dCustomModelAssign,
    user: User,
    db: AsyncSession,
) -> Map3dCustomModelAssignResponse:
    await require_map3d_assign(project_id, user, db)
    subtypes = await resolve_assign_subtypes_payload(
        db,
        project_id,
        subtypes=data.subtypes,
        subtype=data.subtype,
        object_id=data.object_id,
    )
    row, objects_updated = await assign_custom_model_to_subtypes(
        db,
        project_id,
        model_id,
        subtypes,
        apply_to_objects=data.apply_to_objects,
        apply_mode=data.apply_mode,  # type: ignore[arg-type]
    )
    await db.commit()
    await db.refresh(row)
    usage = await count_usage_for_models(db, project_id, [row])
    return Map3dCustomModelAssignResponse(
        model=to_response(row, usage_count=usage.get(row.id, 0)),
        objects_updated=objects_updated,
    )
