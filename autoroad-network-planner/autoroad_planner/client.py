"""Planner client (in-process only in standalone package)."""

from __future__ import annotations

from autoroad_planner.plan_core import plan_from_request
from autoroad_planner.schemas import NetworkPlanRequest, NetworkPlanResponse


async def compute_network_plan(req: NetworkPlanRequest) -> NetworkPlanResponse:
    """Same contract as decision-matrix BFF ``/autoroad-network/compute``."""
    return plan_from_request(req)


def compute_network_plan_sync(req: NetworkPlanRequest) -> NetworkPlanResponse:
    return plan_from_request(req)
