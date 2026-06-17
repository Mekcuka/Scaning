"""In-process and HTTP adapters for pad-earthwork-planner."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.core.config import settings
from app.core.circuit_breaker import pad_earthwork_breaker
from app.core.http_client import get_http_client, run_on_main_loop
from app.core.http_retry import retry_microservice_call
from app.core.microservice_errors import map_httpx_error
from app.services.pad_earthwork.planner_bridge import compute_pad_earthwork

if TYPE_CHECKING:
    from pad_earthwork.schemas import ComputeRequest, ComputeResponse

logger = logging.getLogger(__name__)


class InProcessPadEarthworkAdapter:
    def compute(self, request: ComputeRequest) -> ComputeResponse:
        return compute_pad_earthwork(request)


class HttpPadEarthworkAdapter:
    def __init__(self, base_url: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = 60.0

    async def compute_async(self, request: ComputeRequest) -> ComputeResponse:
        schemas = __import__("pad_earthwork.schemas", fromlist=["ComputeResponse"])
        ComputeResponse = schemas.ComputeResponse

        async def _call() -> ComputeResponse:
            client = await get_http_client()
            url = f"{self._base_url}/v1/compute"
            try:
                res = await client.post(
                    url, json=request.model_dump(mode="json"), timeout=self._timeout
                )
                res.raise_for_status()
                return ComputeResponse.model_validate(res.json())
            except Exception as exc:
                raise map_httpx_error(exc, service_name="pad-earthwork") from exc

        async def _with_retry() -> ComputeResponse:
            return await retry_microservice_call(_call, service_name="pad-earthwork")

        return await pad_earthwork_breaker.call(_with_retry)

    def compute(self, request: ComputeRequest) -> ComputeResponse:
        return run_on_main_loop(self.compute_async(request), timeout=self._timeout)


def get_pad_earthwork_adapter() -> InProcessPadEarthworkAdapter | HttpPadEarthworkAdapter:
    service_url = settings.PAD_EARTHWORK_SERVICE_URL.strip()
    if service_url:
        return HttpPadEarthworkAdapter(service_url)
    if settings.PAD_EARTHWORK_INPROCESS:
        return InProcessPadEarthworkAdapter()
    raise RuntimeError(
        "Pad earthwork disabled: set PAD_EARTHWORK_INPROCESS=true or PAD_EARTHWORK_SERVICE_URL"
    )
