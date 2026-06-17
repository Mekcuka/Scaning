"""PyWellGeo BFF for pad infrastructure objects."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.compute_rate_limit import ComputeRateLimitDep
from app.core.database import get_db
from app.models import User
from app.services.well_trajectory.pywellgeo_handlers import (
    handle_add_branch,
    handle_apply_geometry,
    handle_azim_dip,
    handle_coarsen,
    handle_compute,
    handle_coordinate_transform,
    handle_dc1d_build,
    handle_plot_data,
    handle_plot_data_post,
    handle_pywellgeo_get_last,
    handle_pywellgeo_put_trees,
    handle_split_at_z,
    handle_sync_from_survey,
    handle_water_properties,
    handle_yaml_export,
    handle_yaml_import,
    handle_yaml_import_file,
)
from app.services.well_trajectory.pywellgeo_schemas import (
    PyWellGeoAddBranchRequest,
    PyWellGeoAddBranchResponse,
    PyWellGeoApplyGeometryRequest,
    PyWellGeoApplyGeometryResponse,
    PyWellGeoAzimDipRequest,
    PyWellGeoAzimDipResponse,
    PyWellGeoCoarsenRequest,
    PyWellGeoCoarsenResponse,
    PyWellGeoComputeRequest,
    PyWellGeoComputeResponse,
    PyWellGeoCoordinateTransformRequest,
    PyWellGeoDc1dBuildRequest,
    PyWellGeoLastResponse,
    PyWellGeoPlotDataRequest,
    PyWellGeoPlotDataResponse,
    PyWellGeoSplitAtZRequest,
    PyWellGeoSplitAtZResponse,
    PyWellGeoSyncFromSurveyRequest,
    PyWellGeoSyncFromSurveyResponse,
    PyWellGeoTreeRecord,
    PyWellGeoTreesPutRequest,
    PyWellGeoWaterPropertiesRequest,
    PyWellGeoWaterPropertiesResponse,
    PyWellGeoYamlExportRequest,
    PyWellGeoYamlExportResponse,
    PyWellGeoYamlImportRequest,
)

pywellgeo_router = APIRouter(tags=["pywellgeo"])


@pywellgeo_router.get(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pywellgeo/last",
    response_model=PyWellGeoLastResponse,
)
async def get_pywellgeo_last(
    project_id: UUID,
    object_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PyWellGeoLastResponse:
    return await handle_pywellgeo_get_last(project_id, object_id, user, db)


@pywellgeo_router.put(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pywellgeo/trees",
    response_model=PyWellGeoLastResponse,
)
async def put_pywellgeo_trees(
    project_id: UUID,
    object_id: UUID,
    body: PyWellGeoTreesPutRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PyWellGeoLastResponse:
    return await handle_pywellgeo_put_trees(project_id, object_id, body, user, db)


@pywellgeo_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pywellgeo/sync-from-survey",
    response_model=PyWellGeoSyncFromSurveyResponse,
)
async def post_pywellgeo_sync_from_survey(
    project_id: UUID,
    object_id: UUID,
    body: PyWellGeoSyncFromSurveyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PyWellGeoSyncFromSurveyResponse:
    return await handle_sync_from_survey(project_id, object_id, body, user, db)


@pywellgeo_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pywellgeo/compute",
    response_model=PyWellGeoComputeResponse,
)
async def post_pywellgeo_compute(
    project_id: UUID,
    object_id: UUID,
    body: PyWellGeoComputeRequest,
    _rate: ComputeRateLimitDep,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PyWellGeoComputeResponse:
    return await handle_compute(project_id, object_id, body, user, db)


@pywellgeo_router.get(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pywellgeo/plot-data",
    response_model=PyWellGeoPlotDataResponse,
)
async def get_pywellgeo_plot_data(
    project_id: UUID,
    object_id: UUID,
    well_index: int = Query(ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PyWellGeoPlotDataResponse:
    return await handle_plot_data(project_id, object_id, well_index, user, db)


@pywellgeo_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pywellgeo/plot-data",
    response_model=PyWellGeoPlotDataResponse,
)
async def post_pywellgeo_plot_data(
    project_id: UUID,
    object_id: UUID,
    body: PyWellGeoPlotDataRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PyWellGeoPlotDataResponse:
    return await handle_plot_data_post(project_id, object_id, body, user, db)


@pywellgeo_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pywellgeo/tree/add-branch",
    response_model=PyWellGeoAddBranchResponse,
)
async def post_pywellgeo_add_branch(
    project_id: UUID,
    object_id: UUID,
    body: PyWellGeoAddBranchRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_add_branch(project_id, object_id, body, user, db)


@pywellgeo_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pywellgeo/tree/coarsen",
    response_model=PyWellGeoCoarsenResponse,
)
async def post_pywellgeo_coarsen(
    project_id: UUID,
    object_id: UUID,
    body: PyWellGeoCoarsenRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PyWellGeoCoarsenResponse:
    return await handle_coarsen(project_id, object_id, body, user, db)


@pywellgeo_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pywellgeo/tree/split-at-z",
    response_model=PyWellGeoSplitAtZResponse,
)
async def post_pywellgeo_split_at_z(
    project_id: UUID,
    object_id: UUID,
    body: PyWellGeoSplitAtZRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PyWellGeoSplitAtZResponse:
    return await handle_split_at_z(project_id, object_id, body, user, db)


@pywellgeo_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pywellgeo/apply-to-geometry",
    response_model=PyWellGeoApplyGeometryResponse,
)
async def post_pywellgeo_apply_geometry(
    project_id: UUID,
    object_id: UUID,
    body: PyWellGeoApplyGeometryRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PyWellGeoApplyGeometryResponse:
    return await handle_apply_geometry(project_id, object_id, body, user, db)


@pywellgeo_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pywellgeo/yaml/import",
    response_model=PyWellGeoTreeRecord,
)
async def post_pywellgeo_yaml_import(
    project_id: UUID,
    object_id: UUID,
    body: PyWellGeoYamlImportRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PyWellGeoTreeRecord:
    return await handle_yaml_import(project_id, object_id, body, user, db)


@pywellgeo_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pywellgeo/yaml/import-file",
    response_model=PyWellGeoTreeRecord,
)
async def post_pywellgeo_yaml_import_file(
    project_id: UUID,
    object_id: UUID,
    well_index: int = Query(default=0, ge=0),
    format: str = Query(default="AUTO", alias="format"),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PyWellGeoTreeRecord:
    return await handle_yaml_import_file(project_id, object_id, well_index, format, file, user, db)


@pywellgeo_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pywellgeo/yaml/export",
    response_model=PyWellGeoYamlExportResponse,
)
async def post_pywellgeo_yaml_export(
    project_id: UUID,
    object_id: UUID,
    body: PyWellGeoYamlExportRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PyWellGeoYamlExportResponse:
    return await handle_yaml_export(project_id, object_id, body, user, db)


@pywellgeo_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pywellgeo/azim-dip/convert",
    response_model=PyWellGeoAzimDipResponse,
)
async def post_pywellgeo_azim_dip(
    project_id: UUID,
    object_id: UUID,
    body: PyWellGeoAzimDipRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PyWellGeoAzimDipResponse:
    return await handle_azim_dip(project_id, object_id, body, user, db)


@pywellgeo_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pywellgeo/water/properties",
    response_model=PyWellGeoWaterPropertiesResponse,
)
async def post_pywellgeo_water_properties(
    project_id: UUID,
    object_id: UUID,
    body: PyWellGeoWaterPropertiesRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PyWellGeoWaterPropertiesResponse:
    return await handle_water_properties(project_id, object_id, body, user, db)


@pywellgeo_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pywellgeo/dc1d/build",
    response_model=PyWellGeoTreeRecord,
)
async def post_pywellgeo_dc1d_build(
    project_id: UUID,
    object_id: UUID,
    body: PyWellGeoDc1dBuildRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PyWellGeoTreeRecord:
    return await handle_dc1d_build(project_id, object_id, body, user, db)


@pywellgeo_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pywellgeo/coordinate/transform",
)
async def post_pywellgeo_coordinate_transform(
    project_id: UUID,
    object_id: UUID,
    body: PyWellGeoCoordinateTransformRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await handle_coordinate_transform(project_id, object_id, body, user, db)
