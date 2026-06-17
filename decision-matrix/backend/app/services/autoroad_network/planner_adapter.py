"""Bridge SPPR NetworkPlanRequest/Response to network-planner PlanRequest/Response."""

from __future__ import annotations

import asyncio
import logging
import os
from functools import lru_cache
from typing import TYPE_CHECKING, Literal
from uuid import UUID

import httpx

if TYPE_CHECKING:
    from network_planner.schemas.io import PlanRequest, PlanResponse

from app.core.config import settings
from app.core.circuit_breaker import autoroad_breaker
from app.core.http_client import get_http_client
from app.core.http_retry import retry_microservice_call
from app.core.microservice_errors import MicroserviceError, map_httpx_error
from app.services.autoroad_connect import AutoroadConnectPlan, PlannedLine, PlannedNode
from app.services.autoroad_network.schemas import (
    NetworkPlanRequest,
    NetworkPlanResponse,
    PlannedLineOut,
    PlannedNodeOut,
    PlanTerminalInput,
    PlanTerminalResult,
    SolverStatusResponse,
    terminal_result_from_input,
)

logger = logging.getLogger(__name__)

TERMINAL_PREFIX = "terminal:"
_NETWORK_PLANNER_INSTALL_HINT = (
    "pip install -e ../../../autoroad-network-planner[steinerpy]"
)


@lru_cache(maxsize=1)
def _network_planner():
    """Lazy import so auth and the rest of the API start without network-planner."""
    try:
        from network_planner.plan.pipeline import (
            plan_from_request_geosteiner,
            plan_from_request_steinerpy,
        )
        from network_planner.schemas.io import (
            PlanOptions,
            PlanRequest,
            PlanResponse,
            TerminalInput,
        )
        from network_planner.steiner.geosteiner import (
            GeoSteinerNotAvailableError,
            is_geosteiner_available,
        )
        from network_planner.steiner.steinerpy import (
            SteinerPyNotAvailableError,
            is_steinerpy_available,
        )
    except ImportError as exc:
        raise RuntimeError(
            f"Пакет network-planner не установлен. Выполните: {_NETWORK_PLANNER_INSTALL_HINT}"
        ) from exc
    return {
        "PlanOptions": PlanOptions,
        "PlanRequest": PlanRequest,
        "PlanResponse": PlanResponse,
        "TerminalInput": TerminalInput,
        "plan_from_request_geosteiner": plan_from_request_geosteiner,
        "plan_from_request_steinerpy": plan_from_request_steinerpy,
        "GeoSteinerNotAvailableError": GeoSteinerNotAvailableError,
        "SteinerPyNotAvailableError": SteinerPyNotAvailableError,
        "is_geosteiner_available": is_geosteiner_available,
        "is_steinerpy_available": is_steinerpy_available,
    }


def _configure_geosteiner_bin_dir() -> None:
    bin_dir = settings.GEOSTEINER_BIN_DIR.strip()
    if bin_dir:
        os.environ["GEOSTEINER_BIN_DIR"] = bin_dir


def get_solver_status() -> SolverStatusResponse:
    np = _network_planner()
    _configure_geosteiner_bin_dir()
    return SolverStatusResponse(
        steinerpy=np["is_steinerpy_available"](),
        geosteiner=np["is_geosteiner_available"](),
        default_solver=settings.AUTOROAD_NETWORK_SOLVER,
    )


async def get_solver_status_http() -> SolverStatusResponse:
    base = settings.AUTOROAD_NETWORK_SERVICE_URL.strip().rstrip("/")
    if not base:
        return get_solver_status()
    client = await get_http_client()
    sp = False
    gs = False
    try:
        r = await client.get(f"{base}/v1/steinerpy/status", timeout=10.0)
        if r.is_success:
            sp = bool(r.json().get("available"))
    except Exception:
        logger.debug("steinerpy status fetch failed", exc_info=True)
    try:
        r = await client.get(f"{base}/v1/geosteiner/status", timeout=10.0)
        if r.is_success:
            gs = bool(r.json().get("available"))
    except Exception:
        logger.debug("geosteiner status fetch failed", exc_info=True)
    return SolverStatusResponse(
        steinerpy=sp,
        geosteiner=gs,
        default_solver=settings.AUTOROAD_NETWORK_SOLVER,
    )


