"""Serialize / deserialize PyWellGeo WellTreeTNO ↔ JSON."""

from __future__ import annotations

from typing import Any

import numpy as np

from well_trajectory.pywellgeo_schemas import PyWellGeoTreeNode


def _require_well_tree_class() -> Any:
    from pywellgeo.well_tree.well_tree_tno import WellTreeTNO

    return WellTreeTNO


def tree_node_to_dict(node: Any) -> PyWellGeoTreeNode:
    return PyWellGeoTreeNode(
        x=float(node.x[0]),
        y=float(node.x[1]),
        z=float(node.x[2]),
        radius=float(node.radius),
        perforated=bool(node.perforated),
        color=str(node.color),
        name=str(node.name),
        branches=[tree_node_to_dict(b) for b in node.branches],
    )


def tree_from_dict(data: PyWellGeoTreeNode | dict[str, Any]) -> Any:
    WellTreeTNO = _require_well_tree_class()
    if isinstance(data, PyWellGeoTreeNode):
        payload = data
    else:
        payload = PyWellGeoTreeNode.model_validate(data)

    def build(node: PyWellGeoTreeNode, parent: Any | None) -> Any:
        tree_node = WellTreeTNO(
            node.x,
            node.y,
            node.z,
            node.radius,
            xroot=parent,
            perforated=node.perforated,
            color=node.color,
            name=node.name,
        )
        for branch in node.branches:
            build(branch, tree_node)
        return tree_node

    return build(payload, None)


def walk_nodes(root: Any) -> list[Any]:
    out: list[Any] = [root]
    for branch in root.branches:
        out.extend(walk_nodes(branch))
    return out


def collect_plot_segments(root: Any, parent: Any | None = None) -> list[dict[str, Any]]:
    segments: list[dict[str, Any]] = []
    if parent is not None:
        segments.append(
            {
                "from_xyz": [float(parent.x[0]), float(parent.x[1]), float(parent.x[2])],
                "to_xyz": [float(root.x[0]), float(root.x[1]), float(root.x[2])],
                "color": str(root.color),
                "perforated": bool(root.perforated),
                "name": str(root.name),
            }
        )
    for branch in root.branches:
        segments.extend(collect_plot_segments(branch, root))
    return segments


def collect_temperature_profile(root: Any) -> list[dict[str, float]]:
    profile: list[dict[str, float]] = []
    for node in walk_nodes(root):
        depth_m = float(-node.x[2])
        temp = getattr(node, "temp", None)
        if temp is not None:
            profile.append({"depth_m": depth_m, "temp_c": float(temp)})
    profile.sort(key=lambda p: p["depth_m"])
    return profile


def branch_stats(root: Any) -> list[dict[str, Any]]:
    stats: list[dict[str, Any]] = []

    def visit(node: Any) -> None:
        if node.xroot is not None:
            length = float(np.linalg.norm(node.x - node.xroot.x))
            ahd = float(getattr(node, "ahd", length))
            stats.append(
                {
                    "name": str(node.name),
                    "length_m": length,
                    "ahd_m": ahd,
                    "perforated": bool(node.perforated),
                    "color": str(node.color),
                }
            )
        for branch in node.branches:
            visit(branch)

    visit(root)
    return stats


def last_node_ahd(root: Any) -> float:
    node = root
    while node.branches:
        node = node.branches[0]
    return float(getattr(node, "ahd", 0.0))


def count_tree_nodes(root: Any) -> int:
    return len(walk_nodes(root))


def _xyz_row(node: Any) -> list[float]:
    return [float(node.x[0]), float(node.x[1]), float(-node.x[2])]


def collect_main_bore_xyz(root: Any) -> list[list[float]]:
    """Main-bore polyline (first branch chain only)."""
    points: list[list[float]] = [_xyz_row(root)]
    node = root
    while node.branches:
        child = node.branches[0]
        if str(child.name) not in ("main", str(node.name)):
            break
        points.append(_xyz_row(child))
        node = child
    return points


def collect_named_branch_xyz(branch_root: Any) -> list[list[float]]:
    points: list[list[float]] = []
    if getattr(branch_root, "xroot", None) is not None:
        points.append(_xyz_row(branch_root.xroot))
    points.append(_xyz_row(branch_root))
    node = branch_root
    while node.branches:
        child = node.branches[0]
        points.append(_xyz_row(child))
        node = child
    return points


def collect_lateral_xyz_map(root: Any) -> dict[str, list[list[float]]]:
    """Named laterals (excluding main-bore continuation)."""
    laterals: dict[str, list[list[float]]] = {}

    def visit(node: Any) -> None:
        for idx, branch in enumerate(node.branches):
            if idx == 0 and str(branch.name) in ("main", str(node.name)):
                visit(branch)
                continue
            name = str(branch.name)
            laterals[name] = collect_named_branch_xyz(branch)
            visit(branch)

    visit(root)
    return laterals
