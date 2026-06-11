"""Property keys for pad earthwork on InfrastructureObject."""

PAD_LENGTH_M = "pad_length_m"
PAD_WIDTH_M = "pad_width_m"
PAD_HEIGHT_M = "pad_height_m"
PAD_ROTATION_DEG = "pad_rotation_deg"
PAD_REFERENCE_ELEVATION_M = "pad_reference_elevation_m"
PAD_FILL_VOLUME_M3 = "pad_fill_volume_m3"
PAD_CUT_VOLUME_M3 = "pad_cut_volume_m3"
PAD_EARTHWORK_COMPUTED_AT = "pad_earthwork_computed_at"
PAD_DEM_ASSET_ID = "pad_dem_asset_id"
PAD_EARTHWORK_SKETCH_JSON = "pad_earthwork_sketch_json"
PAD_EARTHWORK_SKETCH_SAVED_AT = "pad_earthwork_sketch_saved_at"
PAD_ENVELOPE_ENABLED = "pad_envelope_enabled"
PAD_ENVELOPE_WRAP_WIDTH_M = "pad_envelope_wrap_width_m"

PAD_PARAM_KEYS = frozenset(
    {
        PAD_LENGTH_M,
        PAD_WIDTH_M,
        PAD_HEIGHT_M,
        PAD_ROTATION_DEG,
        PAD_REFERENCE_ELEVATION_M,
        PAD_DEM_ASSET_ID,
        PAD_EARTHWORK_SKETCH_JSON,
        PAD_EARTHWORK_SKETCH_SAVED_AT,
        PAD_ENVELOPE_ENABLED,
        PAD_ENVELOPE_WRAP_WIDTH_M,
    }
)

PAD_RESULT_KEYS = frozenset(
    {
        PAD_FILL_VOLUME_M3,
        PAD_CUT_VOLUME_M3,
        PAD_EARTHWORK_COMPUTED_AT,
    }
)
