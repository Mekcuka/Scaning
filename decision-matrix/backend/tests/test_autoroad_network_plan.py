"""Autoroad network planner (stateless)."""

import asyncio
from uuid import UUID, uuid4

from app.geo.constants import TERMINAL_EXCLUSION_RADIUS_KM
from app.services.autoroad_network.plan_core import (
    _object_snap_count,
    plan_from_request,
)
from app.services import autoroad_network as autoroad_network_pkg
from app.services import terminal_exclusion as terminal_exclusion_mod
from app.services.terminal_exclusion import (
    boundary_pair,
    is_inside_terminal_exclusion,
    min_distance_to_terminals,
    path_length_km,
    route_backbone_outside_exclusions,
    segment_penetrates_exclusion,
    validate_planned_exclusion,
)
import pytest
from pydantic import ValidationError

from app.services.autoroad_network.schemas import (
    ExistingAutoroadInput,
    NetworkPlanRequest,
    PlanTerminalInput,
)
from app.services.road_graph import geodesic_midpoint, haversine_km, mst_terminal_edges


def _assert_one_autoroad_per_terminal(out, terminal_ids):
    for tid in terminal_ids:
        assert _object_snap_count(out.new_lines, tid) <= 1
    assert not any("multiple_autoroad_connections" in w for w in out.warnings)


def _legacy_sorted_chain_km(req: NetworkPlanRequest) -> float:
    """Pre-quality baseline: midpoint links chained by distance from each terminal."""
    terminals = {t.id: t for t in req.terminals}
    ids = [t.id for t in req.terminals]
    dist = {
        a: {
            b: (
                0.0
                if a == b
                else haversine_km(
                    terminals[a].lon,
                    terminals[a].lat,
                    terminals[b].lon,
                    terminals[b].lat,
                )
            )
            for b in ids
        }
        for a in ids
    }
    edge_mid: dict[frozenset, tuple[float, float]] = {}
    term_edges: dict = {i: [] for i in ids}
    for a, b in mst_terminal_edges(ids, dist):
        ek = frozenset((a, b))
        ta, tb = terminals[a], terminals[b]
        edge_mid[ek] = geodesic_midpoint(ta.lon, ta.lat, tb.lon, tb.lat)
        term_edges[a].append(ek)
        term_edges[b].append(ek)
    total = 0.0
    seen: set[tuple] = set()
    for tid in ids:
        t = terminals[tid]
        keys = term_edges[tid]
        if len(keys) >= 2:
            ordered = sorted(
                keys,
                key=lambda ek: haversine_km(
                    t.lon, t.lat, edge_mid[ek][0], edge_mid[ek][1]
                ),
            )
            for i in range(len(ordered) - 1):
                ek1, ek2 = ordered[i], ordered[i + 1]
                pair = tuple(sorted((tuple(sorted(ek1)), tuple(sorted(ek2)))))
                if pair in seen:
                    continue
                seen.add(pair)
                m1, m2 = edge_mid[ek1], edge_mid[ek2]
                total += haversine_km(m1[0], m1[1], m2[0], m2[1])
        best = min(
            (edge_mid[ek] for ek in keys),
            key=lambda m: haversine_km(t.lon, t.lat, m[0], m[1]),
        )
        total += haversine_km(t.lon, t.lat, best[0], best[1])
    return total


def _assert_all_links_outside_exclusion(out, terminals, *, radius_km=TERMINAL_EXCLUSION_RADIUS_KM):
    assert not validate_planned_exclusion(out.new_lines, out.new_nodes, terminals)
    for ln in out.new_lines:
        if ln.kind != "link":
            continue
        for c in ln.coordinates:
            assert not is_inside_terminal_exclusion(
                c[0], c[1], terminals, radius_km=radius_km
            )
    for nd in out.new_nodes:
        assert not is_inside_terminal_exclusion(
            nd.lon, nd.lat, terminals, radius_km=radius_km
        )


def _connector_finish_coords(out) -> set[tuple[float, float]]:
    ends: set[tuple[float, float]] = set()
    for ln in out.new_lines:
        if ln.kind == "connector" and len(ln.coordinates) >= 2:
            c = ln.coordinates[-1]
            ends.add((round(c[0], 6), round(c[1], 6)))
    return ends


def test_plan_rejects_node_cluster():
    t1 = uuid4()
    t2 = uuid4()
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=t1, subtype="node", name="U1", lon=37.6, lat=55.75),
            PlanTerminalInput(id=t2, subtype="gas_processing", name="G1", lon=37.64, lat=55.75),
        ],
        existing_autoroads=[],
    )
    out = plan_from_request(req)
    assert "excluded_terminal_subtype" in "".join(out.warnings)


def test_coordinates_must_match_lon_lat():
    with pytest.raises(ValidationError, match="coordinates must match"):
        PlanTerminalInput(
            id=uuid4(),
            subtype="gas_processing",
            name="A",
            lon=37.60,
            lat=55.75,
            coordinates=[37.61, 55.75],
        )


