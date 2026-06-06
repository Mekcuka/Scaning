"""Network planner port (DIP) — in-process or HTTP implementations."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from app.services.autoroad_network.schemas import NetworkPlanRequest, NetworkPlanResponse


@runtime_checkable
class NetworkPlannerPort(Protocol):
    async def compute(self, req: NetworkPlanRequest) -> NetworkPlanResponse: ...


class DefaultNetworkPlanner:
    """Delegates to planner_adapter implementation."""

    async def compute(self, req: NetworkPlanRequest) -> NetworkPlanResponse:
        from app.services.autoroad_network.planner_adapter import _compute_network_plan

        return await _compute_network_plan(req)


_default_network_planner: NetworkPlannerPort = DefaultNetworkPlanner()


def get_network_planner() -> NetworkPlannerPort:
    return _default_network_planner
