"""HTTP routes."""

from fastapi import APIRouter, File, HTTPException, Request, UploadFile

from well_trajectory.clearance import compute_clearance_pairs
from well_trajectory.design import design_connector, design_horizontal
from well_trajectory.import_csv import parse_csv
from well_trajectory.import_landmark import parse_wbp
from well_trajectory.import_witsml import WITSML_NOT_IMPLEMENTED_DETAIL
from well_trajectory.pad_seed import generate_from_pad_layout
from well_trajectory.schemas import (
    ClearancePairsRequest,
    ClearancePairsResponse,
    ConnectorDesignRequest,
    ConnectorDesignResponse,
    HorizontalDesignRequest,
    HorizontalDesignResponse,
    ImportCsvTextRequest,
    ImportParseResponse,
    PadGenerateFromLayoutRequest,
    PadGenerateFromLayoutResponse,
    SurveyInterpolateRequest,
    SurveyInterpolateResponse,
)
from well_trajectory.survey import interpolate_survey

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
def ready() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/v1/design/connector", response_model=ConnectorDesignResponse)
def post_design_connector(body: ConnectorDesignRequest) -> ConnectorDesignResponse:
    try:
        return design_connector(body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/v1/design/horizontal", response_model=HorizontalDesignResponse)
def post_design_horizontal(body: HorizontalDesignRequest) -> HorizontalDesignResponse:
    try:
        return design_horizontal(body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/v1/survey/interpolate", response_model=SurveyInterpolateResponse)
def post_survey_interpolate(body: SurveyInterpolateRequest) -> SurveyInterpolateResponse:
    try:
        return interpolate_survey(body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/v1/pad/generate-from-layout", response_model=PadGenerateFromLayoutResponse)
def post_pad_generate_from_layout(body: PadGenerateFromLayoutRequest) -> PadGenerateFromLayoutResponse:
    if not body.wells_local:
        raise HTTPException(status_code=400, detail="wells_local must not be empty")
    return generate_from_pad_layout(body)


@router.post("/v1/clearance/pairs", response_model=ClearancePairsResponse)
def post_clearance_pairs(body: ClearancePairsRequest) -> ClearancePairsResponse:
    try:
        return compute_clearance_pairs(body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/v1/import/csv", response_model=ImportParseResponse)
async def post_import_csv(request: Request) -> ImportParseResponse:
    content_type = (request.headers.get("content-type") or "").lower()
    if "application/json" in content_type:
        body = ImportCsvTextRequest.model_validate(await request.json())
        content = body.content
    else:
        raw = await request.body()
        content = raw.decode("utf-8", errors="replace")
    result = parse_csv(content)
    if not result.wells and result.errors:
        raise HTTPException(status_code=400, detail={"errors": result.errors})
    return result


@router.post("/v1/import/wbp", response_model=ImportParseResponse)
async def post_import_wbp(file: UploadFile = File(...)) -> ImportParseResponse:
    data = await file.read()
    result = parse_wbp(data)
    if not result.wells and result.errors:
        raise HTTPException(status_code=400, detail={"errors": result.errors})
    return result


@router.post("/v1/import/witsml")
async def post_import_witsml() -> None:
    raise HTTPException(status_code=501, detail=WITSML_NOT_IMPLEMENTED_DETAIL)
