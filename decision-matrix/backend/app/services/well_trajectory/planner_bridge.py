"""Lazy import bridge to well-trajectory-planner (API starts without the package)."""

from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from well_trajectory.schemas import (
        ClearancePairsRequest,
        ClearancePairsResponse,
        ConnectorDesignRequest,
        ConnectorDesignResponse,
        PadGenerateFromLayoutRequest,
        PadGenerateFromLayoutResponse,
        SurveyInterpolateRequest,
        SurveyInterpolateResponse,
    )

_INSTALL_HINT = "pip install -e ../../../well-trajectory-planner"


@lru_cache(maxsize=1)
def _planner_modules() -> tuple[Any, Any, Any, Any, Any, Any, Any]:
    try:
        from well_trajectory import clearance as clearance_mod
        from well_trajectory import design as design_mod
        from well_trajectory import import_csv as import_csv_mod
        from well_trajectory import import_landmark as import_landmark_mod
        from well_trajectory import pad_seed as pad_seed_mod
        from well_trajectory import schemas as schemas_mod
        from well_trajectory import survey as survey_mod
    except ImportError as exc:
        raise RuntimeError(
            f"Пакет well-trajectory-planner не установлен. Выполните: {_INSTALL_HINT}"
        ) from exc
    return design_mod, survey_mod, pad_seed_mod, schemas_mod, clearance_mod, import_csv_mod, import_landmark_mod


def design_connector(request: ConnectorDesignRequest) -> ConnectorDesignResponse:
    design_mod, _, _, _, _, _, _ = _planner_modules()
    return design_mod.design_connector(request)


def design_horizontal(request: Any) -> Any:
    design_mod, _, _, _, _, _, _ = _planner_modules()
    return design_mod.design_horizontal(request)


def design_horizontal_at_offset(request: Any, offset_m: float) -> Any:
    design_mod, _, _, _, _, _, _ = _planner_modules()
    return design_mod.design_horizontal_at_offset(request, offset_m)


def gs_entry_search_offsets(heel: Any, toe: Any, step_m: float) -> list[float]:
    design_mod, _, _, _, _, _, _ = _planner_modules()
    return design_mod.gs_entry_search_offsets(heel, toe, step_m)


def gs_entry_endpoint_offsets(heel: Any, toe: Any) -> list[float]:
    design_mod, _, _, _, _, _, _ = _planner_modules()
    return design_mod.gs_entry_endpoint_offsets(heel, toe)


def interpolate_survey(request: SurveyInterpolateRequest) -> SurveyInterpolateResponse:
    _, survey_mod, _, _, _, _, _ = _planner_modules()
    return survey_mod.interpolate_survey(request)


def generate_from_pad_layout(request: PadGenerateFromLayoutRequest) -> PadGenerateFromLayoutResponse:
    _, _, pad_seed_mod, _, _, _, _ = _planner_modules()
    return pad_seed_mod.generate_from_pad_layout(request)


def clearance_pairs(request: ClearancePairsRequest) -> ClearancePairsResponse:
    _, _, _, _, clearance_mod, _, _ = _planner_modules()
    return clearance_mod.compute_clearance_pairs(request)


def import_csv(content: str) -> Any:
    _, _, _, schemas_mod, _, import_csv_mod, _ = _planner_modules()
    result = import_csv_mod.parse_csv(content)
    return schemas_mod.ImportParseResponse.model_validate(result.model_dump(mode="json"))


def import_wbp(data: bytes) -> Any:
    _, _, _, schemas_mod, _, _, import_landmark_mod = _planner_modules()
    result = import_landmark_mod.parse_wbp(data)
    return schemas_mod.ImportParseResponse.model_validate(result.model_dump(mode="json"))


def planner_schemas() -> Any:
    _, _, _, schemas_mod, _, _, _ = _planner_modules()
    return schemas_mod


@lru_cache(maxsize=1)
def _pywellgeo_service() -> Any:
    try:
        from well_trajectory import pywellgeo_service as svc
    except ImportError as exc:
        raise RuntimeError(
            f"Пакет well-trajectory-planner не установлен. Выполните: {_INSTALL_HINT}"
        ) from exc
    return svc


