"""Autoroad Network Service — standalone FastAPI entry."""

from __future__ import annotations

import sys
from pathlib import Path

# Monolith backend on PYTHONPATH (Docker: /app/backend)
_BACKEND = Path(__file__).resolve().parents[3] / "backend"
if _BACKEND.is_dir() and str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from fastapi import FastAPI, HTTPException

from app.services.autoroad_network.plan_core import plan_from_request
from app.services.autoroad_network.schemas import NetworkPlanRequest, NetworkPlanResponse

app = FastAPI(title="Autoroad Network Service", version="1.0.0")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/network/plan", response_model=NetworkPlanResponse)
async def network_plan(req: NetworkPlanRequest) -> NetworkPlanResponse:
    if any(t.subtype in ("node", "methanol_joint", "power_line_node") for t in req.terminals):
        raise HTTPException(status_code=422, detail="excluded_terminal_subtype")
    return plan_from_request(req)
