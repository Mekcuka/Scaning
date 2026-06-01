"""Per-project custom glTF (GLB) uploads for map 3D (admin upload, project read)."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.rbac import require_admin
from app.core.database import get_db
from app.models import ProjectMap3dModel, User
from app.schemas import Map3dCustomModelAssign, Map3dCustomModelResponse
from app.services.map3d_custom_models import (
    DEFAULT_TARGET_HEIGHT_M,
    assign_custom_model_to_subtype,
    clear_object_overrides_for_custom_model,
    get_custom_model,
    list_custom_models,
    model_file_path,
    resolve_assign_subtype_payload,
    validate_glb_upload,
)
from app.models.enums import AccessLevel, WriteScope
from app.services.project_access import can_assign_map3d_custom_model, resolve_project

map3d_custom_models_router = APIRouter()


async def _get_user_project(project_id: UUID, user: User, db: AsyncSession):
    return await resolve_project(project_id, user, db, min_access=AccessLevel.read, write_scope=WriteScope.infra)


async def _require_map3d_assign(project_id: UUID, user: User, db: AsyncSession):
    project = await _get_user_project(project_id, user, db)
    if not can_assign_map3d_custom_model(user, project):
        raise HTTPException(
            status_code=403,
            detail="Only administrators and project owners can assign custom 3D models",
        )
    return project


def _to_response(row: ProjectMap3dModel) -> Map3dCustomModelResponse:
    return Map3dCustomModelResponse(
        id=row.id,
        project_id=row.project_id,
        filename=row.filename,
        target_height_m=float(row.target_height_m),
        created_at=row.created_at,
        assigned_subtype=row.assigned_subtype,
    )


@map3d_custom_models_router.get(
    "/projects/{project_id}/map3d-custom-models",
    response_model=list[Map3dCustomModelResponse],
)
async def list_map3d_custom_models(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_user_project(project_id, user, db)
    rows = await list_custom_models(db, project_id)
    return [_to_response(m) for m in rows]


@map3d_custom_models_router.post(
    "/projects/{project_id}/map3d-custom-models",
    response_model=Map3dCustomModelResponse,
    status_code=201,
)
async def upload_map3d_custom_model(
    project_id: UUID,
    file: UploadFile = File(...),
    target_height_m: float | None = Form(None),
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    await _get_user_project(project_id, user, db)
    raw = await validate_glb_upload(file)
    height = float(target_height_m) if target_height_m is not None else DEFAULT_TARGET_HEIGHT_M
    if height <= 0 or height > 500:
        raise HTTPException(status_code=400, detail="target_height_m must be between 0 and 500")

    row = ProjectMap3dModel(
        project_id=project_id,
        filename=file.filename or "model.glb",
        target_height_m=height,
        created_by_user_id=user.id,
    )
    db.add(row)
    await db.flush()

    path = model_file_path(project_id, row.id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)

    await db.commit()
    await db.refresh(row)
    return _to_response(row)


@map3d_custom_models_router.get("/projects/{project_id}/map3d-custom-models/{model_id}/file")
async def get_map3d_custom_model_file(
    project_id: UUID,
    model_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_user_project(project_id, user, db)
    row = await get_custom_model(db, project_id, model_id)
    path = model_file_path(project_id, row.id)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Model file not found on disk")
    return FileResponse(path, media_type="model/gltf-binary", filename=row.filename)


@map3d_custom_models_router.delete(
    "/projects/{project_id}/map3d-custom-models/{model_id}",
    status_code=204,
)
async def delete_map3d_custom_model(
    project_id: UUID,
    model_id: UUID,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    await _get_user_project(project_id, user, db)
    row = await get_custom_model(db, project_id, model_id)
    await clear_object_overrides_for_custom_model(db, project_id, model_id)
    path = model_file_path(project_id, row.id)
    await db.delete(row)
    await db.commit()
    if path.is_file():
        path.unlink()


@map3d_custom_models_router.post(
    "/projects/{project_id}/map3d-custom-models/{model_id}/assign",
    response_model=Map3dCustomModelResponse,
)
async def assign_map3d_custom_model(
    project_id: UUID,
    model_id: UUID,
    data: Map3dCustomModelAssign,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_map3d_assign(project_id, user, db)
    subtype = await resolve_assign_subtype_payload(
        db, project_id, subtype=data.subtype, object_id=data.object_id
    )
    row = await assign_custom_model_to_subtype(db, project_id, model_id, subtype)
    await db.commit()
    await db.refresh(row)
    return _to_response(row)
