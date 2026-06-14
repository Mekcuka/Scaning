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
