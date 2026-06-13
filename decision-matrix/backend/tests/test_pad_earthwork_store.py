"""Unit tests for pad earthwork property reads."""

from app.services.pad_earthwork.earthwork_store import read_pad_params
from app.services.pad_earthwork.properties import (
    DEFAULT_PAD_HEIGHT_M,
    DEFAULT_PAD_LENGTH_M,
    DEFAULT_PAD_REFERENCE_ELEVATION_M,
    DEFAULT_PAD_WIDTH_M,
    PAD_HEIGHT_M,
    PAD_LENGTH_M,
    PAD_WIDTH_M,
)


def test_read_pad_params_defaults_length_and_width():
    params = read_pad_params({PAD_HEIGHT_M: 2.0})
    assert params is not None
    assert params.length_m == DEFAULT_PAD_LENGTH_M
    assert params.width_m == DEFAULT_PAD_WIDTH_M
    assert params.height_m == 2.0


def test_read_pad_params_defaults_height_and_reference():
    params = read_pad_params({PAD_LENGTH_M: 100, PAD_WIDTH_M: 60})
    assert params is not None
    assert params.height_m == DEFAULT_PAD_HEIGHT_M
    assert params.reference_elevation_m == DEFAULT_PAD_REFERENCE_ELEVATION_M


def test_read_pad_params_defaults_all_from_empty():
    params = read_pad_params({})
    assert params is not None
    assert params.length_m == DEFAULT_PAD_LENGTH_M
    assert params.width_m == DEFAULT_PAD_WIDTH_M
    assert params.height_m == DEFAULT_PAD_HEIGHT_M
    assert params.reference_elevation_m == DEFAULT_PAD_REFERENCE_ELEVATION_M


def test_read_pad_params_preserves_explicit_dimensions():
    params = read_pad_params({PAD_LENGTH_M: 50, PAD_WIDTH_M: 30, PAD_HEIGHT_M: 1.5})
    assert params is not None
    assert params.length_m == 50
    assert params.width_m == 30
