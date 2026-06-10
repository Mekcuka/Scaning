"""Russian labels for POI analysis statuses."""

from __future__ import annotations

OVERALL_STATUS_LABELS: dict[str, str] = {
    "ok": "В норме",
    "warning": "Есть превышения",
    "exceed": "Превышение",
    "exceeded": "Превышение",
    "error": "Ошибка",
    "not_required": "Не требуется",
    "computed": "Рассчитано",
    "missing": "Нет данных",
}

ROW_STATUS_LABELS: dict[str, str] = {
    "ok": "OK",
    "warning": "Предупреждение",
    "exceed": "Превышение",
    "exceeded": "Превышение",
    "not_required": "Не требуется",
    "computed": "Рассчитано",
    "missing": "Нет данных",
}


def overall_status_label_ru(status: str) -> str:
    return OVERALL_STATUS_LABELS.get(status, status)


def row_status_label_ru(status: str) -> str:
    return ROW_STATUS_LABELS.get(status, status)
