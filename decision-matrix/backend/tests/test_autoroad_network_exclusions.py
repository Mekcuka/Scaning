"""Autoroad network must not treat well bottomholes as road terminals."""

from app.geo.constants import (
    AUTOROAD_NETWORK_EXCLUDED_TERMINAL_SUBTYPES,
    is_autoroad_network_terminal_subtype,
)
from app.subtype_manifest import BOTTOMHOLE_CLUSTER_SUBTYPES, NODE_CLUSTER_SUBTYPES


def test_bottomholes_excluded_from_autoroad_network_terminals():
    for st in BOTTOMHOLE_CLUSTER_SUBTYPES:
        assert st in AUTOROAD_NETWORK_EXCLUDED_TERMINAL_SUBTYPES
        assert is_autoroad_network_terminal_subtype(st) is False


def test_node_cluster_still_excluded():
    for st in NODE_CLUSTER_SUBTYPES:
        assert st in AUTOROAD_NETWORK_EXCLUDED_TERMINAL_SUBTYPES
        assert is_autoroad_network_terminal_subtype(st) is False


def test_regular_facility_is_terminal():
    assert is_autoroad_network_terminal_subtype("gas_processing") is True
    assert is_autoroad_network_terminal_subtype("oil_pad") is True
