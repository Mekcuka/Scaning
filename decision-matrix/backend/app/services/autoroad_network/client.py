"""Call autoroad network planner (HTTP microservice or in-process)."""

from __future__ import annotations

from app.services.autoroad_network.planner_adapter import compute_via_network_planner
from app.services.autoroad_network.schemas import NetworkPlanRequest, NetworkPlanResponse


async def compute_network_plan(req: NetworkPlanRequest) -> NetworkPlanResponse:
    return await compute_via_network_planner(req)
