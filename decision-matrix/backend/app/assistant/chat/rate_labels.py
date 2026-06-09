"""Rate and economic parameter labels for server-side formatters."""

from __future__ import annotations

from dataclasses import dataclass

from app.subtype_manifest import SUBTYPE_LABELS


@dataclass(frozen=True, slots=True)
class RateGroup:
    id: str
    label: str
    unit_label: str
    keys: tuple[str, ...]


def _linear_keys() -> tuple[str, ...]:
    return (
        "autoroad",
        "oil_pipeline",
        "gas_pipeline",
        "water_pipeline",
        "power_line",
        "methanol_pipeline",
        "additional_line",
    )


CAPEX_RATE_GROUPS: tuple[RateGroup, ...] = (
    RateGroup(
        id="linear_per_km",
        label="Линейные объекты",
        unit_label="тыс. ₽/км",
        keys=_linear_keys(),
    ),
    RateGroup(
        id="external_facilities",
        label="Внешние площадные объекты",
        unit_label="тыс. ₽",
        keys=(
            "gas_processing",
            "ukg",
            "tsg",
            "gtes",
            "gpes",
            "vies",
            "substation",
            "refinery",
            "oil_pumping_station",
            "preliminary_water_discharge_station",
            "booster_pumping_station",
            "ground_pumping_station",
            "sand_quarry",
            "methanol_facility",
            "offplot",
            "additional_facility",
        ),
    ),
    RateGroup(
        id="pads",
        label="Кустовые площадки",
        unit_label="тыс. ₽/шт.",
        keys=("pads",),
    ),
    RateGroup(
        id="engineering",
        label="Инженерное оборудование",
        unit_label="тыс. ₽",
        keys=(
            "eq_power",
            "eq_injection",
            "eq_gas",
            "eq_mkos",
            "eq_bmupn",
            "eq_cps",
            "eq_upsv",
        ),
    ),
)

OPEX_PARAM_GROUPS: tuple[RateGroup, ...] = (
    RateGroup(
        id="product_prices",
        label="Цены продукции",
        unit_label="тыс. ₽",
        keys=("oil_price_thousand_rub_per_t", "gas_price_thousand_rub_per_m3"),
    ),
    RateGroup(
        id="opex_pipelines",
        label="OPEX трубопроводов",
        unit_label="тыс. ₽/км·год",
        keys=(
            "opex_oil_pipeline_per_km",
            "opex_water_pipeline_per_km",
            "opex_gas_pipeline_per_km",
            "opex_methanol_pipeline_per_km",
            "opex_additional_line_per_km",
        ),
    ),
    RateGroup(
        id="opex_equipment",
        label="OPEX оборудования подготовки",
        unit_label="тыс. ₽/год",
        keys=(
            "opex_eq_mkos",
            "opex_eq_bmupn",
            "opex_eq_cps",
            "opex_eq_upsv",
            "opex_eq_injection",
            "opex_pads_per_pad",
        ),
    ),
    RateGroup(
        id="opex_terminals",
        label="OPEX терминалов и площадок",
        unit_label="тыс. ₽/год",
        keys=(
            "opex_refinery",
            "opex_gas_processing",
            "opex_gtes",
            "opex_gpes",
            "opex_vies",
            "opex_substation",
            "opex_ground_pumping_station",
            "opex_sand_quarry",
            "opex_offplot",
            "opex_additional_facility",
        ),
    ),
)

_OPEX_KEY_LABELS: dict[str, str] = {
    "oil_price_thousand_rub_per_t": "Нефть",
    "gas_price_thousand_rub_per_m3": "Газ",
    "opex_oil_pipeline_per_km": "Нефтепровод",
    "opex_water_pipeline_per_km": "Водопровод",
    "opex_gas_pipeline_per_km": "Газопровод",
    "opex_methanol_pipeline_per_km": "Метанолопровод",
    "opex_additional_line_per_km": "Доп. линия",
    "opex_eq_mkos": "МКОС",
    "opex_eq_bmupn": "БМУПН",
    "opex_eq_cps": "ЦПС(УПН)",
    "opex_eq_upsv": "УПСВ",
    "opex_eq_injection": "Закачка (локальная)",
    "opex_pads_per_pad": "Кустовая площадка",
    "opex_refinery": "НПЗ / НПС",
    "opex_gas_processing": "ГКС",
    "opex_gtes": "ГТЭС",
    "opex_gpes": "ГПЭС",
    "opex_vies": "ВИЭС",
    "opex_substation": "ПС / ТП",
    "opex_ground_pumping_station": "БКНС",
    "opex_sand_quarry": "Карьер песка",
    "opex_offplot": "ВО",
    "opex_additional_facility": "Доп. объект",
}


def rate_key_label_ru(key: str) -> str:
    if key in _OPEX_KEY_LABELS:
        return _OPEX_KEY_LABELS[key]
    return SUBTYPE_LABELS.get(key, key)
