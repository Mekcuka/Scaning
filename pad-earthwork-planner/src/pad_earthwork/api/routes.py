"""HTTP routes."""

from fastapi import APIRouter, HTTPException

from pad_earthwork.compute import DemNotSupportedError, compute_pad_earthwork, preview_sketch
from pad_earthwork.schemas import (
    ComputeRequest,
    ComputeResponse,
    SketchPreviewRequest,
    SketchPreviewResponse,
)
from pad_earthwork.volume_profile import ProfileNotSupportedError

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
    except (DemNotSupportedError, ProfileNotSupportedError) as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc


@router.post("/v1/sketch/preview", response_model=SketchPreviewResponse)
def post_sketch_preview(body: SketchPreviewRequest) -> SketchPreviewResponse:
    try:
        return preview_sketch(body)
    except ProfileNotSupportedError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
