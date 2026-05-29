"""Tests for ИЭ map entry (gtes) and GTES cluster subtypes."""

import pytest

from app.geo.constants import GTES_CLUSTER_SUBTYPES, subtypes_for_nearest_search
from app.geo.validation import validate_general_infra_create, validate_subtype_change


def test_gtes_cluster_subtypes():
    assert GTES_CLUSTER_SUBTYPES == frozenset({"gtes", "gpes", "vies"})
    assert subtypes_for_nearest_search("gtes") == GTES_CLUSTER_SUBTYPES


def test_cannot_create_gpes_directly():
    with pytest.raises(ValueError, match="ИЭ"):
        validate_general_infra_create("gpes")


def test_gtes_subtype_change_within_cluster():
    validate_subtype_change("gtes", "gpes")
    validate_subtype_change("gpes", "vies")
    validate_subtype_change("vies", "gtes")


def test_cannot_assign_gtes_to_gas_processing():
    with pytest.raises(ValueError, match="ГКС"):
        validate_subtype_change("gas_processing", "gtes")
