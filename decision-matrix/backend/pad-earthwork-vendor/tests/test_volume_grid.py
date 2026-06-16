from pad_earthwork.volume_grid import compute_cut_fill_grid


def test_grid_fill_only():
    terrain = [[100.0, 100.0], [100.0, 100.0]]
    design = [[102.0, 102.0], [102.0, 102.0]]
    fill, cut = compute_cut_fill_grid(terrain, design, cell_area_m2=25.0)
    assert fill == 4 * 2.0 * 25.0
    assert cut == 0.0


def test_grid_cut_only():
    terrain = [[105.0]]
    design = [[100.0]]
    fill, cut = compute_cut_fill_grid(terrain, design, cell_area_m2=10.0)
    assert fill == 0.0
    assert cut == 50.0


def test_grid_mixed():
    terrain = [[100.0, 105.0]]
    design = [[103.0, 100.0]]
    fill, cut = compute_cut_fill_grid(terrain, design, cell_area_m2=1.0)
    assert fill == 3.0
    assert cut == 5.0
