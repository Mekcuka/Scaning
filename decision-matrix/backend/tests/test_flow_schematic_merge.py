"""Tests for merging auto flow schematic with saved layouts."""

from uuid import uuid4

from app.models import PointOfInterest
from app.services.flow_schematic_merge import merge_auto_schematic_with_layout


def _poi() -> PointOfInterest:
    return PointOfInterest(
        id=uuid4(),
        project_id=uuid4(),
        name="Куст",
        longitude=30.0,
        latitude=60.0,
        fluid_type="oil",
        eng_injection="centralized",
        water_injection_volume=100.0,
    )


def test_merge_replaces_stale_layout_with_auto_bkns_chain():
    poi = _poi()
    poi_id = poi.id
    auto = {
        "poi_id": poi_id,
        "warnings": [],
        "nodes": [
            {"id": f"branch-water-{poi_id}", "kind": "fluid_branch", "label": "Вода", "fluid": "water", "subtype": None},
            {"id": f"term-water-{poi_id}", "kind": "terminal", "label": "БКНС", "fluid": "water", "subtype": "ground_pumping_station"},
            {
                "id": f"util-water-form-{poi_id}",
                "kind": "utilization",
                "label": "В пласт",
                "fluid": "water",
                "subtype": "centralized",
            },
        ],
        "edges": [
            {"id": "e1", "source": f"branch-water-{poi_id}", "target": f"term-water-{poi_id}", "fluid": "water"},
            {"id": "e2", "source": f"term-water-{poi_id}", "target": f"util-water-form-{poi_id}", "fluid": "water"},
        ],
    }
    layout_nodes = [
        {"id": f"branch-water-{poi_id}", "kind": "fluid_branch", "label": "Вода", "fluid": "water", "subtype": None},
    ]
    layout_edges = []

    merged = merge_auto_schematic_with_layout(auto, layout_nodes, layout_edges, poi)
    assert merged["source"] == "auto"
    labels = [n["label"] for n in merged["nodes"]]
    assert "БКНС" in labels
    assert "В пласт" in labels


def test_merge_keeps_custom_layout_when_topology_matches():
    poi = _poi()
    poi_id = poi.id
    nodes = [
        {
            "id": f"term-water-{poi_id}",
            "kind": "terminal",
            "label": "БКНС-1",
            "fluid": "water",
            "subtype": "ground_pumping_station",
            "position_x": 10,
            "position_y": 20,
        },
        {
            "id": f"util-water-form-{poi_id}",
            "kind": "utilization",
            "label": "В пласт",
            "fluid": "water",
            "subtype": "centralized",
        },
    ]
    edges = [
        {"id": "e1", "source": f"term-water-{poi_id}", "target": f"util-water-form-{poi_id}", "fluid": "water"},
    ]
    auto = {"poi_id": poi_id, "warnings": [], "nodes": nodes, "edges": edges}

    merged = merge_auto_schematic_with_layout(auto, nodes, edges, poi)
    assert merged["source"] == "custom"
    assert merged["nodes"][0].get("position_x") == 10
