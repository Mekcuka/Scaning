"""PyWellGeo HTTP routes."""

from fastapi import APIRouter, HTTPException

from well_trajectory.pywellgeo_schemas import (
    AzimDipConvertRequest,
    AzimDipConvertResponse,
    CoordinateTransformRequest,
    CoordinateTransformResponse,
    Dc1dBuildRequest,
    Dc1dBuildResponse,
    ThermalInitSoilRequest,
    ThermalInitSoilResponse,
    TreeAddBranchRequest,
    TreeAddBranchResponse,
    TreeCoarsenRequest,
    TreeCoarsenResponse,
    TreeComputeRequest,
    TreeComputeResponse,
    TreeExportYamlRequest,
    TreeExportYamlResponse,
    TreeFromSurveyRequest,
    TreeFromSurveyResponse,
    TreeFromYamlRequest,
    TreeFromYamlResponse,
    TreePlotDataRequest,
    TreePlotDataResponse,
    TreeSplitAtZRequest,
    TreeSplitAtZResponse,
    WaterPropertiesRequest,
    WaterPropertiesResponse,
)
from well_trajectory.pywellgeo_service import (
    PyWellGeoNotAvailableError,
    azim_dip_convert,
    coordinate_transform,
    dc1d_build,
    thermal_init_soil,
    tree_add_branch,
    tree_coarsen,
    tree_compute,
    tree_export_yaml,
    tree_from_survey,
    tree_from_yaml,
    tree_plot_data,
    tree_split_at_z,
    water_properties,
)

router = APIRouter()


def _handle(exc: Exception) -> HTTPException:
    if isinstance(exc, PyWellGeoNotAvailableError):
        return HTTPException(status_code=503, detail=str(exc))
    if isinstance(exc, ValueError):
        return HTTPException(status_code=400, detail=str(exc))
    return HTTPException(status_code=500, detail=str(exc))


@router.post("/v1/pywellgeo/tree/from-survey", response_model=TreeFromSurveyResponse)
def post_tree_from_survey(body: TreeFromSurveyRequest) -> TreeFromSurveyResponse:
    try:
        return tree_from_survey(body)
    except Exception as exc:
        raise _handle(exc) from exc


@router.post("/v1/pywellgeo/tree/from-yaml", response_model=TreeFromYamlResponse)
def post_tree_from_yaml(body: TreeFromYamlRequest) -> TreeFromYamlResponse:
    try:
        return tree_from_yaml(body)
    except Exception as exc:
        raise _handle(exc) from exc


@router.post("/v1/pywellgeo/tree/export-yaml", response_model=TreeExportYamlResponse)
def post_tree_export_yaml(body: TreeExportYamlRequest) -> TreeExportYamlResponse:
    try:
        return tree_export_yaml(body)
    except Exception as exc:
        raise _handle(exc) from exc


@router.post("/v1/pywellgeo/tree/compute", response_model=TreeComputeResponse)
def post_tree_compute(body: TreeComputeRequest) -> TreeComputeResponse:
    try:
        return tree_compute(body)
    except Exception as exc:
        raise _handle(exc) from exc


@router.post("/v1/pywellgeo/tree/plot-data", response_model=TreePlotDataResponse)
def post_tree_plot_data(body: TreePlotDataRequest) -> TreePlotDataResponse:
    try:
        return tree_plot_data(body)
    except Exception as exc:
        raise _handle(exc) from exc


@router.post("/v1/pywellgeo/tree/add-branch", response_model=TreeAddBranchResponse)
def post_tree_add_branch(body: TreeAddBranchRequest) -> TreeAddBranchResponse:
    try:
        return tree_add_branch(body)
    except Exception as exc:
        raise _handle(exc) from exc


@router.post("/v1/pywellgeo/tree/coarsen", response_model=TreeCoarsenResponse)
def post_tree_coarsen(body: TreeCoarsenRequest) -> TreeCoarsenResponse:
    try:
        return tree_coarsen(body)
    except Exception as exc:
        raise _handle(exc) from exc


@router.post("/v1/pywellgeo/tree/split-at-z", response_model=TreeSplitAtZResponse)
def post_tree_split_at_z(body: TreeSplitAtZRequest) -> TreeSplitAtZResponse:
    try:
        return tree_split_at_z(body)
    except Exception as exc:
        raise _handle(exc) from exc


@router.post("/v1/pywellgeo/azim-dip/convert", response_model=AzimDipConvertResponse)
def post_azim_dip_convert(body: AzimDipConvertRequest) -> AzimDipConvertResponse:
    try:
        return azim_dip_convert(body)
    except Exception as exc:
        raise _handle(exc) from exc


@router.post("/v1/pywellgeo/thermal/init-soil", response_model=ThermalInitSoilResponse)
def post_thermal_init_soil(body: ThermalInitSoilRequest) -> ThermalInitSoilResponse:
    try:
        return thermal_init_soil(body)
    except Exception as exc:
        raise _handle(exc) from exc


@router.post("/v1/pywellgeo/water/properties", response_model=WaterPropertiesResponse)
def post_water_properties(body: WaterPropertiesRequest) -> WaterPropertiesResponse:
    try:
        return water_properties(body)
    except Exception as exc:
        raise _handle(exc) from exc


@router.post("/v1/pywellgeo/dc1d/build", response_model=Dc1dBuildResponse)
def post_dc1d_build(body: Dc1dBuildRequest) -> Dc1dBuildResponse:
    try:
        return dc1d_build(body)
    except Exception as exc:
        raise _handle(exc) from exc


@router.post("/v1/pywellgeo/coordinate/transform", response_model=CoordinateTransformResponse)
def post_coordinate_transform(body: CoordinateTransformRequest) -> CoordinateTransformResponse:
    try:
        return coordinate_transform(body)
    except Exception as exc:
        raise _handle(exc) from exc