_PYWELLGEO_DISPATCH = {
    "tree_from_survey": lambda svc, payload: svc.tree_from_survey(
        __import__("well_trajectory.pywellgeo_schemas", fromlist=["TreeFromSurveyRequest"]).TreeFromSurveyRequest.model_validate(payload)
    ).model_dump(mode="json"),
    "tree_from_yaml": lambda svc, payload: svc.tree_from_yaml(
        __import__("well_trajectory.pywellgeo_schemas", fromlist=["TreeFromYamlRequest"]).TreeFromYamlRequest.model_validate(payload)
    ).model_dump(mode="json"),
    "tree_export_yaml": lambda svc, payload: svc.tree_export_yaml(
        __import__("well_trajectory.pywellgeo_schemas", fromlist=["TreeExportYamlRequest"]).TreeExportYamlRequest.model_validate(payload)
    ).model_dump(mode="json"),
    "tree_compute": lambda svc, payload: svc.tree_compute(
        __import__("well_trajectory.pywellgeo_schemas", fromlist=["TreeComputeRequest"]).TreeComputeRequest.model_validate(payload)
    ).model_dump(mode="json"),
    "tree_plot_data": lambda svc, payload: svc.tree_plot_data(
        __import__("well_trajectory.pywellgeo_schemas", fromlist=["TreePlotDataRequest"]).TreePlotDataRequest.model_validate(payload)
    ).model_dump(mode="json"),
    "tree_add_branch": lambda svc, payload: svc.tree_add_branch(
        __import__("well_trajectory.pywellgeo_schemas", fromlist=["TreeAddBranchRequest"]).TreeAddBranchRequest.model_validate(payload)
    ).model_dump(mode="json"),
    "tree_coarsen": lambda svc, payload: svc.tree_coarsen(
        __import__("well_trajectory.pywellgeo_schemas", fromlist=["TreeCoarsenRequest"]).TreeCoarsenRequest.model_validate(payload)
    ).model_dump(mode="json"),
    "tree_split_at_z": lambda svc, payload: svc.tree_split_at_z(
        __import__("well_trajectory.pywellgeo_schemas", fromlist=["TreeSplitAtZRequest"]).TreeSplitAtZRequest.model_validate(payload)
    ).model_dump(mode="json"),
    "azim_dip_convert": lambda svc, payload: svc.azim_dip_convert(
        __import__("well_trajectory.pywellgeo_schemas", fromlist=["AzimDipConvertRequest"]).AzimDipConvertRequest.model_validate(payload)
    ).model_dump(mode="json"),
    "thermal_init_soil": lambda svc, payload: svc.thermal_init_soil(
        __import__("well_trajectory.pywellgeo_schemas", fromlist=["ThermalInitSoilRequest"]).ThermalInitSoilRequest.model_validate(payload)
    ).model_dump(mode="json"),
    "water_properties": lambda svc, payload: svc.water_properties(
        __import__("well_trajectory.pywellgeo_schemas", fromlist=["WaterPropertiesRequest"]).WaterPropertiesRequest.model_validate(payload)
    ).model_dump(mode="json"),
    "dc1d_build": lambda svc, payload: svc.dc1d_build(
        __import__("well_trajectory.pywellgeo_schemas", fromlist=["Dc1dBuildRequest"]).Dc1dBuildRequest.model_validate(payload)
    ).model_dump(mode="json"),
    "coordinate_transform": lambda svc, payload: svc.coordinate_transform(
        __import__("well_trajectory.pywellgeo_schemas", fromlist=["CoordinateTransformRequest"]).CoordinateTransformRequest.model_validate(payload)
    ).model_dump(mode="json"),
}


def run_pywellgeo(operation: str, payload: dict[str, Any]) -> dict[str, Any]:
    svc = _pywellgeo_service()
    handler = _PYWELLGEO_DISPATCH.get(operation)
    if handler is None:
        raise ValueError(f"Unknown pywellgeo operation: {operation}")
    result = handler(svc, payload)
    if isinstance(result, dict):
        return result
    return dict(result)
