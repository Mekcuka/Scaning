"""Planning pipeline: SMT over terminals; start/end are terminal roles."""



from __future__ import annotations



import math

from typing import Literal

from uuid import UUID



from network_planner.geo.projection import LocalProjection

from network_planner.schemas.io import (

    PlanRequest,

    PlanResponse,

    SteinerEdgeOut,

    SteinerPointOut,

    SteinerTreeOut,

    TerminalResultOut,

)

from network_planner.steiner.constraints import (
    AttachmentLimits,
    attachment_radius_warnings,
    build_attachment_limits_from_request,
    terminal_leaf_edge_length,
    tree_respects_attachment_limits,
)
from network_planner.steiner.terminal_attach import apply_attachment_limits

from network_planner.steiner.geosteiner import (

    GeoSteinerNotAvailableError,

    GeoSteinerRunError,

    solve_steiner_tree_geosteiner,

)

from network_planner.steiner.steinerpy import (

    SteinerPyNotAvailableError,

    SteinerPyRunError,

    solve_steiner_tree_steinerpy,

)

from network_planner.steiner.subdivide import subdivide_tree_edges

from network_planner.steiner.steiner_radius import repel_steiner_points

from network_planner.steiner.types import SteinerTreeResult

from network_planner.steiner.union_find import UnionFind

from network_planner.steiner.validate import leaf_degree_violations, normalize_terminal_leaves





def _steinerpy_kwargs(req: PlanRequest) -> dict[str, object]:
    out: dict[str, object] = {}
    if req.options.attachment_angle_penalty > 0:
        out["angle_target_deg"] = req.options.attachment_angle_deg
        out["angle_penalty"] = req.options.attachment_angle_penalty
    if req.options.steiner_radius_km > 0:
        out["steiner_radius_m"] = req.options.steiner_radius_km * 1000.0
    return out


def _leaf_normalize_kwargs(req: PlanRequest) -> dict[str, object]:

    return {

        "normalize_leaves": req.options.normalize_terminal_leaves,

        "steiner_hub_prefix": req.options.steiner_hub_prefix,

        "hub_offset_m": req.options.steiner_hub_offset_km * 1000.0,

    }





def _connected_components(tree: SteinerTreeResult) -> list[set[str]]:
    """Return list of node-id sets, one per connected component of the tree."""
    nodes: set[str] = set()
    for a, b, _, _ in tree.edges:
        nodes.add(a)
        nodes.add(b)
    for sid in tree.steiner_points:
        nodes.add(sid)
    index = {v: i for i, v in enumerate(nodes)}
    uf = UnionFind(len(index))
    for a, b, _, _ in tree.edges:
        uf.union(index[a], index[b])
    component_of = {i: uf.find(i) for i in range(len(index))}
    by_root: dict[int, set[str]] = {}
    for v, i in index.items():
        by_root.setdefault(component_of[i], set()).add(v)
    return list(by_root.values())