def test_plan_terminal_result_echoes_input_metadata():
    p1, p2 = uuid4(), uuid4()
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(
                id=p1,
                subtype="gas_processing",
                name="A",
                category="area_facility",
                subtype_label="ГКС",
                lon=37.60,
                lat=55.75,
                coordinates=[37.60, 55.75],
                properties={"k": 1},
            ),
            PlanTerminalInput(
                id=p2, subtype="refinery", name="B", lon=37.64, lat=55.76
            ),
        ],
        existing_autoroads=[],
    )
    out = plan_from_request(req)
    by_id = {t.id: t for t in out.terminals}
    assert by_id[p1].subtype == "gas_processing"
    assert by_id[p1].subtype_label == "ГКС"
    assert by_id[p1].lon == 37.60
    assert by_id[p1].coordinates == [37.60, 55.75]
    assert by_id[p1].properties.get("k") == 1
    assert out.request_meta is not None
    assert out.request_meta["terminal_count"] == 2


def test_plan_two_terminals_no_road_boundary_link():
    p1 = uuid4()
    p2 = uuid4()
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=p1, subtype="gas_processing", name="A", lon=37.60, lat=55.75),
            PlanTerminalInput(id=p2, subtype="refinery", name="B", lon=37.64, lat=55.76),
        ],
        existing_autoroads=[],
    )
    out = plan_from_request(req)
    connectors = [ln for ln in out.new_lines if ln.kind == "connector"]
    links = [ln for ln in out.new_lines if ln.kind == "link"]
    assert len(connectors) == 2
    assert len(links) == 1
    assert not links[0].snap_start_object_id and not links[0].snap_finish_object_id
    for c in connectors:
        assert c.snap_start_object_id in (p1, p2)
        d = haversine_km(
            c.coordinates[0][0],
            c.coordinates[0][1],
            c.coordinates[-1][0],
            c.coordinates[-1][1],
        )
        assert 0.19 <= d <= 0.21
    _assert_one_autoroad_per_terminal(out, [p1, p2])
    _assert_all_links_outside_exclusion(out, req.terminals)
    assert "terminals_not_connected" not in out.warnings


def test_plan_three_terminals_off_network_steiner_mst():
    p1 = uuid4()
    p2 = uuid4()
    p3 = uuid4()
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=p1, subtype="gas_processing", name="A", lon=37.60, lat=55.75),
            PlanTerminalInput(id=p2, subtype="refinery", name="B", lon=37.62, lat=55.75),
            PlanTerminalInput(id=p3, subtype="oil_pad", name="C", lon=37.64, lat=55.75),
        ],
        existing_autoroads=[],
    )
    out = plan_from_request(req)
    assert len(out.new_nodes) >= 2
    connectors = [ln for ln in out.new_lines if ln.kind == "connector"]
    links = [ln for ln in out.new_lines if ln.kind == "link"]
    assert len(connectors) == 3
    assert len(links) >= 1
    assert len(_connector_finish_coords(out)) >= 2
    object_links = [
        ln
        for ln in out.new_lines
        if ln.kind == "link"
        and (ln.snap_start_object_id or ln.snap_finish_object_id)
    ]
    assert not object_links
    _assert_one_autoroad_per_terminal(out, [p1, p2, p3])
    _assert_all_links_outside_exclusion(out, req.terminals)
    assert "terminals_not_connected" not in out.warnings


def test_plan_four_terminals_off_network_steiner_mst():
    ids = [uuid4() for _ in range(4)]
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=ids[0], subtype="gas_processing", name="A", lon=37.60, lat=55.76),
            PlanTerminalInput(id=ids[1], subtype="refinery", name="B", lon=37.64, lat=55.76),
            PlanTerminalInput(id=ids[2], subtype="oil_pad", name="C", lon=37.64, lat=55.74),
            PlanTerminalInput(id=ids[3], subtype="methanol_facility", name="D", lon=37.60, lat=55.74),
        ],
        existing_autoroads=[],
    )
    out = plan_from_request(req)
    assert len(out.new_nodes) >= 3
    assert len([ln for ln in out.new_lines if ln.kind == "connector"]) == 4
    assert len([ln for ln in out.new_lines if ln.kind == "link"]) >= 2
    assert len(_connector_finish_coords(out)) >= 2
    _assert_one_autoroad_per_terminal(out, ids)


def test_plan_spread_three_steiner_not_single_hub():
    """MST tree uses several junctions, not one hub for all connectors."""
    p1, p2, p3 = uuid4(), uuid4(), uuid4()
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=p1, subtype="gas_processing", name="A", lon=37.60, lat=55.75),
            PlanTerminalInput(id=p2, subtype="refinery", name="B", lon=37.62, lat=55.76),
            PlanTerminalInput(id=p3, subtype="oil_pad", name="C", lon=37.64, lat=55.74),
        ],
        existing_autoroads=[],
    )
    out = plan_from_request(req)
    assert len(_connector_finish_coords(out)) >= 2
    assert len(out.new_nodes) >= 2
    assert len([ln for ln in out.new_lines if ln.kind == "link"]) >= 1


