"""Validate subtype vs geometry (FR-2.3.9, FR-2.5.4)."""

from app.geo.constants import (
    EXCLUSIVE_POINT_SUBTYPES,
    GKS_CLUSTER_SUBTYPES,
    GTES_CLUSTER_SUBTYPES,
    IE_DERIVED_POINT_SUBTYPES,
    IMMUTABLE_POINT_SUBTYPES,
    IMPORT_ONLY_POINT_SUBTYPES,
    LINE_SUBTYPES,
    NODE_CLUSTER_SUBTYPES,
    NODE_DERIVED_POINT_SUBTYPES,
    POINT_SUBTYPES,
    SPARK_EXCLUSIVE_POINT_SUBTYPES,
    SUBTYPE_LABELS,
)


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


def validate_general_infra_create(subtype: str) -> None:
    """НПС и import-only точки — только через POST /facility-objects или импорт Искра."""
    st = subtype.lower().strip()
    if st in IE_DERIVED_POINT_SUBTYPES:
        label = SUBTYPE_LABELS.get(st, st)
        raise ValueError(
            f"Подтип «{label}»: создайте объект «ИЭ» на карте или импорт Искра; "
            "уточнение подтипа — в карточке объекта ИЭ."
        )
    if st in IMPORT_ONLY_POINT_SUBTYPES:
        label = SUBTYPE_LABELS.get(st, st)
        if st in NODE_DERIVED_POINT_SUBTYPES:
            raise ValueError(
                f"Подтип «{label}»: импорт Искра или смена подтипа у объекта «Узел»."
            )
        if st in SPARK_EXCLUSIVE_POINT_SUBTYPES:
            raise ValueError(f"Подтип «{label}» создаётся только импортом Искра.")
        raise ValueError(
            f"Подтип «{label}»: укажите subtype в теле запроса "
            "POST /projects/{project_id}/infrastructure/facility-objects "
            f"(subtype: {st})."
        )


def validate_subtype_change(current: str, new: str) -> None:
    """Reject invalid point subtype reclassification."""
    cur = current.lower().strip()
    nxt = new.lower().strip()
    if cur in IMMUTABLE_POINT_SUBTYPES and nxt != cur:
        label = SUBTYPE_LABELS.get(cur, cur)
        raise ValueError(f"Подтип «{label}» нельзя изменить на другой.")
    if cur in GKS_CLUSTER_SUBTYPES and nxt not in GKS_CLUSTER_SUBTYPES:
        raise ValueError(
            "Для объектов ГКС/УКГ/ТСГ допустима смена только между подтипами ГКС, УКГ и ТСГ."
        )
    if cur in NODE_CLUSTER_SUBTYPES and nxt not in NODE_CLUSTER_SUBTYPES:
        raise ValueError(
            "Для узлов допустима смена только между подтипами "
            "«Узел», «Узел метанола» и «Узел ЛЭП»."
        )
    if cur in GTES_CLUSTER_SUBTYPES and nxt not in GTES_CLUSTER_SUBTYPES:
        raise ValueError(
            "Для объектов ИЭ допустима смена только между подтипами ГТЭС, ГПЭС и ВИЭС."
        )
    if nxt in IE_DERIVED_POINT_SUBTYPES and cur not in GTES_CLUSTER_SUBTYPES:
        label = SUBTYPE_LABELS.get(nxt, nxt)
        raise ValueError(
            f"Подтип «{label}» доступен только для объектов «ИЭ» "
            "(импорт Искра или смена подтипа)."
        )
    if nxt in NODE_DERIVED_POINT_SUBTYPES and cur not in NODE_CLUSTER_SUBTYPES:
        label = SUBTYPE_LABELS.get(nxt, nxt)
        raise ValueError(
            f"Подтип «{label}» доступен только для объектов «Узел» "
            "(импорт Искра или смена подтипа)."
        )
    if nxt in EXCLUSIVE_POINT_SUBTYPES and cur != nxt:
        label = SUBTYPE_LABELS.get(nxt, nxt)
        if nxt in SPARK_EXCLUSIVE_POINT_SUBTYPES:
            raise ValueError(
                f"Подтип «{label}» задаётся только при импорте Искра, "
                "смена с другого подтипа недоступна."
            )
        raise ValueError(
            f"Подтип «{label}» доступен только для объектов «{label}», "
            "смена с другого подтипа недоступна."
        )


def category_for_subtype(subtype: str) -> str:
    from app.geo.constants import SUBTYPE_CATEGORY

    st = subtype.lower().strip()
    if st not in SUBTYPE_CATEGORY:
        raise ValueError(f"Unknown subtype: {subtype}")
    return SUBTYPE_CATEGORY[st]
