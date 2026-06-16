"""Pad placement partition helpers — guard against exponential blow-up."""

from __future__ import annotations

import time

from app.services.pad_placement.partition import estimate_partition_count


def test_estimate_partition_count_large_n_is_fast():
    t0 = time.perf_counter()
    value = estimate_partition_count(80, max_wells_per_pad=12)
    elapsed = time.perf_counter() - t0
    assert elapsed < 0.5
    assert value == 7


def test_estimate_partition_count_small_n_exact():
    assert estimate_partition_count(3, max_wells_per_pad=2) == 4
