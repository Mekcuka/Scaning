"""Profile sketch volume (chainage cross-section integration)."""

from __future__ import annotations

from pad_earthwork.schemas import EnvelopeWrap, PadParams, ProfileChainagePoint, ProfileSketch


class ProfileNotSupportedError(Exception):
    """Raised when profile sketch is not implemented yet."""


def profile_length_m(chainage_points: list[ProfileChainagePoint]) -> float:
    if not chainage_points:
        return 0.0
    chainages = [p.chainage_m for p in chainage_points]
    return max(chainages) - min(chainages)


def derive_params_from_profile(
    sketch: ProfileSketch,
    *,
    rotation_deg: float,
    height_m: float,
    reference_elevation_m: float,
) -> PadParams:
    length_m = profile_length_m(sketch.chainage_points)
    if length_m <= 0:
        length_m = 1.0
    return PadParams(
        length_m=min(500.0, max(1.0, length_m)),
        width_m=sketch.width_m,
        height_m=height_m,
        rotation_deg=rotation_deg,
        reference_elevation_m=reference_elevation_m,
    )


def compute_volumes_profile(sketch: ProfileSketch) -> tuple[float, float, float, list[str]]:
    """Return fill_m3, cut_m3, footprint_area_m2, warnings."""
    warnings: list[str] = []
    points = sorted(sketch.chainage_points, key=lambda p: p.chainage_m)
    if len(points) < 2:
        warnings.append("profile_insufficient_points")
        length_m = max(1.0, profile_length_m(points))
        return 0.0, 0.0, length_m * sketch.width_m, warnings

    design = sketch.design_elevation_m
    width = sketch.width_m
    fill_m3 = 0.0
    cut_m3 = 0.0

    for i in range(len(points) - 1):
        s0, z0 = points[i].chainage_m, points[i].elevation_m
        s1, z1 = points[i + 1].chainage_m, points[i + 1].elevation_m
        ds = s1 - s0
        if ds <= 0:
            warnings.append("profile_non_monotonic_chainage")
            continue
        dz0 = design - z0
        dz1 = design - z1
        fill_m3 += width * ds * (max(dz0, 0.0) + max(dz1, 0.0)) / 2.0
        cut_m3 += width * ds * (max(-dz0, 0.0) + max(-dz1, 0.0)) / 2.0

    length_m = profile_length_m(points)
    footprint_area = length_m * width
    return fill_m3, cut_m3, footprint_area, warnings


def compute_volumes_profile_with_envelope(
    sketch: ProfileSketch,
    envelope: EnvelopeWrap,
    height_m: float,
) -> tuple[float, float, float, list[str]]:
    """Profile strip fill plus rectangular envelope extra volume."""
    fill_m3, cut_m3, footprint_area, warnings = compute_volumes_profile(sketch)
    if height_m <= 0 or envelope.wrap_width_m <= 0:
        return fill_m3, cut_m3, footprint_area, warnings

    points = sorted(sketch.chainage_points, key=lambda p: p.chainage_m)
    length_m = profile_length_m(points)
    if length_m <= 0:
        length_m = 1.0
    extra = envelope.wrap_width_m * height_m * (length_m + sketch.width_m)
    warnings = list(warnings)
    warnings.append("profile_envelope_side_wrap_approximation")
    return fill_m3 + extra, cut_m3, footprint_area, warnings
