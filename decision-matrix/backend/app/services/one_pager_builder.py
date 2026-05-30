"""Build one-pager snapshot from POI analysis (FR-11)."""

from __future__ import annotations

from datetime import date
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PointOfInterest, Project, ProjectCostRates
from app.services.calculations import (
    calc_engineering_equipment_cost,
    calc_pads_count,
    thousand_to_million_rub,
)
from app.services.cost_rates import merge_project_cost_rates
from app.services.infrastructure_analysis import build_enriched_analysis_from_db, engineering_state_from_poi

DEFAULT_ROADMAP: list[dict[str, Any]] = [
    {"stage": "Разведка", "duration_months": 6},
    {"stage": "Изыскания", "duration_months": 12},
    {"stage": "ПИР", "duration_months": 18},
    {"stage": "Бурение", "duration_months": 24},
    {"stage": "Строительство", "duration_months": 36},
    {"stage": "Эксплуатация", "duration_months": None},
]

ENG_LABELS: dict[str, dict[str, str]] = {
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
    "eng_transport": {"auto": "Автовывоз", "marine": "Морской порт", "pipeline": "Магистральный трубопровод"},
}


def _eng_label(key: str, value: str) -> str:
    return ENG_LABELS.get(key, {}).get(value, value)


def _count_exceeds(rows: list[dict[str, Any]]) -> int:
    return sum(1 for r in rows if r.get("status") == "exceeds_limit")


def _eng_summary(poi: PointOfInterest) -> str:
    parts = [
        f"электроснабжение — {_eng_label('eng_power', poi.eng_power)}",
        f"закачка — {_eng_label('eng_injection', poi.eng_injection)}",
        f"газ — {_eng_label('eng_gas', poi.eng_gas)}",
        f"подготовка нефти — {_eng_label('eng_oil_preparation', poi.eng_oil_preparation)}",
        f"транспорт — {_eng_label('eng_transport', poi.eng_transport)}",
    ]
    return "; ".join(parts)


def default_recommendation(poi: PointOfInterest, total_mln: float | None, exceed_count: int) -> str:
    total = f"{total_mln:.1f}" if total_mln is not None else "—"
    return (
        f"Рекомендуется реализация: {_eng_summary(poi)}. "
        f"Общая стоимость — {total} млн ₽. Превышений: {exceed_count}."
    )


def poi_engineering_snapshot(poi: PointOfInterest) -> dict[str, Any]:
    return {
        "fluid_type": poi.fluid_type,
        "water_injection_volume": poi.water_injection_volume,
        "eng_power": poi.eng_power,
        "eng_injection": poi.eng_injection,
        "eng_gas": poi.eng_gas,
        "eng_oil_preparation": poi.eng_oil_preparation,
        "eng_well_gathering": poi.eng_well_gathering,
        "eng_transport": poi.eng_transport,
        "planned_production_volume": poi.planned_production_volume,
        "pads_count": calc_pads_count(poi.planned_production_volume, poi.production_per_well, poi.wells_per_pad),
    }


async def build_one_pager_snapshot(
    db: AsyncSession,
    project_id: UUID,
    poi_id: UUID,
    *,
    engineer_name: str | None = None,
    roadmap: list[dict[str, Any]] | None = None,
    recommendation_text: str | None = None,
) -> dict[str, Any]:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    poi = await db.get(PointOfInterest, poi_id)
    if not poi or poi.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="POI not found")

    analysis = await build_enriched_analysis_from_db(db, project_id, poi)
    rows = analysis.get("rows") or analysis.get("analysis") or []
    total_mln = analysis.get("total_cost_mln")
    exceed_count = _count_exceeds(rows)

    rates_row = await db.scalar(select(ProjectCostRates).where(ProjectCostRates.project_id == project_id))
    rates = merge_project_cost_rates(rates_row.rates if rates_row else None)
    eng = engineering_state_from_poi(poi)
    equipment_mln = thousand_to_million_rub(calc_engineering_equipment_cost(eng, rates))

    coords = f"{poi.latitude:.5f}, {poi.longitude:.5f}"
    title = f"{project.name} — {poi.name}"
    report_date = date.today()
    roadmap_data = roadmap if roadmap is not None else list(DEFAULT_ROADMAP)
    rec = recommendation_text or default_recommendation(poi, total_mln, exceed_count)

    final_variant_data = {
        "poi_name": poi.name,
        "total_cost_mln": total_mln,
        "overall_status": analysis.get("overall_status"),
        "exceed_count": exceed_count,
        "analysis_rows": rows,
        "equipment_cost_mln": equipment_mln,
    }

    return {
        "title": title,
        "coordinates": coords,
        "engineer_name": engineer_name,
        "report_date": report_date,
        "final_variant_data": final_variant_data,
        "engineering_params": poi_engineering_snapshot(poi),
        "roadmap": roadmap_data,
        "recommendation_text": rec,
        "is_recommendation_edited": recommendation_text is not None,
        "poi_id": poi.id,
        "project_id": project.id,
    }
