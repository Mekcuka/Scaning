"""Property keys for well trajectories on pad infrastructure objects."""

PAD_WELLS_TRAJECTORIES_JSON = "pad_wells_trajectories_json"
WELL_TRAJECTORY_COMPUTED_AT = "well_trajectory_computed_at"
WELL_TRAJECTORY_CLEARANCE_PAIRS_JSON = "well_trajectory_clearance_pairs_json"
WELL_TRAJECTORY_CLEARANCE_COMPUTED_AT = "well_trajectory_clearance_computed_at"

PAD_PYWELLGEO_SETTINGS_JSON = "pad_pywellgeo_settings_json"
PAD_PYWELLGEO_TREES_JSON = "pad_pywellgeo_trees_json"
PAD_PYWELLGEO_LAST_COMPUTED_AT = "pad_pywellgeo_last_computed_at"

TRAJECTORY_RESULT_KEYS = frozenset(
    {
        PAD_WELLS_TRAJECTORIES_JSON,
        WELL_TRAJECTORY_COMPUTED_AT,
        WELL_TRAJECTORY_CLEARANCE_PAIRS_JSON,
        WELL_TRAJECTORY_CLEARANCE_COMPUTED_AT,
    }
)

PYWELLGEO_PROPERTY_KEYS = frozenset(
    {
        PAD_PYWELLGEO_SETTINGS_JSON,
        PAD_PYWELLGEO_TREES_JSON,
        PAD_PYWELLGEO_LAST_COMPUTED_AT,
    }
)
