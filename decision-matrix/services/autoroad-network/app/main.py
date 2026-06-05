"""Autoroad Network Service — thin proxy to network-planner adapter."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parents[3] / "backend"
if _BACKEND.is_dir() and str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from fastapi import FastAPI, HTTPException

from app.services.autoroad_network.planner_adapter import compute_via_network_planner
from app.services.autoroad_network.schemas import NetworkPlanRequest, NetworkPlanResponse

app = FastAPI(title="Autoroad Network Service", version="2.0.0")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/network/plan", response_model=NetworkPlanResponse)
async def network_plan(req: NetworkPlanRequest) -> NetworkPlanResponse:
    if any(t.subtype in ("node", "methanol_joint", "power_line_node") for t in req.terminals):
        raise HTTPException(status_code=422, detail="excluded_terminal_subtype")
    return await compute_via_network_planner(req)
