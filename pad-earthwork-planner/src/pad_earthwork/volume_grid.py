"""Grid-based cut/fill (phase 2 DEM)."""

from __future__ import annotations


def compute_cut_fill_grid(
    z_terrain: list[list[float]],
    z_design: list[list[float]],
    cell_area_m2: float,
) -> tuple[float, float]:
    """Sum cut/fill over aligned grids: fill += max(0, z_design - z_terrain) * cell_area."""
    if not z_terrain or not z_design:
        return 0.0, 0.0
    rows = min(len(z_terrain), len(z_design))
    fill_m3 = 0.0
    cut_m3 = 0.0
    for r in range(rows):
        t_row = z_terrain[r]
        d_row = z_design[r]
        cols = min(len(t_row), len(d_row))
        for c in range(cols):
            delta = d_row[c] - t_row[c]
            if delta > 0:
                fill_m3 += delta * cell_area_m2
            elif delta < 0:
                cut_m3 += (-delta) * cell_area_m2
    return fill_m3, cut_m3
