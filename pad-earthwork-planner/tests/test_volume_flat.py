from pad_earthwork.volume_flat import compute_volumes_flat


def test_flat_fill_volume():
    fill, cut = compute_volumes_flat(120, 80, 2.5)
    assert fill == 24000.0
    assert cut == 0.0


def test_flat_zero_height_rejected_by_schema():
    # volume engine assumes positive height; schema validates gt=0
    fill, cut = compute_volumes_flat(10, 10, 0.1)
    assert fill == 10.0
    assert cut == 0.0
