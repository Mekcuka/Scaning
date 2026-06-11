from app.services.calculations import calc_pads_count, calc_wells_total


def test_calc_wells_total_rounds_up_and_minimum_one():
    assert calc_wells_total(50, 10) == 5
    assert calc_wells_total(55, 10) == 6
    assert calc_wells_total(5, 10) == 1
    assert calc_wells_total(0.1, 10) == 1


def test_calc_wells_total_zero_without_production():
    assert calc_wells_total(0, 10) == 0
    assert calc_wells_total(50, 0) == 0


def test_calc_pads_count_uses_ceiled_wells():
    assert calc_pads_count(55, 10, 4) == 2
