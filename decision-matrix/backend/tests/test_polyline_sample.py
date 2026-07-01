"""Tests for polyline chainage sampling."""

from app.services.line_elevation_profile.polyline_sample import sample_polyline_chainage


def test_sample_polyline_chainage_start_end_and_steps():
    coords = [(37.0, 55.0), (37.01, 55.0)]
    samples = sample_polyline_chainage(coords, step_m=500.0)
    assert samples[0][0] == 0.0
    assert samples[-1][0] > 0
    assert len(samples) == 3


def test_sample_polyline_chainage_single_point():
    samples = sample_polyline_chainage([(37.0, 55.0)], step_m=100.0)
    assert samples == [(0.0, 37.0, 55.0)]


def test_sample_polyline_chainage_multiple_segments():
    coords = [(37.0, 55.0), (37.001, 55.0), (37.002, 55.0)]
    samples = sample_polyline_chainage(coords, step_m=30.0)
    chainages = [s[0] for s in samples]
    assert chainages[0] == 0.0
    assert chainages == sorted(chainages)
    assert chainages[-1] >= chainages[0]
