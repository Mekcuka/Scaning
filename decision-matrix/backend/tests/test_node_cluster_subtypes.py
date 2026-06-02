"""Node cluster subtype validation (node / methanol_joint / power_line_node)."""

import pytest

from app.geo.validation import validate_general_infra_create, validate_subtype_change


def test_node_cluster_subtype_change_allowed():
    validate_subtype_change("node", "methanol_joint")
    validate_subtype_change("node", "power_line_node")
    validate_subtype_change("methanol_joint", "power_line_node")
    validate_subtype_change("power_line_node", "node")


def test_node_cluster_rejects_outside_cluster():
    with pytest.raises(ValueError):
        validate_subtype_change("gas_processing", "power_line_node")
    with pytest.raises(ValueError):
        validate_subtype_change("node", "gas_processing")


def test_power_line_node_not_general_create():
    with pytest.raises(ValueError, match="Узел"):
        validate_general_infra_create("power_line_node")
