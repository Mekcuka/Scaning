"""Access node placement for autoroad network planner (object → node → road)."""

from __future__ import annotations

import math

from app.services.autoroad_network.schemas import PlanTerminalInput
from app.services.road_graph import haversine_km


def destination_toward_km(
    lon: float,
    lat: float,
    target_lon: float,
    target_lat: float,
    dist_km: float,
) -> tuple[float, float]:
    """Point ``dist_km`` from (lon, lat) toward (target_lon, target_lat)."""
    total = haversine_km(lon, lat, target_lon, target_lat)
    if total < 1e-9:
        dlon = dist_km / max(111.32 * max(0.01, abs(math.cos(math.radians(lat)))), 1e-6)
        return lon + dlon, lat
    if dist_km >= total:
        return target_lon, target_lat
    f = dist_km / total
    return lon + (target_lon - lon) * f, lat + (target_lat - lat) * f


def direction_target_for_terminal(
    terminal: PlanTerminalInput,
    *,
    snap_lon: float | None,
    snap_lat: float | None,
    other_terminals: list[PlanTerminalInput],
) -> tuple[float, float]:
    if snap_lon is not None and snap_lat is not None:
        return snap_lon, snap_lat
    if other_terminals:
        n = len(other_terminals)
        return (
            sum(o.lon for o in other_terminals) / n,
            sum(o.lat for o in other_terminals) / n,
        )
    return terminal.lon + 1e-4 * math.cos(math.radians(terminal.lat)), terminal.lat


def access_node_coordinates(
    terminal: PlanTerminalInput,
    *,
    snap_lon: float | None,
    snap_lat: float | None,
    other_terminals: list[PlanTerminalInput],
    offset_km: float,
) -> tuple[float, float]:
    tgt_lon, tgt_lat = direction_target_for_terminal(
        terminal,
        snap_lon=snap_lon,
        snap_lat=snap_lat,
        other_terminals=other_terminals,
    )
    return destination_toward_km(terminal.lon, terminal.lat, tgt_lon, tgt_lat, offset_km)
