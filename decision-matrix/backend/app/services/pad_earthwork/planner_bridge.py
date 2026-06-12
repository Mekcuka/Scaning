"""Lazy import bridge to pad-earthwork-planner (API starts without the package)."""

from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from pad_earthwork.schemas import ComputeRequest, ComputeResponse

_INSTALL_HINT = "pip install -e ../../../pad-earthwork-planner"


@lru_cache(maxsize=1)
def _planner_modules() -> tuple[Any, Any]:
    try:
        from pad_earthwork import compute as compute_mod
        from pad_earthwork import schemas as schemas_mod
    except ImportError as exc:
        raise RuntimeError(
            f"Пакет pad-earthwork-planner не установлен. Выполните: {_INSTALL_HINT}"
        ) from exc
    return compute_mod, schemas_mod


def compute_pad_earthwork(request: ComputeRequest) -> ComputeResponse:
    compute_mod, _ = _planner_modules()
    return compute_mod.compute_pad_earthwork(request)


def dem_not_supported_error() -> type[Exception]:
    compute_mod, _ = _planner_modules()
    return compute_mod.DemNotSupportedError


def preview_sketch_request(body: object) -> object:
    compute_mod, schemas_mod = _planner_modules()
    req = schemas_mod.SketchPreviewRequest.model_validate(body)
    return compute_mod.preview_sketch(req)


def generate_sketch_from_wells_request(body: object) -> object:
    from pad_earthwork.well_layout import (
        PadLayoutMargins,
        WellLayoutParams,
        WellLayoutValidationError,
        generate_pad_polygon_from_wells,
    )

    schemas_mod = planner_schemas()
    req = schemas_mod.WellLayoutGenerateRequest.model_validate(body)
    params = WellLayoutParams(
        well_count=req.well_count,
        wells_per_group=req.wells_per_group,
        well_spacing_m=req.well_spacing_m,
        group_spacing_m=req.group_spacing_m,
        margins=PadLayoutMargins.model_validate(req.margins.model_dump()),
        rotation_deg=req.rotation_deg,
    )
    try:
        return generate_pad_polygon_from_wells(params)
    except WellLayoutValidationError as exc:
        raise ValueError(str(exc)) from exc


def planner_schemas() -> Any:
    _, schemas_mod = _planner_modules()
    return schemas_mod
