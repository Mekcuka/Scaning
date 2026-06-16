"""Tests for GS bottomhole trajectory design helpers."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.services.well_trajectory.design_bottomholes import _design_horizontal_any_with_clearance


def _fake_design(_request, offset_m: float) -> SimpleNamespace:
    md = 3000.0 if offset_m <= 1e-3 else 2500.0 + (1000.0 - offset_m)
    return SimpleNamespace(
        stations=[{"md": 0, "inc": 0, "azi": 0, "tvd": 0, "n": 0, "e": 0}, {"md": md, "inc": 90, "azi": 90, "tvd": md, "n": 0, "e": offset_m}],
        geometry=SimpleNamespace(length_m=md),
        model_copy=lambda update=None: SimpleNamespace(
            **{
                **{
                    "stations": [{"md": 0}, {"md": md}],
                    "geometry": SimpleNamespace(length_m=md),
                    "entry_mode": (update or {}).get("entry_mode", "any"),
                    "entry_offset_m": (update or {}).get("entry_offset_m", offset_m),
                    "entry_search_evaluated": (update or {}).get("entry_search_evaluated", 0),
                }
            }
        ),
    )


def test_any_mode_with_clearance_prefers_min_md_among_sf_safe():
    request = SimpleNamespace(
        heel=SimpleNamespace(northing=0, easting=0, tvd=2000, inc=10, azi=90),
        toe=SimpleNamespace(northing=0, easting=1000, tvd=2000, inc=90, azi=90),
        entry_search_step_m=30.0,
    )
    adapter = MagicMock()

    with patch(
        "app.services.well_trajectory.design_bottomholes.gs_entry_endpoint_offsets",
        return_value=[0.0, 1000.0],
    ), patch(
        "app.services.well_trajectory.design_bottomholes.gs_entry_search_offsets",
        return_value=[0.0, 1000.0],
    ), patch(
        "app.services.well_trajectory.design_bottomholes.design_horizontal_at_offset",
        side_effect=_fake_design,
    ), patch(
        "app.services.well_trajectory.design_bottomholes._well_dict_to_clearance_survey",
        return_value=SimpleNamespace(error_model="x", azi_reference="grid"),
    ), patch(
        "app.services.well_trajectory.design_bottomholes._offset_passes_clearance",
        return_value=True,
    ):
        result, fallback = _design_horizontal_any_with_clearance(
            request,
            adapter,
            peer_wells=[{"survey": {"source": "calculated", "stations": [{"md": 0}]}}],
            sf_threshold=1.5,
        )

    assert fallback is False
    # min MD at offset 1000 (2500) vs heel (3000)
    assert result.entry_offset_m == 1000.0


def test_any_mode_fallback_prefers_heel_when_no_clearance_safe():
    request = SimpleNamespace(
        heel=SimpleNamespace(northing=0, easting=0, tvd=2000, inc=10, azi=90),
        toe=SimpleNamespace(northing=0, easting=1000, tvd=2000, inc=90, azi=90),
        entry_search_step_m=30.0,
    )
    adapter = MagicMock()

    with patch(
        "app.services.well_trajectory.design_bottomholes.gs_entry_endpoint_offsets",
        return_value=[0.0, 1000.0],
    ), patch(
        "app.services.well_trajectory.design_bottomholes.gs_entry_search_offsets",
        return_value=[0.0, 1000.0],
    ), patch(
        "app.services.well_trajectory.design_bottomholes.design_horizontal_at_offset",
        side_effect=_fake_design,
    ), patch(
        "app.services.well_trajectory.design_bottomholes._well_dict_to_clearance_survey",
        return_value=SimpleNamespace(error_model="x", azi_reference="grid"),
    ), patch(
        "app.services.well_trajectory.design_bottomholes._offset_passes_clearance",
        return_value=False,
    ):
        result, fallback = _design_horizontal_any_with_clearance(
            request,
            adapter,
            peer_wells=[{"survey": {"source": "calculated", "stations": [{"md": 0}]}}],
            sf_threshold=1.5,
        )

    assert fallback is True
    assert result.entry_offset_m == 0.0


def test_design_without_clearance_step_uses_planner_md_optimizer():
    from uuid import uuid4

    from app.models import InfrastructureObject
    from app.services.well_trajectory.design_bottomholes import design_well_from_target

    pad = InfrastructureObject(
        id=uuid4(),
        subtype="oil_pad",
        properties={"well_trajectory_step_m": 30.0},
    )
    well = {
        "well_index": 1,
        "survey": {
            "source": "stub",
            "stations": [{"md": 0, "inc": 0, "azi": 90, "tvd": 0, "n": 0, "e": 9}],
        },
        "target": {
            "profile": "gs",
            "gs_entry_mode": "any",
            "heel_plan": {"north_m": -72.0, "east_m": -1492.0},
            "plan": {"north_m": -39.0, "east_m": -491.0},
            "heel_tvd_m": 1277.0,
            "toe_tvd_m": 1281.0,
            "azi": 268.0,
        },
    }
    peer = {
        "well_index": 0,
        "survey": {
            "source": "calculated",
            "stations": [
                {"md": 0, "inc": 0, "azi": 90, "tvd": 0, "n": 0, "e": 0},
                {"md": 2500, "inc": 90, "azi": 90, "tvd": 2500, "n": 0, "e": 800},
            ],
        },
    }
    station = MagicMock()
    station.model_dump.return_value = {"md": 0, "inc": 0, "azi": 0, "tvd": 0, "n": 0, "e": 0}
    fake_result = SimpleNamespace(
        entry_mode="any",
        entry_offset_m=900.0,
        entry_plan=None,
        stations=[station],
        geometry=SimpleNamespace(model_dump=lambda mode="json": {}),
    )
    adapter = MagicMock()
    adapter.design_horizontal.return_value = fake_result

    with patch(
        "app.services.well_trajectory.design_bottomholes.get_well_trajectory_adapter",
        return_value=adapter,
    ), patch(
        "app.services.well_trajectory.design_bottomholes._design_horizontal_any_with_clearance",
    ) as mock_any:
        design_well_from_target(pad, 1, well, well["target"], step_m=30.0, peer_wells=[peer])

    mock_any.assert_not_called()
    adapter.design_horizontal.assert_called_once()


def test_design_nnb_passes_pad_dls_design_to_connector():
    from uuid import uuid4

    from app.models import InfrastructureObject
    from app.services.well_trajectory.design_bottomholes import design_well_from_target

    pad = InfrastructureObject(
        id=uuid4(),
        subtype="oil_pad",
        properties={"well_trajectory_dls_design": 6.0},
    )
    well = {
        "well_index": 0,
        "survey": {
            "source": "stub",
            "stations": [{"md": 0, "inc": 0, "azi": 90, "tvd": 0, "n": 0, "e": 0}],
        },
        "target": {
            "profile": "nnb",
            "plan": {"north_m": 100.0, "east_m": 200.0},
            "tvd_m": 1500.0,
            "inc": 360.0,
            "azi": 90.0,
        },
    }
    station = MagicMock()
    station.model_dump.return_value = {"md": 0, "inc": 0, "azi": 0, "tvd": 0, "n": 0, "e": 0}
    fake_result = SimpleNamespace(
        stations=[station],
        geometry=SimpleNamespace(model_dump=lambda mode="json": {}),
    )
    adapter = MagicMock()
    adapter.design_connector.return_value = fake_result

    with patch(
        "app.services.well_trajectory.design_bottomholes.get_well_trajectory_adapter",
        return_value=adapter,
    ):
        design_well_from_target(pad, 0, well, well["target"], step_m=30.0)

    request = adapter.design_connector.call_args[0][0]
    assert request.dls_design == 6.0


def test_design_gs_passes_pad_dls_design_to_horizontal():
    from uuid import uuid4

    from app.models import InfrastructureObject
    from app.services.well_trajectory.design_bottomholes import design_well_from_target

    pad = InfrastructureObject(
        id=uuid4(),
        subtype="oil_pad",
        properties={"well_trajectory_dls_design": 4.5},
    )
    well = {
        "well_index": 0,
        "survey": {
            "source": "stub",
            "stations": [{"md": 0, "inc": 0, "azi": 90, "tvd": 0, "n": 0, "e": 0}],
        },
        "target": {
            "profile": "gs",
            "gs_entry_mode": "heel",
            "heel_plan": {"north_m": 100.0, "east_m": 0.0},
            "plan": {"north_m": 100.0, "east_m": 1000.0},
            "heel_tvd_m": 1500.0,
            "toe_tvd_m": 1500.0,
            "azi": 90.0,
        },
    }
    station = MagicMock()
    station.model_dump.return_value = {"md": 0, "inc": 0, "azi": 0, "tvd": 0, "n": 0, "e": 0}
    fake_result = SimpleNamespace(
        entry_mode="heel",
        entry_offset_m=0.0,
        entry_plan=None,
        stations=[station],
        geometry=SimpleNamespace(model_dump=lambda mode="json": {}),
    )
    adapter = MagicMock()
    adapter.design_horizontal.return_value = fake_result

    with patch(
        "app.services.well_trajectory.design_bottomholes.get_well_trajectory_adapter",
        return_value=adapter,
    ):
        design_well_from_target(pad, 0, well, well["target"], step_m=30.0)

    request = adapter.design_horizontal.call_args[0][0]
    assert request.dls_design == 4.5
