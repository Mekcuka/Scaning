"""Validate subtype vs geometry (FR-2.3.9, FR-2.5.4)."""

from app.geo.constants import (
    EXCLUSIVE_POINT_SUBTYPES,
    FACILITY_POINT_SUBTYPES,
    GKS_CLUSTER_SUBTYPES,
    GTES_CLUSTER_SUBTYPES,
    IE_DERIVED_POINT_SUBTYPES,
    IMMUTABLE_POINT_SUBTYPES,
    IMPORT_ONLY_POINT_SUBTYPES,
    NODE_CLUSTER_SUBTYPES,
    PAD_CLUSTER_SUBTYPES,
    BOTTOMHOLE_CLUSTER_SUBTYPES,
    NODE_DERIVED_POINT_SUBTYPES,
    PAD_DERIVED_POINT_SUBTYPES,
    SPARK_EXCLUSIVE_POINT_SUBTYPES,
    SUBTYPE_LABELS,
)
from app.subtype_manifest import load_infrastructure_subtypes_manifest


def validate_subtype_geometry(
    subtype: str,
    *,
    has_line_endpoints: bool = False,
    coordinate_count: int = 1,
) -> None:
    manifest = load_infrastructure_subtypes_manifest()
    point_subtypes = frozenset(manifest["point"]["map"])
    line_subtypes = frozenset(manifest["linear"]["all"])
    st = subtype.lower().strip()
    if st in point_subtypes:
        if has_line_endpoints or coordinate_count > 1:
            raise ValueError(f"Subtype {st} requires point geometry (lat/lon only)")
    elif st in line_subtypes:
        if coordinate_count < 2 and not has_line_endpoints:
            raise ValueError(f"Subtype {st} requires line geometry (start/end or coordinates)")
    else:
        raise ValueError(f"Unknown infrastructure subtype: {subtype}")


def validate_general_infra_create(subtype: str) -> None:
    """Блокирует только IE-производные и import-only подтипы; methanol_facility и прочие точки — POST /objects."""
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
        if st in PAD_DERIVED_POINT_SUBTYPES:
            raise ValueError(
                f"Подтип «{label}»: импорт Искра или смена подтипа у объекта «Куст»."
            )
        if st in FACILITY_POINT_SUBTYPES:
            raise ValueError(
                f"Подтип «{label}»: укажите subtype в теле запроса "
                "POST /projects/{project_id}/infrastructure/facility-objects "
                f"(subtype: {st})."
            )
        if st in SPARK_EXCLUSIVE_POINT_SUBTYPES:
            raise ValueError(f"Подтип «{label}» создаётся только импортом Искра.")
        raise ValueError(
            f"Подтип «{label}»: создаётся только импортом Искра или сменой подтипа у базового объекта."
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
    if cur in PAD_CLUSTER_SUBTYPES and nxt not in PAD_CLUSTER_SUBTYPES:
        raise ValueError(
            "Для кустов допустима смена только между подтипами "
            "«Нефтяной куст» и «Газовый куст»."
        )
    if cur in BOTTOMHOLE_CLUSTER_SUBTYPES and nxt not in BOTTOMHOLE_CLUSTER_SUBTYPES:
        raise ValueError(
            "Для забоев допустима смена только между подтипами "
            "«Забой (ННБ)», «ГС — heel» и «ГС — toe»."
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
    categories = load_infrastructure_subtypes_manifest()["categories"]
    st = subtype.lower().strip()
    if st not in categories:
        raise ValueError(f"Unknown subtype: {subtype}")
    return categories[st]
