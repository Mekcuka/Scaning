"""Pad cluster subtype validation (oil_pad / gas_pad)."""

import pytest

from app.geo.validation import validate_general_infra_create, validate_subtype_change


def test_pad_cluster_subtype_change_allowed():
    validate_subtype_change("oil_pad", "gas_pad")
    validate_subtype_change("gas_pad", "oil_pad")


def test_pad_cluster_rejects_outside_cluster():
    with pytest.raises(ValueError):
        validate_subtype_change("oil_pad", "node")
    with pytest.raises(ValueError):
        validate_subtype_change("gas_pad", "gas_processing")


def test_gas_pad_not_general_create():
    with pytest.raises(ValueError, match="Куст"):
        validate_general_infra_create("gas_pad")
