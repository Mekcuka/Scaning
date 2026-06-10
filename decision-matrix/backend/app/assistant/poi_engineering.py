"""Russian labels for POI engineering matrix fields (matrix page / one-pager)."""

from __future__ import annotations

from typing import Any

from app.models import PointOfInterest

ENG_FIELD_LABELS_RU: dict[str, str] = {
    "eng_power": "Электроснабжение",
    "eng_injection": "ППД",
    "eng_gas": "Обращение с газом",
    "eng_oil_preparation": "Подготовка нефти",
    "eng_well_gathering": "Сбор скважин",
    "eng_transport": "Транспорт",
}

ENG_VALUE_LABELS_RU: dict[str, dict[str, str]] = {
    "eng_power": {"external": "Внешнее", "internal": "Внутреннее"},
    "eng_injection": {"centralized": "Централизованная", "local": "Локальная", "none": "Нет"},
    "eng_gas": {"well": "В пласт", "flare": "Факел", "power_generation": "Электрогенерация"},
    "eng_oil_preparation": {
        "mkos": "МКОС",
        "bmupn": "БМУПН",
        "ctp": "ЦПС(УПН)",
        "ups": "УПСВ",
        "mfns": "МФНС",
    },
    "eng_well_gathering": {
        "single_tube": "Однотрубная",
        "dual_tube": "Двухтрубная",
        "combined": "Комбинированная",
    },
    "eng_transport": {
        "auto": "Автовывоз",
        "marine": "Морской порт",
        "pipeline": "Магистральный трубопровод",
    },
}


def eng_value_label_ru(field: str, value: str | None) -> str:
    if not value:
        return "—"
    return ENG_VALUE_LABELS_RU.get(field, {}).get(value, value)


def engineering_fields_from_poi_dict(poi: dict[str, Any]) -> dict[str, str]:
    out: dict[str, str] = {}
    for field in ENG_FIELD_LABELS_RU:
        raw = poi.get(field)
        if raw is not None:
            out[field] = eng_value_label_ru(field, str(raw))
    return out


def engineering_fields_from_model(poi: PointOfInterest) -> dict[str, str]:
    return engineering_fields_from_poi_dict(
        {
            "eng_power": poi.eng_power,
            "eng_injection": poi.eng_injection,
            "eng_gas": poi.eng_gas,
            "eng_oil_preparation": poi.eng_oil_preparation,
            "eng_well_gathering": poi.eng_well_gathering,
            "eng_transport": poi.eng_transport,
        }
    )


def format_engineering_summary_ru(poi: dict[str, Any], *, field: str | None = None) -> str:
    name = str(poi.get("name") or "POI")
    labels = engineering_fields_from_poi_dict(poi)
    if field and field in labels:
        title = ENG_FIELD_LABELS_RU.get(field, field)
        return f"POI «{name}»: **{title}** — {labels[field]}."
    lines = [f"Инженерные решения POI «{name}»:", ""]
    for key, title in ENG_FIELD_LABELS_RU.items():
        if key in labels:
            lines.append(f"- **{title}**: {labels[key]}")
    return "\n".join(lines)