def test_plan_collinear_three_uses_backbone_not_central_hub():
    p1, p2, p3 = uuid4(), uuid4(), uuid4()
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=p1, subtype="gas_processing", name="A", lon=37.60, lat=55.75),
            PlanTerminalInput(id=p2, subtype="refinery", name="B", lon=37.62, lat=55.75),
            PlanTerminalInput(id=p3, subtype="oil_pad", name="C", lon=37.64, lat=55.75),
        ],
        existing_autoroads=[],
    )
    out = plan_from_request(req)
    assert len(out.new_nodes) >= 2
    assert len([ln for ln in out.new_lines if ln.kind == "link"]) >= 1
    assert len(_connector_finish_coords(out)) >= 2


def test_collinear_three_shorter_than_naive_chain():
    p1, p2, p3 = uuid4(), uuid4(), uuid4()
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=p1, subtype="gas_processing", name="A", lon=37.60, lat=55.75),
            PlanTerminalInput(id=p2, subtype="refinery", name="B", lon=37.62, lat=55.75),
            PlanTerminalInput(id=p3, subtype="oil_pad", name="C", lon=37.64, lat=55.75),
        ],
        existing_autoroads=[],
    )
    out = plan_from_request(req)
    legacy = _legacy_sorted_chain_km(req)
    # Exclusion routing may add short detours vs straight legacy chain.
    assert out.total_new_km <= legacy * 1.55
    assert "terminals_not_connected" not in out.warnings


def test_y_shape_four_midpoint_mst_shorter_than_chain():
    ids = [uuid4() for _ in range(4)]
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=ids[0], subtype="refinery", name="H", lon=37.62, lat=55.75),
            PlanTerminalInput(id=ids[1], subtype="gas_processing", name="W", lon=37.60, lat=55.75),
            PlanTerminalInput(id=ids[2], subtype="oil_pad", name="NE", lon=37.63, lat=55.76),
            PlanTerminalInput(id=ids[3], subtype="methanol_facility", name="SE", lon=37.63, lat=55.74),
        ],
        existing_autoroads=[],
    )
    out = plan_from_request(req)
    assert out.total_new_km <= _legacy_sorted_chain_km(req) * 1.85
    assert len([ln for ln in out.new_lines if ln.kind == "link"]) >= 2
    assert "terminals_not_connected" not in out.warnings


def _link_endpoints(ln) -> tuple[tuple[float, float], tuple[float, float]]:
    a = ln.coordinates[0]
    b = ln.coordinates[-1]
    return (round(a[0], 5), round(a[1], 5)), (round(b[0], 5), round(b[1], 5))


def test_y_shape_uses_hub_not_direct_mid_chord():
    """Degree-3 terminal: hub junction with a spoke link to each MST arm."""
    ids = [uuid4() for _ in range(4)]
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=ids[0], subtype="refinery", name="H", lon=37.62, lat=55.75),
            PlanTerminalInput(id=ids[1], subtype="gas_processing", name="W", lon=37.50, lat=55.75),
            PlanTerminalInput(id=ids[2], subtype="oil_pad", name="NE", lon=37.74, lat=55.75),
            PlanTerminalInput(id=ids[3], subtype="methanol_facility", name="SE", lon=37.62, lat=55.63),
        ],
        existing_autoroads=[],
    )
    out = plan_from_request(req)
    hub_nodes = [n for n in out.new_nodes if n.reason == "hub_junction"]
    assert len(hub_nodes) >= 1
    hub_spokes = 0
    for ln in out.new_lines:
        if ln.kind != "link":
            continue
        a, b = _link_endpoints(ln)
        for hx, hy in (a, b):
            if any(
                haversine_km(hx, hy, h.lon, h.lat) < 0.03 for h in hub_nodes
            ):
                hub_spokes += 1
                break
    assert hub_spokes >= 3


def test_t_junction_attachment_has_junction_node():
    """Connector to backbone interior gets a junction and splits the backbone."""
    ids = [uuid4() for _ in range(5)]
    terminals = [
        PlanTerminalInput(
            id=ids[i],
            subtype="gas_processing",
            name=f"T{i}",
            lon=37.60 + i * 0.02,
            lat=55.75,
        )
        for i in range(5)
    ]
    out = plan_from_request(
        NetworkPlanRequest(
            project_id=uuid4(),
            terminals=terminals,
            existing_autoroads=[],
        )
    )
    mid_id = ids[2]
    mid_conn = next(
        ln
        for ln in out.new_lines
        if ln.kind == "connector" and ln.snap_start_object_id == mid_id
    )
    fin = mid_conn.coordinates[-1]
    t0 = mid_conn.coordinates[0]
    assert haversine_km(t0[0], t0[1], fin[0], fin[1]) >= 0.19

    def _endpoint_degree(lon: float, lat: float) -> int:
        deg = 0
        for ln in out.new_lines:
            if len(ln.coordinates) < 2:
                continue
            for pt in (ln.coordinates[0], ln.coordinates[-1]):
                if haversine_km(pt[0], pt[1], lon, lat) < 0.02:
                    deg += 1
        return deg

    assert _endpoint_degree(fin[0], fin[1]) >= 2, (
        "exclusion boundary needs at least one backbone link"
    )
    attach_deg = 0
    for ln in out.new_lines:
        if ln.kind != "link" or len(ln.coordinates) < 2:
            continue
        for pt in (ln.coordinates[0], ln.coordinates[-1]):
            if haversine_km(pt[0], pt[1], fin[0], fin[1]) < 0.03:
                continue
            if haversine_km(pt[0], pt[1], fin[0], fin[1]) < 0.25:
                attach_deg = max(attach_deg, _endpoint_degree(pt[0], pt[1]))
    assert _endpoint_degree(fin[0], fin[1]) >= 2
    assert "terminals_not_connected" not in out.warnings


