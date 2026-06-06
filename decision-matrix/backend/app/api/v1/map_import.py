"""File import endpoints (CSV, GeoJSON, KML, shapefile, spark)."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import JSONResponse
from sqlalchemy import cast, delete, or_, select, String, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.map_deps import (
    get_infra_object,
    get_layer,
    get_or_create_default_layer,
    get_poi,
    get_user_project,
    require_infra_write,
    require_project_write,
)
from app.core.database import get_db
from app.models import User

from app.models import ImportLog
from app.schemas import ImportLogResponse, ImportPreviewResponse
from app.services.import_service import (
    create_pending_import_log,
    detect_import_format,
    parse_import_content,
    run_file_import,
    run_shapefile_import,
    schedule_import_via_job,
)

import_router = APIRouter(tags=["map-import"])

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
    name = (file.filename or "").lower()
    if format == "kml" or name.endswith((".kml", ".kmz")):
        if name.endswith(".kmz"):
            import io
            import zipfile

            with zipfile.ZipFile(io.BytesIO(raw)) as zf:
                kml_names = [n for n in zf.namelist() if n.lower().endswith(".kml")]
                content = zf.read(kml_names[0]).decode("utf-8", errors="replace") if kml_names else ""
            fmt = "kml"
        else:
            content = raw.decode("utf-8", errors="replace")
            fmt = "kml"
    elif format in ("geojson", "spark") or name.endswith((".geojson", ".json")):
        content = raw.decode("utf-8", errors="replace")
        fmt = format if format == "spark" else detect_import_format(content, name)
    else:
        content = raw.decode("utf-8-sig")
        fmt = "csv"
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
    content = (await file.read()).decode("utf-8-sig")
    layer = await get_or_create_default_layer(project_id, db, source_type="csv_import", name="Импорт CSV")
    log = await run_file_import(
        db,
        user_id=user.id,
        project_id=project_id,
        layer=layer,
        source_type="csv_import",
        file_name=file.filename or "import.csv",
        content=content,
        format="csv",
    )
    await db.commit()
    await db.refresh(log)
    return log


@import_router.post("/projects/{project_id}/import/csv/async", response_model=ImportLogResponse, status_code=202)
async def import_csv_async(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    await require_infra_write(project_id, user, db)
    content = (await file.read()).decode("utf-8-sig")
    layer = await get_or_create_default_layer(project_id, db, source_type="csv_import", name="Импорт CSV")
    log = await create_pending_import_log(
        db,
        user_id=user.id,
        project_id=project_id,
        source_type="csv_import",
        file_name=file.filename or "import.csv",
    )
    from app.services.project_jobs import ActiveProjectJobError

    try:
        return await schedule_import_via_job(
            db,
            user_id=user.id,
            project_id=project_id,
            log=log,
            layer_id=layer.id,
            content=content,
            format="csv",
        )
    except ActiveProjectJobError as e:
        raise HTTPException(
            status_code=409,
            detail={"message": "Project already has an active job", "active_job_id": str(e.active_job_id)},
        ) from e


@import_router.post("/projects/{project_id}/import/kml", response_model=ImportLogResponse)
async def import_kml(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    await require_infra_write(project_id, user, db)
    raw = await file.read()
    name = (file.filename or "import.kml").lower()
    if name.endswith(".kmz"):
        import zipfile
        import io

        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            kml_names = [n for n in zf.namelist() if n.lower().endswith(".kml")]
            if not kml_names:
                raise HTTPException(status_code=400, detail="KMZ contains no KML")
            content = zf.read(kml_names[0]).decode("utf-8", errors="replace")
    else:
        content = raw.decode("utf-8", errors="replace")
    layer = await get_or_create_default_layer(project_id, db, source_type="kml_import", name="Импорт KML")
    log = await run_file_import(
        db,
        user_id=user.id,
        project_id=project_id,
        layer=layer,
        source_type="kml_import",
        file_name=file.filename or "import.kml",
        content=content,
        format="kml",
    )
    await db.commit()
    await db.refresh(log)
    return log


@import_router.post("/projects/{project_id}/import/shapefile", response_model=ImportLogResponse)
async def import_shapefile(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    await require_infra_write(project_id, user, db)
    data = await file.read()
    layer = await get_or_create_default_layer(project_id, db, source_type="shapefile_import", name="Импорт SHP")
    log = await run_shapefile_import(
        db,
        user_id=user.id,
        project_id=project_id,
        layer=layer,
        file_name=file.filename or "import.zip",
        zip_bytes=data,
    )
    await db.commit()
    await db.refresh(log)
    return log


@import_router.post("/projects/{project_id}/import/geojson", response_model=ImportLogResponse)
async def import_geojson(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    await require_infra_write(project_id, user, db)
    content = (await file.read()).decode("utf-8")
    layer = await get_or_create_default_layer(project_id, db, source_type="geojson_import", name="Импорт GeoJSON")
    log = await run_file_import(
        db,
        user_id=user.id,
        project_id=project_id,
        layer=layer,
        source_type="geojson_import",
        file_name=file.filename or "import.geojson",
        content=content,
        format="geojson",
    )
    await db.commit()
    await db.refresh(log)
    return log


@import_router.post("/projects/{project_id}/import/geojson/async", response_model=ImportLogResponse, status_code=202)
async def import_geojson_async(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    await require_infra_write(project_id, user, db)
    content = (await file.read()).decode("utf-8")
    layer = await get_or_create_default_layer(project_id, db, source_type="geojson_import", name="Импорт GeoJSON")
    log = await create_pending_import_log(
        db,
        user_id=user.id,
        project_id=project_id,
        source_type="geojson_import",
        file_name=file.filename or "import.geojson",
    )
    from app.services.project_jobs import ActiveProjectJobError

    try:
        return await schedule_import_via_job(
            db,
            user_id=user.id,
            project_id=project_id,
            log=log,
            layer_id=layer.id,
            content=content,
            format="geojson",
        )
    except ActiveProjectJobError as e:
        raise HTTPException(
            status_code=409,
            detail={"message": "Project already has an active job", "active_job_id": str(e.active_job_id)},
        ) from e


@import_router.post("/projects/{project_id}/import/kml/async", response_model=ImportLogResponse, status_code=202)
async def import_kml_async(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    await require_infra_write(project_id, user, db)
    raw = await file.read()
    name = (file.filename or "import.kml").lower()
    if name.endswith(".kmz"):
        import io
        import zipfile

        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            kml_names = [n for n in zf.namelist() if n.lower().endswith(".kml")]
            content = zf.read(kml_names[0]).decode("utf-8", errors="replace") if kml_names else ""
    else:
        content = raw.decode("utf-8", errors="replace")
    layer = await get_or_create_default_layer(project_id, db, source_type="kml_import", name="Импорт KML")
    log = await create_pending_import_log(
        db,
        user_id=user.id,
        project_id=project_id,
        source_type="kml_import",
        file_name=file.filename or "import.kml",
    )
    from app.services.project_jobs import ActiveProjectJobError

    try:
        return await schedule_import_via_job(
            db,
            user_id=user.id,
            project_id=project_id,
            log=log,
            layer_id=layer.id,
            content=content,
            format="kml",
        )
    except ActiveProjectJobError as e:
        raise HTTPException(
            status_code=409,
            detail={"message": "Project already has an active job", "active_job_id": str(e.active_job_id)},
        ) from e


@import_router.post("/projects/{project_id}/import/spark", response_model=ImportLogResponse)
async def import_spark(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    await require_infra_write(project_id, user, db)
    content = (await file.read()).decode("utf-8")
    layer = await get_or_create_default_layer(project_id, db, source_type="spark_import", name="Импорт Искра")
    log = await run_file_import(
        db,
        user_id=user.id,
        project_id=project_id,
        layer=layer,
        source_type="spark_import",
        file_name=file.filename or "export.json",
        content=content,
        format="spark",
    )
    await db.commit()
    await db.refresh(log)
    return log


@import_router.post("/projects/{project_id}/import/spark/async", response_model=ImportLogResponse, status_code=202)
async def import_spark_async(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    await require_infra_write(project_id, user, db)
    content = (await file.read()).decode("utf-8")
    layer = await get_or_create_default_layer(project_id, db, source_type="spark_import", name="Импорт Искра")
    log = await create_pending_import_log(
        db,
        user_id=user.id,
        project_id=project_id,
        source_type="spark_import",
        file_name=file.filename or "export.json",
    )
    from app.services.project_jobs import ActiveProjectJobError

    try:
        return await schedule_import_via_job(
            db,
            user_id=user.id,
            project_id=project_id,
            log=log,
            layer_id=layer.id,
            content=content,
            format="spark",
        )
    except ActiveProjectJobError as e:
        raise HTTPException(
            status_code=409,
            detail={"message": "Project already has an active job", "active_job_id": str(e.active_job_id)},
        ) from e


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