def _terminal_role(index: int, total: int) -> Literal["start", "end", "intermediate"]:
    if total <= 1:
        return "start"
    if index == 0:
        return "start"
    if index == total - 1:
        return "end"
    return "intermediate"


def _resolve_solver(req: NetworkPlanRequest) -> Literal["geosteiner", "steinerpy"]:
    np = _network_planner()
    solver = req.options.solver or settings.AUTOROAD_NETWORK_SOLVER
    if solver not in ("geosteiner", "steinerpy"):
        solver = "geosteiner"
    _configure_geosteiner_bin_dir()
    if solver == "geosteiner" and not np["is_geosteiner_available"]():
        if np["is_steinerpy_available"]():
            return "steinerpy"
    if solver == "steinerpy" and not np["is_steinerpy_available"]():
        if np["is_geosteiner_available"]():
            return "geosteiner"
    return solver  # type: ignore[return-value]


def to_planner_request(req: NetworkPlanRequest) -> tuple[PlanRequest, list[str]]:
    np = _network_planner()
    PlanOptions = np["PlanOptions"]
    PlanRequest = np["PlanRequest"]
    TerminalInput = np["TerminalInput"]

    warnings: list[str] = []
    if req.existing_autoroads:
        warnings.append("legacy_existing_roads_ignored")

    opts = req.options
    planner_opts = PlanOptions(
        connector_max_km=opts.connector_max_km,
        enforce_attachment_radius=opts.enforce_attachment_radius,
        normalize_terminal_leaves=opts.normalize_terminal_leaves,
        steiner_hub_prefix=opts.steiner_hub_prefix,
        steiner_hub_offset_km=opts.steiner_hub_offset_km,
        edge_vertex_spacing_km=opts.edge_vertex_spacing_km,
        steiner_radius_km=opts.steiner_radius_km,
        attachment_angle_deg=opts.attachment_angle_deg,
        attachment_angle_penalty=opts.attachment_angle_penalty,
        max_points=opts.max_terminals,
    )

    terminals: list[TerminalInput] = []
    n = len(req.terminals)
    for i, t in enumerate(req.terminals):
        terminals.append(
            TerminalInput(
                id=t.id,
                type=t.subtype or "terminal",
                role=_terminal_role(i, n),
                lon=t.lon,
                lat=t.lat,
            )
        )

    return (
        PlanRequest(
            project_id=req.project_id,
            terminals=terminals,
            options=planner_opts,
        ),
        warnings,
    )


def _parse_terminal_id(node_id: str) -> UUID | None:
    if not node_id.startswith(TERMINAL_PREFIX):
        return None
    try:
        return UUID(node_id[len(TERMINAL_PREFIX) :])
    except ValueError:
        return None


def _edge_kind(from_id: str, to_id: str) -> str:
    if from_id.startswith(TERMINAL_PREFIX) or to_id.startswith(TERMINAL_PREFIX):
        return "connector"
    return "link"


def _is_junction_node(node_id: str) -> bool:
    if node_id.startswith(TERMINAL_PREFIX):
        return False
    if "waypoint" in node_id:
        return False
    return True


