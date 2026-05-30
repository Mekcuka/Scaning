"""Tests for PPTX one-pager export."""

from datetime import date
from uuid import uuid4

from app.models import OnePager
from app.services.one_pager_pptx import generate_one_pager_pptx


def test_generate_pptx_creates_file(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "app.services.one_pager_pptx._exports_dir",
        lambda: tmp_path,
    )
    op = OnePager(
        id=uuid4(),
        project_id=uuid4(),
        poi_id=uuid4(),
        title="Тест — POI-1",
        coordinates="55.0, 37.0",
        engineer_name="Инженер",
        report_date=date.today(),
        final_variant_data={
            "poi_name": "POI-1",
            "total_cost_mln": 100.5,
            "equipment_cost_mln": 12.3,
            "analysis_rows": [
                {"subtype": "pads", "param_type": "internal", "distance_km": 10, "cost_mln": 5, "status": "within_limit"},
                {"subtype": "autoroad", "param_type": "external_linear", "distance_km": 10, "cost_mln": 5, "status": "within_limit"},
                {"subtype": "substation", "param_type": "external", "distance_km": 15, "cost_mln": 8, "status": "exceeds_limit", "object_name": "ПС-1"},
            ],
        },
        engineering_params={"eng_power": "external", "eng_gas": "well", "eng_transport": "auto"},
        roadmap=[
            {"stage": "Разведка", "duration_months": 6},
            {"stage": "Изыскания", "duration_months": 12},
            {"stage": "Эксплуатация", "duration_months": None},
        ],
        recommendation_text="Тестовая рекомендация.",
    )
    path = generate_one_pager_pptx(op)
    assert path.exists()
    assert path.suffix == ".pptx"
    assert path.stat().st_size > 1000