def _ensure_tree_connected(
    tree: SteinerTreeResult,
    *,
    solver_tag: str,
    warnings: list[str],
    graph_ids: list[str] | None = None,
    local_pts: list[tuple[float, float]] | None = None,
) -> SteinerTreeResult:
    """
    Strict prohibition on multi-component trees.

    Strategy (in order of preference):
    1. If SteinerPy is available and we have graph_ids/local_pts, rebuild the
       tree via SteinerPy using this tree's Steiner points as candidates.
       This preserves the optimality of the original solver's points while
       letting HiGHS find the correct connection topology.
    2. Otherwise, repeatedly connect the closest pair of nodes across
       distinct components with a direct edge.
    """
    components = _connected_components(tree)
    if len(components) <= 1:
        return tree

    if graph_ids is not None and local_pts is not None:
        try:
            from network_planner.steiner.steinerpy import (
                is_steinerpy_available,
                solve_steiner_tree_steinerpy,
            )

            if is_steinerpy_available():
                rebuilt = solve_steiner_tree_steinerpy(
                    graph_ids,
                    local_pts,
                    normalize_leaves=False,
                    steiner_candidates=tree,
                )
                rebuilt_components = _connected_components(rebuilt)
                if len(rebuilt_components) <= 1:
                    warnings.append(f"{solver_tag}_disconnected_components_fixed")
                    return rebuilt
        except Exception:
            pass

    warnings.append(f"{solver_tag}_disconnected_components_fixed")

    pt_of: dict[str, tuple[float, float]] = {}
    for sid, pt in tree.steiner_points.items():
        pt_of[sid] = pt
    for a, b, pa, pb in tree.edges:
        pt_of.setdefault(a, pa)
        pt_of.setdefault(b, pb)

    component_id: dict[str, int] = {}
    for i, comp in enumerate(components):
        for nid in comp:
            component_id[nid] = i

    edges_out = list(tree.edges)
    total_added = 0.0
    remaining = len(components)
    while remaining > 1:
        best_d = math.inf
        best_pair: tuple[str, str] | None = None
        for i in range(len(components)):
            for j in range(i + 1, len(components)):
                for u in components[i]:
                    if u not in pt_of:
                        continue
                    pu = pt_of[u]
                    for v in components[j]:
                        if v not in pt_of:
                            continue
                        pv = pt_of[v]
                        d = math.hypot(pu[0] - pv[0], pu[1] - pv[1])
                        if d < best_d:
                            best_d = d
                            best_pair = (u, v)
        if best_pair is None:
            break
        u, v = best_pair
        edges_out.append((u, v, pt_of[u], pt_of[v]))
        total_added += best_d

        target_cid = component_id[u]
        source_cid = component_id[v]
        for nid in components[source_cid]:
            component_id[nid] = target_cid
        components[target_cid] |= components[source_cid]
        components[source_cid] = set()
        remaining -= 1

    return SteinerTreeResult(
        edges=edges_out,
        steiner_points=dict(tree.steiner_points),
        length_m=tree.length_m + total_added,
        heuristic=tree.heuristic,
    )


def _apply_steiner_radius(
    tree: SteinerTreeResult,
    local_pts: list[tuple[float, float]],
    req: PlanRequest,
    warnings: list[str],
    *,
    solver_tag: str,
) -> SteinerTreeResult:
    radius_m = req.options.steiner_radius_km * 1000.0
    if radius_m <= 0:
        return tree
    repelled = repel_steiner_points(tree, local_pts, radius_m)
    if any(
        _dist(repelled.steiner_points[sid], tree.steiner_points[sid]) > 1e-9
        for sid in tree.steiner_points
        if sid in repelled.steiner_points
    ):
        warnings.append(f"{solver_tag}_steiner_radius_repel")
    if req.options.connector_max_km * 1000.0 < radius_m and req.options.enforce_attachment_radius:
        warnings.append(f"{solver_tag}_steiner_radius_vs_attachment_conflict")
    return repelled