def from_planner_response(
    resp: PlanResponse,
    req: NetworkPlanRequest,
    extra_warnings: list[str] | None = None,
) -> NetworkPlanResponse:
    input_by_id = {t.id: t for t in req.terminals}
    result_by_id = {t.id: t for t in resp.terminals}

    new_lines: list[PlannedLineOut] = []
    for edge in resp.steiner_tree.edges:
        coords = edge.coordinates
        if len(coords) < 2:
            continue
        from_tid = _parse_terminal_id(edge.from_id)
        to_tid = _parse_terminal_id(edge.to_id)
        new_lines.append(
            PlannedLineOut(
                kind=_edge_kind(edge.from_id, edge.to_id),
                coordinates=[[float(c[0]), float(c[1])] for c in coords],
                snap_start_object_id=from_tid,
                snap_finish_object_id=to_tid,
            )
        )

    new_nodes: list[PlannedNodeOut] = []
    for sp in resp.steiner_tree.steiner_points:
        if not _is_junction_node(sp.id):
            continue
        new_nodes.append(
            PlannedNodeOut(lon=float(sp.lon), lat=float(sp.lat), reason="junction")
        )

    terminals_out: list[PlanTerminalResult] = []
    for t in req.terminals:
        tr = result_by_id.get(t.id)
        warning = None
        if tr and tr.length_m > req.options.connector_max_km * 1000 * 1.01:
            warning = "attachment_radius_violation"
        terminals_out.append(
            terminal_result_from_input(
                t,
                warning=warning,
                snap_lon=t.lon,
                snap_lat=t.lat,
            )
        )

    warnings = list(extra_warnings or [])
    warnings.extend(resp.warnings)
    if f"solver:{resp.solver}" not in warnings:
        warnings.append(f"solver:{resp.solver}")

    total_new_km = resp.total_length_m / 1000.0

    connect_plan = _network_to_connect_plan(
        terminals_out,
        new_lines,
        new_nodes,
        warnings,
        total_new_km,
        input_by_id,
    )
    preview_dict = connect_plan.to_response_dict().get("preview")

    return NetworkPlanResponse(
        terminals=terminals_out,
        new_lines=new_lines,
        new_nodes=new_nodes,
        splits=[],
        used_existing_edge_ids=[],
        total_new_km=round(total_new_km, 3),
        warnings=warnings,
        preview=preview_dict,
        request_meta={"solver": resp.solver, "terminal_count": len(req.terminals)},
        new_line_count=len(new_lines),
        new_node_count=len(new_nodes),
        split_count=0,
    )


def _network_to_connect_plan(
    terminals: list[PlanTerminalResult],
    new_lines: list[PlannedLineOut],
    new_nodes: list[PlannedNodeOut],
    warnings: list[str],
    total_new_km: float,
    input_by_id: dict[UUID, PlanTerminalInput],
) -> AutoroadConnectPlan:
    from app.services.autoroad_connect import TerminalSnap

    plan = AutoroadConnectPlan()
    plan.warnings = list(warnings)
    plan.total_new_km = total_new_km
    for t in terminals:
        inp = input_by_id.get(t.id)
        plan.terminals.append(
            TerminalSnap(
                object_id=t.id,
                name=t.name or (inp.name if inp else ""),
                lon=t.lon,
                lat=t.lat,
                snap_lon=t.snap_lon,
                snap_lat=t.snap_lat,
                warning=t.warning,
            )
        )
    for ln in new_lines:
        if len(ln.coordinates) < 2:
            continue
        plan.new_lines.append(
            PlannedLine(
                start_lon=ln.coordinates[0][0],
                start_lat=ln.coordinates[0][1],
                end_lon=ln.coordinates[-1][0],
                end_lat=ln.coordinates[-1][1],
                coordinates=ln.coordinates,
                snap_start_object_id=ln.snap_start_object_id,
                snap_finish_object_id=ln.snap_finish_object_id,
                kind=ln.kind,
            )
        )
    for nd in new_nodes:
        plan.new_nodes.append(
            PlannedNode(lon=nd.lon, lat=nd.lat, reason=nd.reason)
        )
    return plan