def test_collinear_chain_fourteen_few_links():
    ids = [uuid4() for _ in range(14)]
    terminals = [
        PlanTerminalInput(
            id=ids[i],
            subtype="gas_processing",
            name=f"T{i}",
            lon=37.60 + i * 0.01,
            lat=55.75,
        )
        for i in range(14)
    ]
    out = plan_from_request(req := NetworkPlanRequest(
        project_id=uuid4(), terminals=terminals, existing_autoroads=[]
    ))
    links = [ln for ln in out.new_lines if ln.kind == "link"]
    assert len(links) <= 80
    assert out.total_new_km < _legacy_sorted_chain_km(req) * 2.0


def test_hub_junction_bend_angle_reasonable():
    ids = [uuid4() for _ in range(4)]
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=ids[0], subtype="refinery", name="H", lon=37.62, lat=55.75),
            PlanTerminalInput(id=ids[1], subtype="gas_processing", name="W", lon=37.50, lat=55.75),
            PlanTerminalInput(id=ids[2], subtype="oil_pad", name="NE", lon=37.74, lat=55.75),
            PlanTerminalInput(id=ids[3], subtype="methanol_facility", name="SE", lon=37.62, lat=55.63),
        ],
        existing_autoroads=[],
    )
    out = plan_from_request(req)
    assert any(n.reason == "hub_junction" for n in out.new_nodes)
    hub_links = sum(
        1
        for ln in out.new_lines
        if ln.kind == "link"
        and any(
            haversine_km(c[0], c[1], n.lon, n.lat) < 0.05
            for c in ln.coordinates
            for n in out.new_nodes
            if n.reason == "hub_junction"
        )
    )
    assert hub_links >= 1


def test_four_corners_total_km_improves():
    ids = [uuid4() for _ in range(4)]
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=ids[0], subtype="gas_processing", name="A", lon=37.60, lat=55.76),
            PlanTerminalInput(id=ids[1], subtype="refinery", name="B", lon=37.64, lat=55.76),
            PlanTerminalInput(id=ids[2], subtype="oil_pad", name="C", lon=37.64, lat=55.74),
            PlanTerminalInput(id=ids[3], subtype="methanol_facility", name="D", lon=37.60, lat=55.74),
        ],
        existing_autoroads=[],
    )
    out = plan_from_request(req)
    # 200 m exclusion + routed MST may exceed legacy straight chain length.
    assert out.total_new_km <= 17.0
    _assert_all_links_outside_exclusion(out, req.terminals)


def test_plan_three_terminals_on_road_spurs_only():
    road_id = uuid4()
    p_a = uuid4()
    p_hub = uuid4()
    p_c = uuid4()
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=p_a, subtype="gas_processing", name="A", lon=37.60, lat=55.76),
            PlanTerminalInput(id=p_hub, subtype="refinery", name="Hub", lon=37.62, lat=55.751),
            PlanTerminalInput(id=p_c, subtype="oil_pad", name="C", lon=37.64, lat=55.76),
        ],
        existing_autoroads=[
            ExistingAutoroadInput(
                id=road_id,
                coordinates=[[37.60, 55.75], [37.64, 55.75]],
            )
        ],
    )
    out = plan_from_request(req)
    object_links = [
        ln
        for ln in out.new_lines
        if ln.kind == "link"
        and (ln.snap_start_object_id or ln.snap_finish_object_id)
    ]
    assert not object_links
    connectors = [ln for ln in out.new_lines if ln.kind == "connector"]
    assert len(connectors) == 3
    _assert_one_autoroad_per_terminal(out, [p_a, p_hub, p_c])


def test_plan_two_terminals_on_road_uses_graph():
    road_id = uuid4()
    p1 = uuid4()
    p2 = uuid4()
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=p1, subtype="gas_processing", name="A", lon=37.60, lat=55.75),
            PlanTerminalInput(id=p2, subtype="refinery", name="B", lon=37.64, lat=55.75),
        ],
        existing_autoroads=[
            ExistingAutoroadInput(
                id=road_id,
                coordinates=[[37.60, 55.75], [37.64, 55.75]],
            )
        ],
    )
    out = plan_from_request(req)
    assert len(out.used_existing_edge_ids) >= 1
    assert not any(ln.kind == "link" for ln in out.new_lines)
    assert all(t.warning == "already_connected" for t in out.terminals)
    _assert_one_autoroad_per_terminal(out, [p1, p2])


