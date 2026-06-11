"""MVP flat-terrain volume engine."""

from __future__ import annotations


def compute_volumes_flat(length_m: float, width_m: float, height_m: float) -> tuple[float, float]:
    fill_m3 = length_m * width_m * height_m
    return fill_m3, 0.0
