"""Call autoroad network planner (HTTP microservice or in-process)."""

from __future__ import annotations

import logging

import httpx

from app.core.config import settings
from app.services.autoroad_network.plan_core import plan_from_request
from app.services.autoroad_network.schemas import NetworkPlanRequest, NetworkPlanResponse

logger = logging.getLogger(__name__)


async def compute_network_plan(req: NetworkPlanRequest) -> NetworkPlanResponse:
    if settings.AUTOROAD_NETWORK_INPROCESS:
        return plan_from_request(req)

    base = settings.AUTOROAD_NETWORK_SERVICE_URL.strip().rstrip("/")
    if not base:
        return plan_from_request(req)

    url = f"{base}/v1/network/plan"
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(url, json=req.model_dump(mode="json"))
            r.raise_for_status()
            return NetworkPlanResponse.model_validate(r.json())
    except Exception:
        logger.warning("autoroad network service unavailable, falling back to in-process", exc_info=True)
        return plan_from_request(req)