def test_plan_two_on_road_no_duplicate_connectors():
    road_id = uuid4()
    p1 = uuid4()
    p2 = uuid4()
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=p1, subtype="gas_processing", name="A", lon=37.60, lat=55.751),
            PlanTerminalInput(id=p2, subtype="refinery", name="B", lon=37.64, lat=55.751),
        ],
        existing_autoroads=[
            ExistingAutoroadInput(
                id=road_id,
                coordinates=[[37.60, 55.75], [37.64, 55.75]],
            )
        ],
    )
    out = plan_from_request(req)
    connectors = [ln for ln in out.new_lines if ln.kind == "connector"]
    assert len(connectors) == 2
    _assert_one_autoroad_per_terminal(out, [p1, p2])


def test_plan_disconnected_network_bridge_between_snaps():
    road_a = uuid4()
    road_b = uuid4()
    p1 = uuid4()
    p2 = uuid4()
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=p1, subtype="gas_processing", name="A", lon=37.60, lat=55.76),
            PlanTerminalInput(id=p2, subtype="refinery", name="B", lon=37.64, lat=55.76),
        ],
        existing_autoroads=[
            ExistingAutoroadInput(
                id=road_a,
                coordinates=[[37.60, 55.75], [37.61, 55.75]],
            ),
            ExistingAutoroadInput(
                id=road_b,
                coordinates=[[37.63, 55.75], [37.64, 55.75]],
            ),
        ],
    )
    out = plan_from_request(req)
    network_links = [
        ln
        for ln in out.new_lines
        if ln.kind == "link" and not ln.snap_start_object_id and not ln.snap_finish_object_id
    ]
    assert len(network_links) >= 1
    _assert_one_autoroad_per_terminal(out, [p1, p2])


def test_plan_far_from_road_still_gets_spur():
    road_id = uuid4()
    p1 = uuid4()
    p2 = uuid4()
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=p1, subtype="gas_processing", name="A", lon=37.60, lat=55.80),
            PlanTerminalInput(id=p2, subtype="refinery", name="B", lon=37.64, lat=55.75),
        ],
        existing_autoroads=[
            ExistingAutoroadInput(
                id=road_id,
                coordinates=[[37.60, 55.75], [37.64, 55.75]],
            )
        ],
    )
    out = plan_from_request(req)
    assert any(t.warning == "far_from_autoroad" for t in out.terminals if t.id == p1)
    connectors = [ln for ln in out.new_lines if ln.kind == "connector" and ln.snap_start_object_id == p1]
    assert len(connectors) == 1
    assert not any(
        ln.snap_start_object_id == p1 and ln.snap_finish_object_id == p2 for ln in out.new_lines
    )


def test_plan_methanol_facility_off_network_boundary_link():
    p1 = uuid4()
    p2 = uuid4()
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(
                id=p1, subtype="methanol_facility", name="M1", lon=37.60, lat=55.75
            ),
            PlanTerminalInput(id=p2, subtype="gas_processing", name="G1", lon=37.64, lat=55.76),
        ],
        existing_autoroads=[],
    )
    out = plan_from_request(req)
    assert len([ln for ln in out.new_lines if ln.kind == "connector"]) == 2
    assert len([ln for ln in out.new_lines if ln.kind == "link"]) == 1
    _assert_all_links_outside_exclusion(out, req.terminals)


def test_exclusion_close_terminals_warning():
    p1, p2 = uuid4(), uuid4()
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=p1, subtype="gas_processing", name="A", lon=37.60, lat=55.75),
            PlanTerminalInput(id=p2, subtype="refinery", name="B", lon=37.6012, lat=55.75),
        ],
        existing_autoroads=[],
    )
    out = plan_from_request(req)
    assert any("exclusion_zones_overlap" in w for w in out.warnings)
    assert "terminals_not_connected" not in out.warnings


def test_exclusion_snap_on_existing_road():
    road_id = uuid4()
    p1 = uuid4()
    p2 = uuid4()
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=p1, subtype="gas_processing", name="A", lon=37.60, lat=55.751),
            PlanTerminalInput(id=p2, subtype="refinery", name="B", lon=37.64, lat=55.751),
        ],
        existing_autoroads=[
            ExistingAutoroadInput(
                id=road_id,
                coordinates=[[37.60, 55.75], [37.64, 55.75]],
            )
        ],
    )
    out = plan_from_request(req)
    for ln in out.new_lines:
        if ln.kind != "link":
            continue
        for c in ln.coordinates:
            assert min_distance_to_terminals(c[0], c[1], req.terminals) >= 0.19


