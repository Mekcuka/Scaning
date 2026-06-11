"""In-process and HTTP adapters for pad-earthwork-planner."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import httpx

from app.core.config import settings
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

    def compute(self, request: ComputeRequest) -> ComputeResponse:
        schemas = __import__("pad_earthwork.schemas", fromlist=["ComputeResponse"])
        ComputeResponse = schemas.ComputeResponse
        url = f"{self._base_url}/v1/compute"
        with httpx.Client(timeout=60.0) as client:
            res = client.post(url, json=request.model_dump(mode="json"))
            res.raise_for_status()
            return ComputeResponse.model_validate(res.json())


def get_pad_earthwork_adapter() -> InProcessPadEarthworkAdapter | HttpPadEarthworkAdapter:
    service_url = settings.PAD_EARTHWORK_SERVICE_URL.strip()
    if service_url:
        return HttpPadEarthworkAdapter(service_url)
    if settings.PAD_EARTHWORK_INPROCESS:
        return InProcessPadEarthworkAdapter()
    raise RuntimeError(
        "Pad earthwork disabled: set PAD_EARTHWORK_INPROCESS=true or PAD_EARTHWORK_SERVICE_URL"
    )
