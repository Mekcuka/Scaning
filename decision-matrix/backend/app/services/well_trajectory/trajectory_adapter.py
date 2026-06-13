"""In-process and HTTP adapters for well-trajectory-planner."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import httpx

from app.core.config import settings
from app.services.well_trajectory.planner_bridge import (
    clearance_pairs,
    design_connector,
    design_horizontal,
    generate_from_pad_layout,
    import_csv,
    import_wbp,
    interpolate_survey,
)

if TYPE_CHECKING:
    from well_trajectory.schemas import (
        ClearancePairsRequest,
        ClearancePairsResponse,
        ConnectorDesignRequest,
        ConnectorDesignResponse,
        HorizontalDesignRequest,
        HorizontalDesignResponse,
        PadGenerateFromLayoutRequest,
        PadGenerateFromLayoutResponse,
        SurveyInterpolateRequest,
        SurveyInterpolateResponse,
    )
    ImportParseResponse = Any

logger = logging.getLogger(__name__)


class InProcessWellTrajectoryAdapter:
    def design_connector(self, request: ConnectorDesignRequest) -> ConnectorDesignResponse:
        return design_connector(request)

    def design_horizontal(self, request: HorizontalDesignRequest) -> HorizontalDesignResponse:
        return design_horizontal(request)

    def interpolate_survey(self, request: SurveyInterpolateRequest) -> SurveyInterpolateResponse:
        return interpolate_survey(request)

    def generate_from_pad_layout(
        self, request: PadGenerateFromLayoutRequest
    ) -> PadGenerateFromLayoutResponse:
        return generate_from_pad_layout(request)

    def clearance_pairs(self, request: ClearancePairsRequest) -> ClearancePairsResponse:
        return clearance_pairs(request)

    def import_csv(self, content: str) -> ImportParseResponse:
        return import_csv(content)

    def import_wbp(self, data: bytes) -> ImportParseResponse:
        return import_wbp(data)


class HttpWellTrajectoryAdapter:
    def __init__(self, base_url: str) -> None:
        self._base_url = base_url.rstrip("/")

    def design_connector(self, request: ConnectorDesignRequest) -> ConnectorDesignResponse:
        schemas = __import__("well_trajectory.schemas", fromlist=["ConnectorDesignResponse"])
        ConnectorDesignResponse = schemas.ConnectorDesignResponse
        url = f"{self._base_url}/v1/design/connector"
        with httpx.Client(timeout=120.0) as client:
            res = client.post(url, json=request.model_dump(mode="json"))
            res.raise_for_status()
            return ConnectorDesignResponse.model_validate(res.json())

    def design_horizontal(self, request: HorizontalDesignRequest) -> HorizontalDesignResponse:
        schemas = __import__("well_trajectory.schemas", fromlist=["HorizontalDesignResponse"])
        HorizontalDesignResponse = schemas.HorizontalDesignResponse
        url = f"{self._base_url}/v1/design/horizontal"
        with httpx.Client(timeout=120.0) as client:
            res = client.post(url, json=request.model_dump(mode="json"))
            res.raise_for_status()
            return HorizontalDesignResponse.model_validate(res.json())

    def interpolate_survey(self, request: SurveyInterpolateRequest) -> SurveyInterpolateResponse:
        schemas = __import__("well_trajectory.schemas", fromlist=["SurveyInterpolateResponse"])
        SurveyInterpolateResponse = schemas.SurveyInterpolateResponse
        url = f"{self._base_url}/v1/survey/interpolate"
        with httpx.Client(timeout=120.0) as client:
            res = client.post(url, json=request.model_dump(mode="json"))
            res.raise_for_status()
            return SurveyInterpolateResponse.model_validate(res.json())

    def generate_from_pad_layout(
        self, request: PadGenerateFromLayoutRequest
    ) -> PadGenerateFromLayoutResponse:
        schemas = __import__("well_trajectory.schemas", fromlist=["PadGenerateFromLayoutResponse"])
        PadGenerateFromLayoutResponse = schemas.PadGenerateFromLayoutResponse
        url = f"{self._base_url}/v1/pad/generate-from-layout"
        with httpx.Client(timeout=120.0) as client:
            res = client.post(url, json=request.model_dump(mode="json"))
            res.raise_for_status()
            return PadGenerateFromLayoutResponse.model_validate(res.json())

    def clearance_pairs(self, request: ClearancePairsRequest) -> ClearancePairsResponse:
        schemas = __import__("well_trajectory.schemas", fromlist=["ClearancePairsResponse"])
        ClearancePairsResponse = schemas.ClearancePairsResponse
        url = f"{self._base_url}/v1/clearance/pairs"
        with httpx.Client(timeout=120.0) as client:
            res = client.post(url, json=request.model_dump(mode="json"))
            res.raise_for_status()
            return ClearancePairsResponse.model_validate(res.json())

    def import_csv(self, content: str) -> ImportParseResponse:
        schemas = __import__("well_trajectory.schemas", fromlist=["ImportParseResponse"])
        ImportParseResponse = schemas.ImportParseResponse
        url = f"{self._base_url}/v1/import/csv"
        with httpx.Client(timeout=120.0) as client:
            res = client.post(url, json={"content": content})
            res.raise_for_status()
            return ImportParseResponse.model_validate(res.json())

    def import_wbp(self, data: bytes) -> ImportParseResponse:
        schemas = __import__("well_trajectory.schemas", fromlist=["ImportParseResponse"])
        ImportParseResponse = schemas.ImportParseResponse
        url = f"{self._base_url}/v1/import/wbp"
        with httpx.Client(timeout=120.0) as client:
            res = client.post(url, files={"file": ("survey.wbp", data, "application/octet-stream")})
            res.raise_for_status()
            return ImportParseResponse.model_validate(res.json())


def get_well_trajectory_adapter() -> InProcessWellTrajectoryAdapter | HttpWellTrajectoryAdapter:
    service_url = settings.WELL_TRAJECTORY_SERVICE_URL.strip()
    if service_url:
        return HttpWellTrajectoryAdapter(service_url)
    if settings.WELL_TRAJECTORY_INPROCESS:
        return InProcessWellTrajectoryAdapter()
    raise RuntimeError(
        "Well trajectory disabled: set WELL_TRAJECTORY_INPROCESS=true or WELL_TRAJECTORY_SERVICE_URL"
    )