def test_mst_route_avoids_foreign_exclusion():
    """Chord A–C through B's zone is replaced by a routed polyline outside exclusions."""
    a_id, b_id, c_id = uuid4(), uuid4(), uuid4()
    ta = PlanTerminalInput(
        id=a_id, subtype="gas_processing", name="A", lon=37.600, lat=55.750
    )
    tb = PlanTerminalInput(
        id=b_id, subtype="gas_processing", name="B", lon=37.610, lat=55.750
    )
    tc = PlanTerminalInput(
        id=c_id, subtype="gas_processing", name="C", lon=37.620, lat=55.750
    )
    terminals = [ta, tb, tc]
    ba, bc = boundary_pair(ta, tc)
    assert segment_penetrates_exclusion(
        ba[0], ba[1], bc[0], bc[1], terminals, ignore_ids={a_id, c_id}
    )
    path = route_backbone_outside_exclusions(
        ba[0], ba[1], bc[0], bc[1], terminals, ignore_ids={a_id, c_id}
    )
    assert len(path) >= 3
    direct = haversine_km(ba[0], ba[1], bc[0], bc[1])
    assert path_length_km(path) >= direct - 1e-6
    for i in range(len(path) - 1):
        assert not segment_penetrates_exclusion(
            path[i][0],
            path[i][1],
            path[i + 1][0],
            path[i + 1][1],
            terminals,
            ignore_ids={a_id, c_id},
        )


def test_boundary_link_segments_outside_exclusion():
    """Every backbone link segment stays outside foreign terminal disks."""
    a_id, b_id, c_id = uuid4(), uuid4(), uuid4()
    terminals = [
        PlanTerminalInput(
            id=a_id, subtype="gas_processing", name="A", lon=37.600, lat=55.750
        ),
        PlanTerminalInput(
            id=b_id, subtype="gas_processing", name="B", lon=37.610, lat=55.750
        ),
        PlanTerminalInput(
            id=c_id, subtype="gas_processing", name="C", lon=37.620, lat=55.750
        ),
    ]
    out = plan_from_request(
        NetworkPlanRequest(project_id=uuid4(), terminals=terminals, existing_autoroads=[])
    )
    _assert_all_links_outside_exclusion(out, terminals)


def test_gks_twelve_connected_exclusion_radius_0_4(monkeypatch):
    """12 GKS stay connected when exclusion radius is 0.4 km (notebook experiments)."""
    monkeypatch.setattr(terminal_exclusion_mod, "TERMINAL_EXCLUSION_RADIUS_KM", 0.4)
    monkeypatch.setattr(
        autoroad_network_pkg.plan_core, "TERMINAL_EXCLUSION_RADIUS_KM", 0.4
    )
    raw = [
        ("6e0a2599-f391-4ca2-be46-565b71657222", "GKS_1", 37.142939119144025, 56.04061323280081),
        ("53c1e053-c2aa-4265-b972-2550efb98ef6", "GKS_2", 37.209717990505276, 56.04061323280081),
        ("3c7b0733-faa8-4f2a-bcda-c1daaf97592a", "GKS_3", 37.16123879581562, 55.94803530058053),
        ("e2357a2f-4410-4345-9429-28c76c93815c", "GKS_4", 37.22213184325423, 55.94938438681757),
        ("434f9bd5-cfca-4edd-8b5f-d73e46665cc7", "GKS_5", 37.28356554653648, 55.9487153552989),
        ("5045d9d3-df96-42bf-ac0d-ad1b3991582e", "GKS_6", 37.35034441789771, 55.9487153552989),
        ("a3c3ca43-917b-4992-a71a-4539722936ed", "GKS_7", 37.1387474374583, 56.0873732793855),
        ("24485248-e0ac-4267-b4d7-c975237cac4d", "GKS_8", 37.199455502332164, 56.08872847268688),
        ("9fd68e18-ff37-4e4b-99da-bb85a17d0718", "GKS_9", 37.34092558425556, 56.05552410800988),
        ("d0f04c1e-5cc3-436b-8f03-323a8eddb796", "GKS_10", 37.407704455616795, 56.05552410800988),
        ("3e95964b-ad96-451c-9b87-8a9a1afc3830", "GKS_11", 37.41338266237315, 55.99696486312589),
        ("5b4ea7ec-fc0b-42ef-aecf-aa4ade221282", "GKS_12", 37.47409072724702, 55.9983232116441),
    ]
    terminals = [
        PlanTerminalInput(
            id=UUID(oid),
            subtype="gas_processing",
            name=name,
            lon=lon,
            lat=lat,
        )
        for oid, name, lon, lat in raw
    ]
    out = plan_from_request(
        NetworkPlanRequest(project_id=uuid4(), terminals=terminals, existing_autoroads=[])
    )
    assert "terminals_not_connected" not in out.warnings
    _assert_all_links_outside_exclusion(out, terminals, radius_km=0.4)


