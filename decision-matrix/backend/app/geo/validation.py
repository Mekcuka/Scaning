"""Validate subtype vs geometry (FR-2.3.9, FR-2.5.4)."""

from app.geo.constants import LINE_SUBTYPES, POINT_SUBTYPES


def validate_subtype_geometry(
    subtype: str,
    *,
    has_line_endpoints: bool = False,
    coordinate_count: int = 1,
) -> None:
    st = subtype.lower().strip()
    if st in POINT_SUBTYPES:
        if has_line_endpoints or coordinate_count > 1:
            raise ValueError(f"Subtype {st} requires point geometry (lat/lon only)")
    elif st in LINE_SUBTYPES:
        if coordinate_count < 2 and not has_line_endpoints:
            raise ValueError(f"Subtype {st} requires line geometry (start/end or coordinates)")
    else:
        raise ValueError(f"Unknown infrastructure subtype: {subtype}")


def category_for_subtype(subtype: str) -> str:
    from app.geo.constants import SUBTYPE_CATEGORY

    st = subtype.lower().strip()
    if st not in SUBTYPE_CATEGORY:
        raise ValueError(f"Unknown subtype: {subtype}")
    return SUBTYPE_CATEGORY[st]
