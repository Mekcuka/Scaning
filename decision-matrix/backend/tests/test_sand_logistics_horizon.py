"""Horizon bounds and yearly sand demand increment."""

from datetime import date

from app.geo.sand_properties import (
    SAND_VOLUME_BY_YEAR,
    SAND_VOLUME_DEMAND_M3,
    compute_horizon_bounds,
    demand_increment_for_year,
)


def test_demand_increment_single_mode_only_entry_year():
    props = {SAND_VOLUME_DEMAND_M3: 1000.0, "sand_volume_mode": "single"}
    assert demand_increment_for_year(props, date(2024, 6, 1), 2024) == 1000.0
    assert demand_increment_for_year(props, date(2024, 6, 1), 2025) == 0.0


def test_demand_increment_yearly_mode():
    props = {SAND_VOLUME_BY_YEAR: {"2024": 100.0, "2025": 200.0}, "sand_volume_mode": "yearly"}
    assert demand_increment_for_year(props, date(2020, 1, 1), 2024) == 100.0
    assert demand_increment_for_year(props, date(2020, 1, 1), 2025) == 200.0
    assert demand_increment_for_year(props, date(2020, 1, 1), 2023) == 0.0


def test_demand_increment_zero_before_entry():
    props = {SAND_VOLUME_DEMAND_M3: 500.0}
    assert demand_increment_for_year(props, date(2026, 1, 1), 2025) == 0.0


def test_compute_horizon_bounds_from_entries_and_plan():
    h_from, h_to = compute_horizon_bounds(
        [date(2022, 3, 1), date(2024, 1, 1)],
        [2023, 2027],
    )
    assert h_from == date(2022, 3, 1)
    assert h_to == date(2027, 12, 31)


def test_compute_horizon_bounds_empty_entries():
    h_from, h_to = compute_horizon_bounds([], [])
    assert h_from == h_to