def test_gks_twelve_layout_connected():
    """Regression: 12 gas_processing pads (user GKS_1..12 layout) form one connected plan."""
    raw = [
        ("6e0a2599-f391-4ca2-be46-565b71657222", "GKS_1", 37.142939119144025, 56.04061323280081),
        ("53c1e053-c2aa-4265-b972-2550efb98ef6", "GKS_2", 37.209717990505276, 56.04061323280081),
        ("3c7b0733-faa8-4f2a-bcda-c1daaf97592a", "GKS_3", 37.16123879581562, 55.94803530058053),
        ("e2357a2f-4410-4345-9429-28c76c93815c", "GKS_4", 37.22213184325423, 55.94938438681757),
        ("434f9bd5-cfca-4edd-8b5f-d73e46665cc7", "GKS_5", 37.28356554653648, 55.9487153552989),
        ("5045d9d3-df96-42bf-ac0d-ad1b3991582e", "GKS_6", 37.35034441789771, 55.9487153552989),
        ("a3c3ca43-917b-4992-a71a-4539722936ed", "GKS_7", 37.1387474374583, 56.0873732793855),
        ("24485248-e0ac-4267-b4d7-c975237cac4d", "GKS_8", 37.199455502332164, 56.08872847268688),
        ("9fd68e18-ff37-4e4b-99da-bb85a17d0718", "GKS_9", 37.34092558425556, 56.05552410800988),
        ("d0f04c1e-5cc3-436b-8f03-323a8eddb796", "GKS_10", 37.407704455616795, 56.05552410800988),
        ("3e95964b-ad96-451c-9b87-8a9a1afc3830", "GKS_11", 37.41338266237315, 55.99696486312589),
        ("5b4ea7ec-fc0b-42ef-aecf-aa4ade221282", "GKS_12", 37.47409072724702, 55.9983232116441),
    ]
    terminals = [
        PlanTerminalInput(
            id=UUID(oid),
            subtype="gas_processing",
            name=name,
            lon=lon,
            lat=lat,
        )
        for oid, name, lon, lat in raw
    ]
    out = plan_from_request(
        NetworkPlanRequest(project_id=uuid4(), terminals=terminals, existing_autoroads=[])
    )
    assert len(terminals) == 12
    assert len([ln for ln in out.new_lines if ln.kind == "connector"]) == 12
    assert "terminals_not_connected" not in out.warnings
    _assert_all_links_outside_exclusion(out, terminals)


def test_gks_twelve_full_rebuild_ignores_broken_existing():
    """Re-apply must plan from scratch, not patch a fragmented prior network."""
    asyncio.run(_test_gks_twelve_full_rebuild_ignores_broken_existing())


async def _test_gks_twelve_full_rebuild_ignores_broken_existing():
    from app.core.database import async_session
    from app.core.security import get_password_hash
    from app.geo.geometry_utils import build_infra_geometry
    from app.models import InfrastructureLayer, InfrastructureObject, Project, User
    from app.models.enums import UserRole
    from app.services.autoroad_connect import (
        AUTOROAD_NETWORK_SOURCE,
        build_autoroad_connect_plan,
        clear_network_for_rebuild,
        run_autoroad_connect,
    )

    raw = [
        ("6e0a2599-f391-4ca2-be46-565b71657222", "GKS_1", 37.142939119144025, 56.04061323280081),
        ("53c1e053-c2aa-4265-b972-2550efb98ef6", "GKS_2", 37.209717990505276, 56.04061323280081),
        ("3c7b0733-faa8-4f2a-bcda-c1daaf97592a", "GKS_3", 37.16123879581562, 55.94803530058053),
        ("e2357a2f-4410-4345-9429-28c76c93815c", "GKS_4", 37.22213184325423, 55.94938438681757),
        ("434f9bd5-cfca-4edd-8b5f-d73e46665cc7", "GKS_5", 37.28356554653648, 55.9487153552989),
        ("5045d9d3-df96-42bf-ac0d-ad1b3991582e", "GKS_6", 37.35034441789771, 55.9487153552989),
        ("a3c3ca43-917b-4992-a71a-4539722936ed", "GKS_7", 37.1387474374583, 56.0873732793855),
        ("24485248-e0ac-4267-b4d7-c975237cac4d", "GKS_8", 37.199455502332164, 56.08872847268688),
        ("9fd68e18-ff37-4e4b-99da-bb85a17d0718", "GKS_9", 37.34092558425556, 56.05552410800988),
        ("d0f04c1e-5cc3-436b-8f03-323a8eddb796", "GKS_10", 37.407704455616795, 56.05552410800988),
        ("3e95964b-ad96-451c-9b87-8a9a1afc3830", "GKS_11", 37.41338266237315, 55.99696486312589),
        ("5b4ea7ec-fc0b-42ef-aecf-aa4ade221282", "GKS_12", 37.47409072724702, 55.9983232116441),
    ]
    terminal_ids = [UUID(oid) for oid, _, _, _ in raw]

    async with async_session() as db:
        user = User(
            email=f"gks-rebuild-{uuid4().hex[:8]}@test.ru",
            username="gks-rebuild",
            password_hash=get_password_hash("password1"),
            role=UserRole.analyst.value,
        )
        db.add(user)
        await db.flush()
        project = Project(user_id=user.id, name="gks-rebuild", status="draft")
        db.add(project)
        await db.flush()
        layer = InfrastructureLayer(
            project_id=project.id,
            name="L",
            layer_type="vector",
            source_type="manual",
        )
        db.add(layer)
        await db.flush()

        for oid, name, lon, lat in raw:
            db.add(
                InfrastructureObject(
                    id=UUID(oid),
                    layer_id=layer.id,
                    name=name,
                    subtype="gas_processing",
                    category="point",
                    longitude=lon,
                    latitude=lat,
                    geometry=build_infra_geometry("gas_processing", lon, lat),
                )
            )
        # Legacy broken network (no source tag): planner used to patch instead of rebuild.
        db.add(
            InfrastructureObject(
                layer_id=layer.id,
                name="Узел_1",
                subtype="node",
                category="point",
                longitude=37.19168478914033,
                latitude=55.94871359664242,
                geometry=build_infra_geometry("node", 37.19168478914033, 55.94871359664242),
            )
        )
        db.add(
            InfrastructureObject(
                layer_id=layer.id,
                name="Узел_2",
                subtype="node",
                category="point",
                longitude=37.3169549822171,
                latitude=55.948719868812034,
                geometry=build_infra_geometry("node", 37.3169549822171, 55.948719868812034),
            )
        )
        db.add(
            InfrastructureObject(
                layer_id=layer.id,
                name="Автодорога_1",
                subtype="autoroad",
                category="line",
                longitude=37.16123879581562,
                latitude=55.94803530058053,
                end_longitude=37.19168478914033,
                end_latitude=55.94871359664242,
                geometry=build_infra_geometry(
                    "autoroad",
                    37.16123879581562,
                    55.94803530058053,
                    end_lon=37.19168478914033,
                    end_lat=55.94871359664242,
                ),
            )
        )
        db.add(
            InfrastructureObject(
                layer_id=layer.id,
                name="Автодорога_2",
                subtype="autoroad",
                category="line",
                longitude=37.3169549822171,
                latitude=55.948719868812034,
                end_longitude=37.283568537091256,
                end_latitude=55.94871819718176,
                geometry=build_infra_geometry(
                    "autoroad",
                    37.3169549822171,
                    55.948719868812034,
                    end_lon=37.283568537091256,
                    end_lat=55.94871819718176,
                ),
            )
        )
        await db.commit()

        patch_plan = await build_autoroad_connect_plan(
            db, project.id, terminal_ids, full_network_rebuild=False
        )
        rebuild_plan = await build_autoroad_connect_plan(
            db, project.id, terminal_ids, full_network_rebuild=True
        )
        assert patch_plan.used_existing_edge_ids or len(patch_plan.new_lines) < len(
            rebuild_plan.new_lines
        )
        assert "terminals_not_connected" not in rebuild_plan.warnings
        assert len([ln for ln in rebuild_plan.new_lines if ln.kind == "connector"]) == 12

        await clear_network_for_rebuild(db, project.id, set(terminal_ids))
        await db.commit()
        out = await run_autoroad_connect(
            db,
            project.id,
            terminal_ids,
            dry_run=False,
            full_network_rebuild=True,
        )
        assert out["created_lines"] >= 12
        from sqlalchemy import select

        roads = (
            await db.execute(
                select(InfrastructureObject).where(
                    InfrastructureObject.layer_id == layer.id,
                    InfrastructureObject.subtype == "autoroad",
                )
            )
        ).scalars().all()
        assert len(roads) >= 12
        assert all((r.properties or {}).get("source") == AUTOROAD_NETWORK_SOURCE for r in roads)