def run_planner_inprocess(
    planner_req: PlanRequest,
    solver: Literal["geosteiner", "steinerpy"],
) -> tuple[PlanResponse, list[str]]:
    np = _network_planner()
    fallback_warnings: list[str] = []
    _configure_geosteiner_bin_dir()

    if solver == "geosteiner":
        try:
            return np["plan_from_request_geosteiner"](planner_req), fallback_warnings
        except np["GeoSteinerNotAvailableError"]:
            if np["is_steinerpy_available"]():
                fallback_warnings.append("solver_fallback:steinerpy")
                return np["plan_from_request_steinerpy"](planner_req), fallback_warnings
            raise
    try:
        return np["plan_from_request_steinerpy"](planner_req), fallback_warnings
    except np["SteinerPyNotAvailableError"]:
        if np["is_geosteiner_available"]():
            fallback_warnings.append("solver_fallback:geosteiner")
            return np["plan_from_request_geosteiner"](planner_req), fallback_warnings
        raise


async def run_planner_inprocess_async(
    planner_req: PlanRequest,
    solver: Literal["geosteiner", "steinerpy"],
) -> tuple[PlanResponse, list[str]]:
    """Async wrapper around CPU-bound run_planner_inprocess.

    The Steiner tree solver is CPU-bound and can take several seconds; running it
    in asyncio.to_thread prevents blocking the event loop (and other requests).
    """
    return await asyncio.to_thread(run_planner_inprocess, planner_req, solver)


async def run_planner_http(
    planner_req: PlanRequest,
    solver: Literal["geosteiner", "steinerpy"],
) -> tuple[PlanResponse, list[str]]:
    base = settings.AUTOROAD_NETWORK_SERVICE_URL.strip().rstrip("/")
    if not base:
        return await run_planner_inprocess_async(planner_req, solver)

    PlanResponse = _network_planner()["PlanResponse"]
    url = f"{base}/v1/plan/{solver}"

    async def _http_call() -> tuple[PlanResponse, list[str]]:
        async def _post() -> PlanResponse:
            client = await get_http_client()
            try:
                r = await client.post(
                    url, json=planner_req.model_dump(mode="json"), timeout=120.0
                )
                r.raise_for_status()
                return PlanResponse.model_validate(r.json())
            except Exception as exc:
                raise map_httpx_error(exc, service_name="autoroad-network") from exc

        async def _with_retry() -> PlanResponse:
            return await retry_microservice_call(_post, service_name="autoroad-network")

        resp = await autoroad_breaker.call(_with_retry)
        return resp, []

    try:
        return await _http_call()
    except MicroserviceError:
        raise
    except httpx.HTTPError:
        logger.warning(
            "autoroad network HTTP planner failed, falling back in-process", exc_info=True
        )
        return await run_planner_inprocess_async(planner_req, solver)


async def _compute_network_plan(req: NetworkPlanRequest) -> NetworkPlanResponse:
    np = _network_planner()
    planner_req, pre_warnings = to_planner_request(req)
    solver = _resolve_solver(req)
    if (
        solver == "geosteiner"
        and req.options.solver == "geosteiner"
        and not np["is_geosteiner_available"]()
    ):
        if np["is_steinerpy_available"]():
            pre_warnings.append("solver_fallback:steinerpy")
            solver = "steinerpy"
    elif (
        solver == "steinerpy"
        and req.options.solver == "steinerpy"
        and not np["is_steinerpy_available"]()
    ):
        if np["is_geosteiner_available"]():
            pre_warnings.append("solver_fallback:geosteiner")
            solver = "geosteiner"

    if settings.AUTOROAD_NETWORK_INPROCESS:
        resp, fb = await run_planner_inprocess_async(planner_req, solver)
    else:
        resp, fb = await run_planner_http(planner_req, solver)

    all_warnings = pre_warnings + fb
    return from_planner_response(resp, req, extra_warnings=all_warnings)


async def compute_via_network_planner(req: NetworkPlanRequest) -> NetworkPlanResponse:
    """Backward-compatible entry; prefer get_network_planner().compute()."""
    return await _compute_network_plan(req)
