"""Tests for analysis param_type builder registry (SOLID phase 5)."""

from app.services.analysis.builders import ANALYSIS_PARAM_BUILDERS
from app.services.cost_rates import (
    ANALYSIS_LINEAR_SUBTYPES,
    EXTERNAL_LINEAR_SUBTYPES,
    EXTERNAL_POINT_SUBTYPES,
)


def test_registry_has_three_param_type_builders():
    param_types = {b.param_type for b in ANALYSIS_PARAM_BUILDERS}
    assert param_types == {"internal", "external_linear", "external"}


def test_registry_subtypes_match_cost_rates():
    by_type = {b.param_type: b for b in ANALYSIS_PARAM_BUILDERS}
    assert by_type["internal"].__class__.__name__ == "InternalLinearBuilder"
    assert by_type["external_linear"].__class__.__name__ == "ExternalLinearBuilder"
    assert by_type["external"].__class__.__name__ == "ExternalPointBuilder"
    # Subtype lists live in cost_rates — builders import them directly.
    assert len(ANALYSIS_LINEAR_SUBTYPES) >= 4
    assert len(EXTERNAL_LINEAR_SUBTYPES) >= 5
    assert len(EXTERNAL_POINT_SUBTYPES) >= 5