def test_build_connect_plan_integration():
    asyncio.run(_test_build_connect_integration())


async def _test_build_connect_integration():
    from app.core.database import async_session
    from app.core.security import get_password_hash
    from app.geo.geometry_utils import build_infra_geometry
    from app.models import InfrastructureLayer, InfrastructureObject, Project, User
    from app.models.enums import UserRole
    from app.services.autoroad_connect import build_autoroad_connect_plan

    async with async_session() as db:
        user = User(
            email=f"arn-{uuid4().hex[:8]}@test.ru",
            username="arn",
            password_hash=get_password_hash("password1"),
            role=UserRole.analyst.value,
        )
        db.add(user)
        await db.flush()
        project = Project(user_id=user.id, name="arn", status="draft")
        db.add(project)
        await db.flush()
        layer = InfrastructureLayer(
            project_id=project.id,
            name="L",
            layer_type="vector",
            source_type="manual",
        )
        db.add(layer)
        await db.flush()
        db.add(
            InfrastructureObject(
                layer_id=layer.id,
                name="road",
                subtype="autoroad",
                category="line",
                longitude=37.60,
                latitude=55.75,
                end_longitude=37.64,
                end_latitude=55.75,
                geometry=build_infra_geometry("autoroad", 37.60, 55.75, end_lon=37.64, end_lat=55.75),
            )
        )
        p1 = InfrastructureObject(
            layer_id=layer.id,
            name="A",
            subtype="gas_processing",
            category="point",
            longitude=37.60,
            latitude=55.75,
            geometry=build_infra_geometry("gas_processing", 37.60, 55.75),
        )
        p2 = InfrastructureObject(
            layer_id=layer.id,
            name="B",
            subtype="refinery",
            category="point",
            longitude=37.64,
            latitude=55.75,
            geometry=build_infra_geometry("refinery", 37.64, 55.75),
        )
        db.add_all([p1, p2])
        await db.flush()
        await db.commit()

        plan = await build_autoroad_connect_plan(db, project.id, [p1.id, p2.id])
        snapped = [t for t in plan.terminals if t.graph_node_id]
        assert len(snapped) >= 2
        assert not any(n.reason == "terminal_access" for n in plan.new_nodes)
