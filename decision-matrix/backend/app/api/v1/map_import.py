"""File import endpoints (CSV, GeoJSON, KML, shapefile, spark)."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import User
from app.schemas import ImportLogResponse, ImportPreviewResponse
from app.services.map_import.api_handlers import (
    handle_get_import_log,
    handle_import_csv,
    handle_import_csv_async,
    handle_import_geojson,
    handle_import_geojson_async,
    handle_import_kml,
    handle_import_kml_async,
    handle_import_logs,
    handle_import_shapefile,
    handle_import_spark,
    handle_import_spark_async,
    handle_preview_import,
)

import_router = APIRouter(tags=["map-import"])


@import_router.get("/import/logs/{log_id}", response_model=ImportLogResponse)
async def get_import_log(
    log_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_get_import_log(log_id, user, db)


@import_router.post("/projects/{project_id}/import/preview", response_model=ImportPreviewResponse)
async def preview_import(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
    format: str = Query("csv", pattern="^(csv|geojson|kml|spark)$"),
):
    return await handle_preview_import(project_id, user, db, file, format=format)


@import_router.post("/projects/{project_id}/import/csv", response_model=ImportLogResponse)
async def import_csv(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    return await handle_import_csv(project_id, user, db, file)


@import_router.post("/projects/{project_id}/import/csv/async", response_model=ImportLogResponse, status_code=202)
async def import_csv_async(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    return await handle_import_csv_async(project_id, user, db, file)


@import_router.post("/projects/{project_id}/import/kml", response_model=ImportLogResponse)
async def import_kml(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    return await handle_import_kml(project_id, user, db, file)


@import_router.post("/projects/{project_id}/import/shapefile", response_model=ImportLogResponse)
async def import_shapefile(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    return await handle_import_shapefile(project_id, user, db, file)


@import_router.post("/projects/{project_id}/import/geojson", response_model=ImportLogResponse)
async def import_geojson(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    return await handle_import_geojson(project_id, user, db, file)


@import_router.post("/projects/{project_id}/import/geojson/async", response_model=ImportLogResponse, status_code=202)
async def import_geojson_async(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    return await handle_import_geojson_async(project_id, user, db, file)


@import_router.post("/projects/{project_id}/import/kml/async", response_model=ImportLogResponse, status_code=202)
async def import_kml_async(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    return await handle_import_kml_async(project_id, user, db, file)


@import_router.post("/projects/{project_id}/import/spark", response_model=ImportLogResponse)
async def import_spark(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    return await handle_import_spark(project_id, user, db, file)


@import_router.post("/projects/{project_id}/import/spark/async", response_model=ImportLogResponse, status_code=202)
async def import_spark_async(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    return await handle_import_spark_async(project_id, user, db, file)


@import_router.get("/import/logs", response_model=list[ImportLogResponse])
async def import_logs(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    project_id: UUID | None = None,
):
    return await handle_import_logs(user, db, project_id=project_id)