def _dist(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _apply_constrained_fallback(
    tree: SteinerTreeResult,
    graph_ids: list[str],
    local_pts: list[tuple[float, float]],
    limits: AttachmentLimits | None,
    req: PlanRequest,
    warnings: list[str],
    *,
    solver_tag: str,
) -> SteinerTreeResult:
    if limits is None or tree_respects_attachment_limits(
        tree, graph_ids, local_pts, limits
    ):
        return tree
    warnings.append(f"{solver_tag}_attachment_radius_violation")
    adjusted = apply_attachment_limits(tree, graph_ids, local_pts, limits)
    if not tree_respects_attachment_limits(adjusted, graph_ids, local_pts, limits):
        warnings.append("solver_fallback:constrained_star")
    return adjusted


def _ensure_terminal_leaves(
    tree: SteinerTreeResult,
    graph_ids: list[str],
    req: PlanRequest,
    warnings: list[str],
) -> SteinerTreeResult:
    kwargs = _leaf_normalize_kwargs(req)
    tree = normalize_terminal_leaves(
        tree,
        set(graph_ids),
        enabled=bool(kwargs["normalize_leaves"]),
        hub_prefix=str(kwargs["steiner_hub_prefix"]),
        hub_offset_m=float(kwargs["hub_offset_m"]),
    )
    if kwargs.get("enabled", True):
        viol = leaf_degree_violations(tree.edges, set(graph_ids))
        if viol and "terminal_degree_violation" not in warnings:
            warnings.append("terminal_degree_violation")
    return tree


def _apply_postprocess(tree: SteinerTreeResult, req: PlanRequest) -> SteinerTreeResult:

    spacing_m = req.options.edge_vertex_spacing_km * 1000.0

    if spacing_m > 0:

        tree = subdivide_tree_edges(tree, spacing_m)

    return tree





def _id_terminal(uid: UUID) -> str:

    return f"terminal:{uid}"





def _terminal_attachment(

    tree: SteinerTreeResult,

    terminal_graph_id: str,

    local_pt: tuple[float, float],

) -> tuple[str, float]:

    edge_len = terminal_leaf_edge_length(tree, terminal_graph_id, local_pt)

    for a, b, pta, ptb in tree.edges:

        if a == terminal_graph_id:

            return b, edge_len

        if b == terminal_graph_id:

            return a, edge_len

    return terminal_graph_id, edge_len





def _prepare_request(

    req: PlanRequest,

) -> tuple[

    LocalProjection,

    list[str],

    list[tuple[float, float]],

    dict[str, tuple[UUID, str, str, float, float]],

]:

    lons = [t.lon for t in req.terminals]

    lats = [t.lat for t in req.terminals]

    proj = LocalProjection.from_points(lons, lats)



    graph_ids: list[str] = []

    local_pts: list[tuple[float, float]] = []

    meta: dict[str, tuple[UUID, str, str, float, float]] = {}



    for t in req.terminals:

        gid = _id_terminal(t.id)

        x, y = proj.to_local(t.lon, t.lat)

        graph_ids.append(gid)

        local_pts.append((x, y))

        meta[gid] = (t.id, t.type, t.role, t.lon, t.lat)



    return proj, graph_ids, local_pts, meta





def _attachment_limits_for_request(

    graph_ids: list[str],

    req: PlanRequest,

):

    if not req.options.enforce_attachment_radius:

        return None

    return build_attachment_limits_from_request(graph_ids, req)





def _append_attachment_warnings(

    warnings: list[str],

    tree: SteinerTreeResult,

    graph_ids: list[str],

    local_pts: list[tuple[float, float]],

    req: PlanRequest,

) -> None:

    if not req.options.enforce_attachment_radius:

        return

    limits = build_attachment_limits_from_request(graph_ids, req)

    uuids = [t.id for t in req.terminals]

    for w in attachment_radius_warnings(tree, graph_ids, local_pts, uuids, limits):

        if w not in warnings:

            warnings.append(w)





def _response_from_tree(

    req: PlanRequest,

    proj: LocalProjection,

    graph_ids: list[str],

    meta: dict[str, tuple[UUID, str, str, float, float]],

    tree_local: SteinerTreeResult,

    *,

    solver: Literal["geosteiner", "steinerpy"],

    warnings: list[str],

) -> PlanResponse:

    steiner_points_out: list[SteinerPointOut] = []

    for sid, (x, y) in tree_local.steiner_points.items():

        lon, lat = proj.to_wgs84(x, y)

        steiner_points_out.append(SteinerPointOut(id=sid, lon=lon, lat=lat))



    edges_out: list[SteinerEdgeOut] = []

    for a, b, pta, ptb in tree_local.edges:

        lon_a, lat_a = proj.to_wgs84(pta[0], pta[1])

        lon_b, lat_b = proj.to_wgs84(ptb[0], ptb[1])

        edges_out.append(

            SteinerEdgeOut(

                from_id=a,

                to_id=b,

                coordinates=[[lon_a, lat_a], [lon_b, lat_b]],

            )

        )



    terminals_out: list[TerminalResultOut] = []

    for gid, (uid, ttype, role, lon, lat) in meta.items():

        loc = proj.to_local(lon, lat)

        attached, edge_len = _terminal_attachment(tree_local, gid, loc)

        terminals_out.append(

            TerminalResultOut(

                id=uid,

                type=ttype,

                role=role,

                lon=lon,

                lat=lat,

                attached_to=attached,

                via="tree",

                length_m=round(edge_len, 3),

            )

        )



    start_id = _id_terminal(next(t.id for t in req.terminals if t.role == "start"))

    end_id = _id_terminal(next(t.id for t in req.terminals if t.role == "end"))

    if not _connected(start_id, end_id, tree_local):

        warnings.append("start_end_not_connected")



    return PlanResponse(

        steiner_tree=SteinerTreeOut(

            edges=edges_out,

            steiner_points=steiner_points_out,

            length_m=round(tree_local.length_m, 3),

        ),

        terminals=terminals_out,

        warnings=warnings,

        total_length_m=round(tree_local.length_m, 3),

        solver=solver,

    )





def plan_from_request_geosteiner(req: PlanRequest) -> PlanResponse:

    """Exact Euclidean SMT via GeoSteiner (https://geosteiner.net/)."""

    warnings: list[str] = ["solver:geosteiner"]

    proj, graph_ids, local_pts, meta = _prepare_request(req)

    limits = _attachment_limits_for_request(graph_ids, req)



    try:

        tree_local = solve_steiner_tree_geosteiner(

            graph_ids,

            local_pts,

            **_leaf_normalize_kwargs(req),

        )

    except GeoSteinerNotAvailableError as exc:

        raise exc

    except GeoSteinerRunError as exc:

        raise exc



    tree_local = _ensure_tree_connected(
        tree_local,
        solver_tag="geosteiner",
        warnings=warnings,
        graph_ids=graph_ids,
        local_pts=local_pts,
    )

    tree_local = _apply_steiner_radius(
        tree_local, local_pts, req, warnings, solver_tag="geosteiner"
    )

    tree_local = _apply_constrained_fallback(
        tree_local,
        graph_ids,
        local_pts,
        limits,
        req,
        warnings,
        solver_tag="geosteiner",
    )
    tree_local = _ensure_terminal_leaves(tree_local, graph_ids, req, warnings)

    _append_attachment_warnings(warnings, tree_local, graph_ids, local_pts, req)
    tree_local = _apply_postprocess(tree_local, req)

    return _response_from_tree(
        req,
        proj,
        graph_ids,
        meta,
        tree_local,
        solver="geosteiner",
        warnings=warnings,
    )


def plan_from_request_steinerpy(req: PlanRequest) -> PlanResponse:

    """Steiner tree via SteinerPy (graph MIP + HiGHS)."""

    warnings: list[str] = ["solver:steinerpy"]

    proj, graph_ids, local_pts, meta = _prepare_request(req)

    limits = _attachment_limits_for_request(graph_ids, req)



    try:

        tree_local = solve_steiner_tree_steinerpy(
            graph_ids,
            local_pts,
            attachment_limits=limits,
            **_steinerpy_kwargs(req),
            **_leaf_normalize_kwargs(req),
        )

    except SteinerPyNotAvailableError as exc:

        raise exc

    except SteinerPyRunError as exc:

        raise exc



    tree_local = _apply_steiner_radius(
        tree_local, local_pts, req, warnings, solver_tag="steinerpy"
    )

    tree_local = _apply_constrained_fallback(
        tree_local,
        graph_ids,
        local_pts,
        limits,
        req,
        warnings,
        solver_tag="steinerpy",
    )
    tree_local = _ensure_terminal_leaves(tree_local, graph_ids, req, warnings)

    _append_attachment_warnings(warnings, tree_local, graph_ids, local_pts, req)
    tree_local = _apply_postprocess(tree_local, req)

    return _response_from_tree(
        req,
        proj,
        graph_ids,
        meta,
        tree_local,
        solver="steinerpy",
        warnings=warnings,
    )





def _connected(start: str, end: str, tree: SteinerTreeResult) -> bool:

    vertices: list[str] = []

    v_index: dict[str, int] = {}



    def add_vertex(v: str) -> None:

        if v not in v_index:

            v_index[v] = len(vertices)

            vertices.append(v)



    for a, b, _, _ in tree.edges:

        add_vertex(a)

        add_vertex(b)

    for sid in tree.steiner_points:

        add_vertex(sid)



    uf = UnionFind(len(vertices))



    def union_ids(a: str, b: str) -> None:

        if a in v_index and b in v_index:

            uf.union(v_index[a], v_index[b])



    for a, b, _, _ in tree.edges:

        union_ids(a, b)



    if start not in v_index or end not in v_index:

        return False

    return uf.find(v_index[start]) == uf.find(v_index[end])

