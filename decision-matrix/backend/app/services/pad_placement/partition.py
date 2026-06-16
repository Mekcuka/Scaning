"""Partition logical wells into k pad groups."""

from __future__ import annotations

import math
from collections.abc import Iterator
from typing import TypeVar

from app.services.pad_placement.schemas import LogicalWell

T = TypeVar("T")

SYNC_MAX_WELLS = 8
SYNC_MAX_PARTITIONS = 100
MAX_PAD_PLACEMENT_WELLS = 20


def max_pad_count(n: int, max_wells_per_pad: int) -> int:
    if n <= 0:
        return 0
    return max(1, math.ceil(n / max_wells_per_pad))


def estimate_partition_count(n: int, max_wells_per_pad: int) -> int:
    """Upper bound on distinct partition evaluations for sync guard."""
    if n <= 0:
        return 0
    if n > SYNC_MAX_WELLS:
        # Exact Stirling(2) recursion is exponential; large selections use k-means heuristic only.
        return max_pad_count(n, max_wells_per_pad)
    k_max = max_pad_count(n, max_wells_per_pad)
    total = 0
    for k in range(1, k_max + 1):
        total += _count_partitions(n, k)
    return total


def _count_partitions(n: int, k: int) -> int:
    if k == 1:
        return 1
    if k == n:
        return 1
    return _stirling2(n, k)


def _stirling2(n: int, k: int) -> int:
    if n == 0 and k == 0:
        return 1
    if n == 0 or k == 0:
        return 0
    return k * _stirling2(n - 1, k) + _stirling2(n - 1, k - 1)


def iter_partitions(items: list[T], k: int) -> Iterator[list[list[T]]]:
    """All ways to split n items into exactly k non-empty ordered groups."""
    n = len(items)
    if k < 1 or k > n:
        return

    def rec(i: int, groups: list[list[T]]) -> Iterator[list[list[T]]]:
        if i == n:
            if len(groups) == k and all(groups):
                yield [list(g) for g in groups]
            return
        item = items[i]
        for gi in range(len(groups)):
            groups[gi].append(item)
            yield from rec(i + 1, groups)
            groups[gi].pop()
        if len(groups) < k:
            groups.append([item])
            yield from rec(i + 1, groups)
            groups.pop()

    yield from rec(0, [])


def iter_partition_assignments(
    wells: list[LogicalWell],
    *,
    max_wells_per_pad: int,
    use_heuristic: bool,
) -> Iterator[list[list[LogicalWell]]]:
    n = len(wells)
    k_max = max_pad_count(n, max_wells_per_pad)
    for k in range(1, k_max + 1):
        if use_heuristic:
            for groups in _kmeans_partitions(wells, k, max_wells_per_pad):
                yield groups
        else:
            for groups in iter_partitions(wells, k):
                if all(len(g) <= max_wells_per_pad for g in groups):
                    yield groups


def _kmeans_partitions(
    wells: list[LogicalWell],
    k: int,
    max_wells_per_pad: int,
    *,
    max_attempts: int = 5,
) -> Iterator[list[list[LogicalWell]]]:
    if not wells:
        return
    if k >= len(wells):
        yield [[w] for w in wells[:k]]
        return

    coords = [(w.td_longitude, w.td_latitude) for w in wells]
    best: list[list[LogicalWell]] | None = None
    for attempt in range(max_attempts):
        centers = _init_centers(coords, k, attempt)
        for _ in range(20):
            groups: list[list[LogicalWell]] = [[] for _ in range(k)]
            for well in wells:
                ci = _nearest_center(well.td_longitude, well.td_latitude, centers)
                groups[ci].append(well)
            if any(len(g) > max_wells_per_pad for g in groups):
                break
            new_centers = []
            for group in groups:
                if not group:
                    new_centers.append(centers[len(new_centers)])
                else:
                    lon = sum(w.td_longitude for w in group) / len(group)
                    lat = sum(w.td_latitude for w in group) / len(group)
                    new_centers.append((lon, lat))
            if new_centers == centers:
                if all(groups) and all(len(g) <= max_wells_per_pad for g in groups):
                    best = groups
                break
            centers = new_centers

    if best:
        yield best


def _init_centers(coords: list[tuple[float, float]], k: int, seed: int) -> list[tuple[float, float]]:
    if seed == 0:
        step = max(1, len(coords) // k)
        return [coords[i * step % len(coords)] for i in range(k)]
    offset = seed % len(coords)
    return [coords[(offset + i) % len(coords)] for i in range(k)]


def _nearest_center(lon: float, lat: float, centers: list[tuple[float, float]]) -> int:
    best_i = 0
    best_d = float("inf")
    for i, (clon, clat) in enumerate(centers):
        d = (lon - clon) ** 2 + (lat - clat) ** 2
        if d < best_d:
            best_d = d
            best_i = i
    return best_i
