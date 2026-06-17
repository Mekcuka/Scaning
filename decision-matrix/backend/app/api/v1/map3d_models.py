"""Per-project custom glTF (GLB) uploads for map 3D (admin upload, project read)."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.rbac import require_admin
from app.core.database import get_db
from app.models import User
from app.schemas import (
    Map3dCustomModelApplyPreview,
    Map3dCustomModelAssign,
    Map3dCustomModelAssignResponse,
    Map3dCustomModelResponse,
    Map3dCustomModelUpdate,
)
from app.services.map3d.api_handlers import (
    handle_apply_preview,
    handle_assign,
    handle_delete,
    handle_get_file,
    handle_list,
    handle_patch,
    handle_upload,
)

map3d_custom_models_router = APIRouter()


@map3d_custom_models_router.get(
    "/projects/{project_id}/map3d-custom-models",
    response_model=list[Map3dCustomModelResponse],
)
async def list_map3d_custom_models(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_list(project_id, user, db)


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
    return await handle_upload(project_id, file, user, db, target_height_m=target_height_m)


@map3d_custom_models_router.patch(
    "/projects/{project_id}/map3d-custom-models/{model_id}",
    response_model=Map3dCustomModelResponse,
)
async def patch_map3d_custom_model(
    project_id: UUID,
    model_id: UUID,
    data: Map3dCustomModelUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_patch(project_id, model_id, data, user, db)


@map3d_custom_models_router.get(
    "/projects/{project_id}/map3d-custom-models/{model_id}/apply-preview",
    response_model=Map3dCustomModelApplyPreview,
)
async def preview_map3d_custom_model_apply(
    project_id: UUID,
    model_id: UUID,
    subtypes: str = Query(..., description="Comma-separated subtype codes"),
    mode: str = Query("empty_only", alias="mode"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_apply_preview(
        project_id, model_id, user, db, subtypes=subtypes, mode=mode
    )


@map3d_custom_models_router.get("/projects/{project_id}/map3d-custom-models/{model_id}/file")
async def get_map3d_custom_model_file(
    project_id: UUID,
    model_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_get_file(project_id, model_id, user, db)


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
    await handle_delete(project_id, model_id, user, db)


@map3d_custom_models_router.post(
    "/projects/{project_id}/map3d-custom-models/{model_id}/assign",
    response_model=Map3dCustomModelAssignResponse,
)
async def assign_map3d_custom_model(
    project_id: UUID,
    model_id: UUID,
    data: Map3dCustomModelAssign,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_assign(project_id, model_id, data, user, db)
