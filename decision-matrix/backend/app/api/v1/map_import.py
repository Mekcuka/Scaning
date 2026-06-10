"""File import endpoints (CSV, GeoJSON, KML, shapefile, spark)."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.map_deps import get_or_create_default_layer, require_infra_write
from app.core.database import get_db
from app.models import ImportLog, User
from app.schemas import ImportLogResponse, ImportPreviewResponse
from app.services.file_import.parse import parse_import_content
from app.services.file_import.upload_decode import (
    KmzWithoutKmlError,
    decode_csv_bytes,
    decode_kml_bytes,
    decode_upload_for_preview,
    decode_utf8_bytes,
)
from app.services.file_import.workflows import (
    CSV_IMPORT,
    GEOJSON_IMPORT,
    KML_IMPORT,
    SHAPEFILE_IMPORT,
    SPARK_IMPORT,
    commit_sync_file_import,
    commit_sync_shapefile_import,
    enqueue_async_file_import,
)
from app.services.project_jobs import ActiveProjectJobError

import_router = APIRouter(tags=["map-import"])


def _active_job_http(exc: ActiveProjectJobError) -> HTTPException:
    return HTTPException(
        status_code=409,
        detail={"message": "Project already has an active job", "active_job_id": str(exc.active_job_id)},
    )


async def _enqueue_import(project_id, user, db, layer, spec, content, file_name):
    try:
        return await enqueue_async_file_import(
            db,
            user_id=user.id,
            project_id=project_id,
            layer=layer,
            spec=spec,
            content=content,
            file_name=file_name,
        )
    except ActiveProjectJobError as e:
        raise _active_job_http(e) from e


@import_router.get("/import/logs/{log_id}", response_model=ImportLogResponse)
async def get_import_log(
    log_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    log = await db.get(ImportLog, log_id)
    if not log or log.user_id != user.id:
        raise HTTPException(status_code=404, detail="Import log not found")
    return log


@import_router.post("/projects/{project_id}/import/preview", response_model=ImportPreviewResponse)
async def preview_import(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
    format: str = Query("csv", pattern="^(csv|geojson|kml|spark)$"),
):
    await require_infra_write(project_id, user, db)
    raw = await file.read()
    content, fmt = decode_upload_for_preview(raw, file.filename or "", format)
    rows, errors = parse_import_content(content, fmt)
    preview = [
        {
            "name": r["name"],
            "subtype": r["subtype"],
            "lon": r["lon"],
            "lat": r["lat"],
            "end_lon": r.get("end_lon"),
            "end_lat": r.get("end_lat"),
        }
        for r in rows[:50]
    ]
    return ImportPreviewResponse(rows=preview, errors=errors, records_total=len(rows))


@import_router.post("/projects/{project_id}/import/csv", response_model=ImportLogResponse)
async def import_csv(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    await require_infra_write(project_id, user, db)
    layer = await get_or_create_default_layer(
        project_id, db, source_type=CSV_IMPORT.source_type, name=CSV_IMPORT.layer_name
    )
    return await commit_sync_file_import(
        db,
        user_id=user.id,
        project_id=project_id,
        layer=layer,
        spec=CSV_IMPORT,
        content=decode_csv_bytes(await file.read()),
        file_name=file.filename or CSV_IMPORT.default_filename,
    )


@import_router.post("/projects/{project_id}/import/csv/async", response_model=ImportLogResponse, status_code=202)
async def import_csv_async(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    await require_infra_write(project_id, user, db)
    layer = await get_or_create_default_layer(
        project_id, db, source_type=CSV_IMPORT.source_type, name=CSV_IMPORT.layer_name
    )
    return await _enqueue_import(
        project_id,
        user,
        db,
        layer,
        CSV_IMPORT,
        decode_csv_bytes(await file.read()),
        file.filename or CSV_IMPORT.default_filename,
    )


@import_router.post("/projects/{project_id}/import/kml", response_model=ImportLogResponse)
async def import_kml(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    await require_infra_write(project_id, user, db)
    try:
        content = decode_kml_bytes(
            await file.read(), file.filename or KML_IMPORT.default_filename, strict_kmz=True
        )
    except KmzWithoutKmlError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    layer = await get_or_create_default_layer(
        project_id, db, source_type=KML_IMPORT.source_type, name=KML_IMPORT.layer_name
    )
    return await commit_sync_file_import(
        db,
        user_id=user.id,
        project_id=project_id,
        layer=layer,
        spec=KML_IMPORT,
        content=content,
        file_name=file.filename or KML_IMPORT.default_filename,
    )


@import_router.post("/projects/{project_id}/import/shapefile", response_model=ImportLogResponse)
async def import_shapefile(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    await require_infra_write(project_id, user, db)
    layer = await get_or_create_default_layer(
        project_id, db, source_type=SHAPEFILE_IMPORT.source_type, name=SHAPEFILE_IMPORT.layer_name
    )
    return await commit_sync_shapefile_import(
        db,
        user_id=user.id,
        project_id=project_id,
        layer=layer,
        file_name=file.filename or SHAPEFILE_IMPORT.default_filename,
        zip_bytes=await file.read(),
    )


@import_router.post("/projects/{project_id}/import/geojson", response_model=ImportLogResponse)
async def import_geojson(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    await require_infra_write(project_id, user, db)
    layer = await get_or_create_default_layer(
        project_id, db, source_type=GEOJSON_IMPORT.source_type, name=GEOJSON_IMPORT.layer_name
    )
    return await commit_sync_file_import(
        db,
        user_id=user.id,
        project_id=project_id,
        layer=layer,
        spec=GEOJSON_IMPORT,
        content=decode_utf8_bytes(await file.read()),
        file_name=file.filename or GEOJSON_IMPORT.default_filename,
    )


@import_router.post("/projects/{project_id}/import/geojson/async", response_model=ImportLogResponse, status_code=202)
async def import_geojson_async(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    await require_infra_write(project_id, user, db)
    layer = await get_or_create_default_layer(
        project_id, db, source_type=GEOJSON_IMPORT.source_type, name=GEOJSON_IMPORT.layer_name
    )
    return await _enqueue_import(
        project_id,
        user,
        db,
        layer,
        GEOJSON_IMPORT,
        decode_utf8_bytes(await file.read()),
        file.filename or GEOJSON_IMPORT.default_filename,
    )


@import_router.post("/projects/{project_id}/import/kml/async", response_model=ImportLogResponse, status_code=202)
async def import_kml_async(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    await require_infra_write(project_id, user, db)
    content = decode_kml_bytes(
        await file.read(), file.filename or KML_IMPORT.default_filename, strict_kmz=False
    )
    layer = await get_or_create_default_layer(
        project_id, db, source_type=KML_IMPORT.source_type, name=KML_IMPORT.layer_name
    )
    return await _enqueue_import(
        project_id,
        user,
        db,
        layer,
        KML_IMPORT,
        content,
        file.filename or KML_IMPORT.default_filename,
    )


@import_router.post("/projects/{project_id}/import/spark", response_model=ImportLogResponse)
async def import_spark(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    await require_infra_write(project_id, user, db)
    layer = await get_or_create_default_layer(
        project_id, db, source_type=SPARK_IMPORT.source_type, name=SPARK_IMPORT.layer_name
    )
    return await commit_sync_file_import(
        db,
        user_id=user.id,
        project_id=project_id,
        layer=layer,
        spec=SPARK_IMPORT,
        content=decode_utf8_bytes(await file.read()),
        file_name=file.filename or SPARK_IMPORT.default_filename,
    )


@import_router.post("/projects/{project_id}/import/spark/async", response_model=ImportLogResponse, status_code=202)
async def import_spark_async(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    await require_infra_write(project_id, user, db)
    layer = await get_or_create_default_layer(
        project_id, db, source_type=SPARK_IMPORT.source_type, name=SPARK_IMPORT.layer_name
    )
    return await _enqueue_import(
        project_id,
        user,
        db,
        layer,
        SPARK_IMPORT,
        decode_utf8_bytes(await file.read()),
        file.filename or SPARK_IMPORT.default_filename,
    )


@import_router.get("/import/logs", response_model=list[ImportLogResponse])
async def import_logs(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    project_id: UUID | None = None,
):
    q = select(ImportLog).where(ImportLog.user_id == user.id)
    if project_id:
        q = q.where(ImportLog.project_id == project_id)
    result = await db.execute(q.order_by(ImportLog.created_at.desc()).limit(20))
    return result.scalars().all()
