"""Import orchestration: logs, async jobs, file runs."""

from __future__ import annotations

import asyncio
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session
from app.models import ImportLog, InfrastructureLayer
from app.services.file_import.geojson_parser import parse_geojson
from app.services.file_import.parse import parse_import_content
from app.services.file_import.persist import import_rows_to_layer
from app.services.file_import.shapefile import shapefile_zip_to_geojson_bytes


async def run_file_import(
    db: AsyncSession,
    *,
    user_id: UUID,
    project_id: UUID,
    layer: InfrastructureLayer,
    source_type: str,
    file_name: str,
    content: str,
    format: str,
) -> ImportLog:
    rows, errors = parse_import_content(content, format)

    log = ImportLog(
        user_id=user_id,
        project_id=project_id,
        source_type=source_type,
        file_name=file_name,
        status="processing",
        records_total=len(rows) + len(errors),
        records_imported=0,
        errors=errors,
    )
    db.add(log)
    await db.flush()

    imported = 0
    import_errors: list[str] = []
    if rows:
        imported, import_errors = await import_rows_to_layer(
            db,
            layer,
            rows,
            build_network=True,
            skip_line_endpoint_validation=(format == "spark"),
        )
    if import_errors:
        log.errors = [*errors, *import_errors]
    log.records_imported = imported
    log.status = "completed" if not log.errors else ("completed" if imported else "failed")
    if log.errors and imported:
        log.status = "completed"
    await db.flush()
    return log


async def create_pending_import_log(
    db: AsyncSession,
    *,
    user_id: UUID,
    project_id: UUID,
    source_type: str,
    file_name: str,
) -> ImportLog:
    log = ImportLog(
        user_id=user_id,
        project_id=project_id,
        source_type=source_type,
        file_name=file_name,
        status="pending",
        records_total=0,
        records_imported=0,
        errors=[],
    )
    db.add(log)
    await db.flush()
    return log


async def process_import_log(
    log_id: UUID,
    *,
    layer_id: UUID,
    content: str,
    format: str,
) -> None:
    async with async_session() as db:
        log = await db.get(ImportLog, log_id)
        if not log:
            return
        layer = await db.get(InfrastructureLayer, layer_id)
        if not layer:
            log.status = "failed"
            log.errors = ["Layer not found"]
            await db.commit()
            return
        log.status = "running"
        await db.commit()

        rows, errors = parse_import_content(content, format)

        log.records_total = len(rows) + len(errors)
        log.errors = errors
        imported = 0
        import_errors: list[str] = []
        if rows:
            imported, import_errors = await import_rows_to_layer(
                db,
                layer,
                rows,
                build_network=True,
                skip_line_endpoint_validation=(format == "spark"),
            )
        if import_errors:
            log.errors = [*errors, *import_errors]
        log.records_imported = imported
        log.status = "completed" if imported or not log.errors else "failed"
        if log.errors and imported:
            log.status = "completed"
        await db.commit()


def schedule_async_import(log_id: UUID, *, layer_id: UUID, content: str, format: str) -> None:
    """Deprecated: use schedule_import_via_job."""
    asyncio.create_task(process_import_log(log_id, layer_id=layer_id, content=content, format=format))


async def schedule_import_via_job(
    db: AsyncSession,
    *,
    user_id: UUID,
    project_id: UUID,
    log: ImportLog,
    layer_id: UUID,
    content: str,
    format: str,
) -> ImportLog:
    from app.services.job_enqueue import commit_and_schedule, create_and_schedule_job, jobs_async_enabled
    from app.services.project_jobs import JOB_TYPE_IMPORT_FILE, ActiveProjectJobError

    if not jobs_async_enabled():
        await db.commit()
        await db.refresh(log)
        schedule_async_import(log.id, layer_id=layer_id, content=content, format=format)
        return log

    try:
        job = await create_and_schedule_job(
            db,
            project_id=project_id,
            user_id=user_id,
            job_type=JOB_TYPE_IMPORT_FILE,
            payload={
                "log_id": str(log.id),
                "layer_id": str(layer_id),
                "format": format,
                "content": content,
            },
        )
        log.project_job_id = job.id
        await commit_and_schedule(db, job)
        await db.refresh(log)
        return log
    except ActiveProjectJobError:
        raise


async def run_shapefile_import(
    db: AsyncSession,
    *,
    user_id: UUID,
    project_id: UUID,
    layer: InfrastructureLayer,
    file_name: str,
    zip_bytes: bytes,
) -> ImportLog:
    geojson, err = shapefile_zip_to_geojson_bytes(zip_bytes)
    log = ImportLog(
        user_id=user_id,
        project_id=project_id,
        source_type="shapefile_import",
        file_name=file_name,
        status="processing",
        records_total=0,
        records_imported=0,
        errors=[err] if err else [],
    )
    db.add(log)
    await db.flush()
    if err or not geojson:
        log.status = "failed"
        await db.flush()
        return log
    rows, errors = parse_geojson(geojson)
    log.errors = errors
    log.records_total = len(rows) + len(errors)
    imported = 0
    import_errors: list[str] = []
    if rows:
        imported, import_errors = await import_rows_to_layer(db, layer, rows)
    if import_errors:
        log.errors = [*errors, *import_errors]
    log.records_imported = imported
    log.status = "completed" if imported else "failed"
    await db.flush()
    return log
