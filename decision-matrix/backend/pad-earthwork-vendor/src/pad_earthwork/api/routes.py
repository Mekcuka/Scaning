"""HTTP routes."""

from fastapi import APIRouter, HTTPException

from pad_earthwork.compute import DemNotSupportedError, compute_pad_earthwork, preview_sketch
from pad_earthwork.schemas import (
    ComputeRequest,
    ComputeResponse,
    SketchPreviewRequest,
    SketchPreviewResponse,
    WellLayoutGenerateRequest,
    WellLayoutGenerateResponse,
)
from pad_earthwork.well_layout import (
    PadLayoutMargins,
    WellLayoutParams,
    WellLayoutValidationError,
    generate_pad_polygon_from_wells,
)

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
def ready() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/v1/compute", response_model=ComputeResponse)
def post_compute(body: ComputeRequest) -> ComputeResponse:
    try:
        return compute_pad_earthwork(body)
    except DemNotSupportedError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc


@router.post("/v1/sketch/preview", response_model=SketchPreviewResponse)
def post_sketch_preview(body: SketchPreviewRequest) -> SketchPreviewResponse:
    try:
        return preview_sketch(body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/v1/sketch/generate-from-wells", response_model=WellLayoutGenerateResponse)
def post_sketch_generate_from_wells(body: WellLayoutGenerateRequest) -> WellLayoutGenerateResponse:
    try:
        params = WellLayoutParams(
            well_count=body.well_count,
            wells_per_group=body.wells_per_group,
            well_spacing_m=body.well_spacing_m,
            group_spacing_m=body.group_spacing_m,
            margins=PadLayoutMargins.model_validate(body.margins.model_dump()),
            rotation_deg=body.rotation_deg,
        )
        return generate_pad_polygon_from_wells(params)
    except WellLayoutValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
