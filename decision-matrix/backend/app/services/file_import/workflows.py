"""Shared sync/async import workflows for map API handlers."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ImportLog, InfrastructureLayer
from app.services.file_import.run import (
    create_pending_import_log,
    run_file_import,
    run_shapefile_import,
    schedule_import_via_job,
)


@dataclass(frozen=True)
class ImportUploadSpec:
    source_type: str
    layer_name: str
    default_filename: str
    format: str


CSV_IMPORT = ImportUploadSpec("csv_import", "Импорт CSV", "import.csv", "csv")
GEOJSON_IMPORT = ImportUploadSpec("geojson_import", "Импорт GeoJSON", "import.geojson", "geojson")
KML_IMPORT = ImportUploadSpec("kml_import", "Импорт KML", "import.kml", "kml")
SPARK_IMPORT = ImportUploadSpec("spark_import", "Импорт Искра", "export.json", "spark")
SHAPEFILE_IMPORT = ImportUploadSpec("shapefile_import", "Импорт SHP", "import.zip", "shapefile")


async def commit_sync_file_import(
    db: AsyncSession,
    *,
    user_id: UUID,
    project_id: UUID,
    layer: InfrastructureLayer,
    spec: ImportUploadSpec,
    content: str,
    file_name: str,
) -> ImportLog:
    log = await run_file_import(
        db,
        user_id=user_id,
        project_id=project_id,
        layer=layer,
        source_type=spec.source_type,
        file_name=file_name,
        content=content,
        format=spec.format,
    )
    await db.commit()
    await db.refresh(log)
    return log


async def commit_sync_shapefile_import(
    db: AsyncSession,
    *,
    user_id: UUID,
    project_id: UUID,
    layer: InfrastructureLayer,
    file_name: str,
    zip_bytes: bytes,
) -> ImportLog:
    log = await run_shapefile_import(
        db,
        user_id=user_id,
        project_id=project_id,
        layer=layer,
        file_name=file_name,
        zip_bytes=zip_bytes,
    )
    await db.commit()
    await db.refresh(log)
    return log


async def enqueue_async_file_import(
    db: AsyncSession,
    *,
    user_id: UUID,
    project_id: UUID,
    layer: InfrastructureLayer,
    spec: ImportUploadSpec,
    content: str,
    file_name: str,
) -> ImportLog:
    log = await create_pending_import_log(
        db,
        user_id=user_id,
        project_id=project_id,
        source_type=spec.source_type,
        file_name=file_name,
    )
    return await schedule_import_via_job(
        db,
        user_id=user_id,
        project_id=project_id,
        log=log,
        layer_id=layer.id,
        content=content,
        format=spec.format,
    )
