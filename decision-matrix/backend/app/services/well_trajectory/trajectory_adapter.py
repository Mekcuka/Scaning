"""In-process and HTTP adapters for well-trajectory-planner."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

import httpx

from app.core.config import settings
from app.core.circuit_breaker import well_trajectory_breaker
from app.core.http_client import get_http_client, run_on_main_loop
from app.core.http_retry import retry_microservice_call
from app.core.microservice_errors import map_httpx_error
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
    """HTTP client adapter using the shared httpx.AsyncClient.

    Public methods keep a sync signature for callers running inside
    ``asyncio.to_thread``; they delegate to async implementations on the main loop.
    """

    def __init__(self, base_url: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = settings.WELL_TRAJECTORY_HTTP_TIMEOUT_SECONDS

    async def _post_json(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        async def _call() -> dict[str, Any]:
            client = await get_http_client()
            url = f"{self._base_url}{path}"
            try:
                res = await client.post(url, json=payload, timeout=self._timeout)
                res.raise_for_status()
                return res.json()
            except Exception as exc:
                raise map_httpx_error(exc, service_name="well-trajectory") from exc

        async def _with_retry() -> dict[str, Any]:
            return await retry_microservice_call(_call, service_name="well-trajectory")

        return await well_trajectory_breaker.call(_with_retry)

    async def _post_multipart(self, path: str, *, files: dict[str, Any]) -> dict[str, Any]:
        async def _call() -> dict[str, Any]:
            client = await get_http_client()
            url = f"{self._base_url}{path}"
            try:
                res = await client.post(url, files=files, timeout=self._timeout)
                res.raise_for_status()
                return res.json()
            except Exception as exc:
                raise map_httpx_error(exc, service_name="well-trajectory") from exc

        async def _with_retry() -> dict[str, Any]:
            return await retry_microservice_call(_call, service_name="well-trajectory")

        return await well_trajectory_breaker.call(_with_retry)

    def _schemas(self, name: str) -> Any:
        return __import__("well_trajectory.schemas", fromlist=[name])

    async def design_connector_async(
        self, request: ConnectorDesignRequest
    ) -> ConnectorDesignResponse:
        ConnectorDesignResponse = self._schemas("ConnectorDesignResponse")
        data = await self._post_json("/v1/design/connector", request.model_dump(mode="json"))
        return ConnectorDesignResponse.model_validate(data)

    def design_connector(self, request: ConnectorDesignRequest) -> ConnectorDesignResponse:
        return run_on_main_loop(self.design_connector_async(request), timeout=self._timeout)

    async def design_horizontal_async(
        self, request: HorizontalDesignRequest
    ) -> HorizontalDesignResponse:
        HorizontalDesignResponse = self._schemas("HorizontalDesignResponse")
        data = await self._post_json("/v1/design/horizontal", request.model_dump(mode="json"))
        return HorizontalDesignResponse.model_validate(data)

    def design_horizontal(self, request: HorizontalDesignRequest) -> HorizontalDesignResponse:
        return run_on_main_loop(self.design_horizontal_async(request), timeout=self._timeout)

    async def interpolate_survey_async(
        self, request: SurveyInterpolateRequest
    ) -> SurveyInterpolateResponse:
        SurveyInterpolateResponse = self._schemas("SurveyInterpolateResponse")
        data = await self._post_json("/v1/survey/interpolate", request.model_dump(mode="json"))
        return SurveyInterpolateResponse.model_validate(data)

    def interpolate_survey(self, request: SurveyInterpolateRequest) -> SurveyInterpolateResponse:
        return run_on_main_loop(self.interpolate_survey_async(request), timeout=self._timeout)

    async def generate_from_pad_layout_async(
        self, request: PadGenerateFromLayoutRequest
    ) -> PadGenerateFromLayoutResponse:
        PadGenerateFromLayoutResponse = self._schemas("PadGenerateFromLayoutResponse")
        data = await self._post_json(
            "/v1/pad/generate-from-layout", request.model_dump(mode="json")
        )
        return PadGenerateFromLayoutResponse.model_validate(data)

    def generate_from_pad_layout(
        self, request: PadGenerateFromLayoutRequest
    ) -> PadGenerateFromLayoutResponse:
        return run_on_main_loop(
            self.generate_from_pad_layout_async(request), timeout=self._timeout
        )

    async def clearance_pairs_async(
        self, request: ClearancePairsRequest
    ) -> ClearancePairsResponse:
        ClearancePairsResponse = self._schemas("ClearancePairsResponse")
        data = await self._post_json("/v1/clearance/pairs", request.model_dump(mode="json"))
        return ClearancePairsResponse.model_validate(data)

    def clearance_pairs(self, request: ClearancePairsRequest) -> ClearancePairsResponse:
        return run_on_main_loop(self.clearance_pairs_async(request), timeout=self._timeout)

    async def import_csv_async(self, content: str) -> ImportParseResponse:
        ImportParseResponse = self._schemas("ImportParseResponse")
        data = await self._post_json("/v1/import/csv", {"content": content})
        return ImportParseResponse.model_validate(data)

    def import_csv(self, content: str) -> ImportParseResponse:
        return run_on_main_loop(self.import_csv_async(content), timeout=self._timeout)

    async def import_wbp_async(self, data: bytes) -> ImportParseResponse:
        ImportParseResponse = self._schemas("ImportParseResponse")
        payload = await self._post_multipart(
            "/v1/import/wbp",
            files={"file": ("survey.wbp", data, "application/octet-stream")},
        )
        return ImportParseResponse.model_validate(payload)

    def import_wbp(self, data: bytes) -> ImportParseResponse:
        return run_on_main_loop(self.import_wbp_async(data), timeout=self._timeout)


def get_well_trajectory_adapter() -> InProcessWellTrajectoryAdapter | HttpWellTrajectoryAdapter:
    service_url = settings.WELL_TRAJECTORY_SERVICE_URL.strip()
    if service_url:
        return HttpWellTrajectoryAdapter(service_url)
    if settings.WELL_TRAJECTORY_INPROCESS:
        return InProcessWellTrajectoryAdapter()
    raise RuntimeError(
        "Well trajectory disabled: set WELL_TRAJECTORY_INPROCESS=true or WELL_TRAJECTORY_SERVICE_URL"
    )
