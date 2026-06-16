"""Tests for PyWellGeo service."""

import pytest

from well_trajectory.pywellgeo_service import (
    azim_dip_convert,
    enrich_survey_geometry,
    tree_add_branch,
    tree_coarsen,
    tree_compute,
    tree_export_yaml,
    tree_from_survey,
    tree_from_yaml,
    tree_plot_data,
)
from well_trajectory.pywellgeo_schemas import (
    AzimDipConvertRequest,
    TreeAddBranchRequest,
    TreeCoarsenRequest,
    TreeComputeRequest,
    TreeExportYamlRequest,
    TreeFromSurveyRequest,
    TreeFromYamlRequest,
    TreePlotDataRequest,
)
from well_trajectory.pywellgeo_tree_io import tree_from_dict, walk_nodes
from well_trajectory.schemas import SurveyStation

pytestmark = pytest.mark.pywellgeo


def test_enrich_survey_geometry_vertical_stub():
    stations = [
        SurveyStation(md=0, inc=0, azi=90, tvd=0, n=0, e=0),
        SurveyStation(md=100, inc=0, azi=90, tvd=100, n=0, e=0),
    ]
    geo = enrich_survey_geometry(stations)
    assert geo.length_m == 100.0
    assert geo.tvd_max == 100.0


def test_tree_from_survey_and_compute():
    stations = [
        SurveyStation(md=0, inc=0, azi=90, tvd=0, n=0, e=0),
        SurveyStation(md=50, inc=0, azi=90, tvd=50, n=0, e=0),
        SurveyStation(md=100, inc=0, azi=90, tvd=100, n=10, e=0),
    ]
    resp = tree_from_survey(TreeFromSurveyRequest(stations=stations))
    assert resp.tree.name == "main"

    comp = tree_compute(
        TreeComputeRequest(tree=resp.tree, tsurface_c=10.0, tgrad_c_per_m=0.03)
    )
    assert comp.geometry.length_m > 0
    assert comp.branch_stats


def test_tree_plot_data():
    stations = [
        SurveyStation(md=0, inc=0, azi=90, tvd=0, n=0, e=0),
        SurveyStation(md=100, inc=0, azi=90, tvd=100, n=0, e=0),
    ]
    tree = tree_from_survey(TreeFromSurveyRequest(stations=stations)).tree
    plot = tree_plot_data(TreePlotDataRequest(tree=tree))
    assert len(plot.segments) >= 1


def test_azim_dip_roundtrip():
    req = AzimDipConvertRequest(mode="azim_dip_to_vector", azim_deg=45, dip_deg=30)
    out = azim_dip_convert(req)
    assert out.vector is not None
    back = azim_dip_convert(
        AzimDipConvertRequest(mode="vector_to_azim_dip", vector=out.vector)
    )
    assert back.azim_deg is not None
    assert abs(back.azim_deg - 45) < 1.0


def test_yaml_roundtrip():
    yaml_content = """
well_trajectories:
  WELL1:
    main_wellbore:
      xyz:
        - [0, 0, 0]
        - [0, 0, 100]
        - [10, 0, 100]
"""
    imported = tree_from_yaml(TreeFromYamlRequest(content=yaml_content, format="AUTO"))
    assert imported.format_detected == "XYZGENERIC"
    exported = tree_export_yaml(
        TreeExportYamlRequest(tree=imported.tree, format="XYZGENERIC", well_name="WELL1")
    )
    assert "well_trajectories" in exported.content


def test_yaml_import_export_with_lateral():
    yaml_content = """
well_trajectories:
  WELL1:
    main_wellbore:
      xyz:
        - [0, 0, 0]
        - [0, 0, 1000]
        - [0, 0, 2000]
    lat1:
      xyz:
        - [0, 0, 2000]
        - [100, 0, 2000]
        - [200, 0, 2100]
"""
    imported = tree_from_yaml(TreeFromYamlRequest(content=yaml_content, format="AUTO"))
    exported = tree_export_yaml(
        TreeExportYamlRequest(tree=imported.tree, format="XYZGENERIC", well_name="WELL1")
    )
    assert "lat1" in exported.content
    reimported = tree_from_yaml(TreeFromYamlRequest(content=exported.content, format="AUTO"))
    assert reimported.tree.branches or len(walk_nodes(tree_from_dict(reimported.tree))) >= 3


def test_tree_add_branch_and_coarsen():
    stations = [
        SurveyStation(md=0, inc=0, azi=90, tvd=0, n=0, e=0),
        SurveyStation(md=100, inc=0, azi=90, tvd=100, n=0, e=0),
    ]
    for i in range(2, 40):
        stations.append(SurveyStation(md=i * 50, inc=0, azi=90, tvd=i * 50, n=0, e=0))
    tree = tree_from_survey(TreeFromSurveyRequest(stations=stations)).tree

    coarse = tree_coarsen(TreeCoarsenRequest(tree=tree, segment_length_m=100))
    assert coarse.node_count_after <= coarse.node_count_before

    nodes = walk_nodes(tree_from_dict(coarse.tree))
    k = nodes[min(5, len(nodes) - 1)]
    xyz = [
        [float(k.x[0]), float(k.x[1]), float(k.x[2])],
        [float(k.x[0]) + 50, float(k.x[1]), float(k.x[2])],
        [float(k.x[0]) + 100, float(k.x[1]), float(k.x[2]) - 50],
    ]
    added = tree_add_branch(
        TreeAddBranchRequest(tree=coarse.tree, xyz=xyz, name="lat1", color="orange")
    )
    plot = tree_plot_data(TreePlotDataRequest(tree=added.tree))
    assert len(plot.segments) >= 2
