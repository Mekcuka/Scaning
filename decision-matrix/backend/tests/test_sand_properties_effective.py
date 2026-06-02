"""Effective sand demand and yearly plan."""

from datetime import date

from app.geo.sand_properties import (
    SAND_VOLUME_BY_YEAR,
    SAND_VOLUME_DEMAND_M3,
    effective_sand_demand_m3,
    sand_demand_plan_total_m3,
)


def test_effective_demand_fallback_single_volume():
    props = {SAND_VOLUME_DEMAND_M3: 1000.0}
    eff, total, breakdown = effective_sand_demand_m3(
        props, date(2020, 1, 1), date(2025, 6, 1)
    )
    assert eff == 1000.0
    assert total == 1000.0
    assert breakdown == {}


def test_effective_demand_zero_when_not_in_service():
    props = {SAND_VOLUME_DEMAND_M3: 1000.0}
    eff, total, _ = effective_sand_demand_m3(props, date(2030, 1, 1), date(2025, 6, 1))
    assert eff == 0.0
    assert total == 1000.0


def test_effective_demand_cumulative_by_year():
    props = {
        SAND_VOLUME_BY_YEAR: {"2024": 500.0, "2025": 300.0, "2026": 200.0},
    }
    eff, total, breakdown = effective_sand_demand_m3(
        props, date(2024, 6, 1), date(2025, 3, 1)
    )
    assert total == 1000.0
    assert eff == 800.0
    assert breakdown == {"2024": 500.0, "2025": 300.0}


def test_effective_demand_year_plan_respects_entry_year():
    props = {SAND_VOLUME_BY_YEAR: {"2024": 100.0, "2025": 200.0}}
    eff, _, breakdown = effective_sand_demand_m3(
        props, date(2025, 1, 1), date(2025, 12, 31)
    )
    assert eff == 200.0
    assert breakdown == {"2025": 200.0}


def test_sand_demand_plan_total_prefers_yearly_plan():
    props = {
        SAND_VOLUME_DEMAND_M3: 999.0,
        SAND_VOLUME_BY_YEAR: {"2025": 100.0, "2026": 50.0},
    }
    assert sand_demand_plan_total_m3(props) == 150.0


def test_sand_demand_plan_total_respects_explicit_single_mode():
    props = {
        "sand_volume_mode": "single",
        SAND_VOLUME_DEMAND_M3: 500.0,
        SAND_VOLUME_BY_YEAR: {"2025": 100.0},
    }
    assert sand_demand_plan_total_m3(props) == 500.0
    eff, total, _ = effective_sand_demand_m3(props, date(2020, 1, 1), date(2025, 6, 1))
    assert eff == 500.0
    assert total == 500.0
