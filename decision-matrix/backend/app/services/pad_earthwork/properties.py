"""Property keys for pad earthwork on InfrastructureObject."""

PAD_LENGTH_M = "pad_length_m"
PAD_WIDTH_M = "pad_width_m"
PAD_HEIGHT_M = "pad_height_m"
PAD_ROTATION_DEG = "pad_rotation_deg"
PAD_REFERENCE_ELEVATION_M = "pad_reference_elevation_m"
DEFAULT_NDS_DEG = 90.0
PAD_FILL_VOLUME_M3 = "pad_fill_volume_m3"
PAD_CUT_VOLUME_M3 = "pad_cut_volume_m3"
PAD_EARTHWORK_COMPUTED_AT = "pad_earthwork_computed_at"
PAD_DEM_ASSET_ID = "pad_dem_asset_id"
PAD_DEM_FETCHED_AT = "pad_dem_fetched_at"
PAD_DEM_SOURCE = "pad_dem_source"
PAD_DEM_BBOX_HASH = "pad_dem_bbox_hash"
PAD_EARTHWORK_SKETCH_JSON = "pad_earthwork_sketch_json"
PAD_EARTHWORK_PROFILE_JSON = "pad_earthwork_profile_json"
PAD_WELLS_LOCAL_JSON = "pad_wells_local_json"
PAD_EARTHWORK_SKETCH_SAVED_AT = "pad_earthwork_sketch_saved_at"
PAD_EARTHWORK_PROFILE_SAVED_AT = "pad_earthwork_profile_saved_at"
PAD_ENVELOPE_ENABLED = "pad_envelope_enabled"
PAD_ENVELOPE_WRAP_WIDTH_M = "pad_envelope_wrap_width_m"

PAD_WELL_COUNT = "pad_well_count"
PAD_WELLS_PER_GROUP = "pad_wells_per_group"
PAD_WELL_SPACING_M = "pad_well_spacing_m"
PAD_WELL_GROUP_SPACING_M = "pad_well_group_spacing_m"
PAD_LAYOUT_MARGIN_LEFT_M = "pad_layout_margin_left_m"
PAD_LAYOUT_MARGIN_BOTTOM_M = "pad_layout_margin_bottom_m"
PAD_LAYOUT_MARGIN_TOP_M = "pad_layout_margin_top_m"
PAD_LAYOUT_MARGIN_END_M = "pad_layout_margin_end_m"

PAD_WELL_PARAM_KEYS = frozenset(
    {
        PAD_WELL_COUNT,
        PAD_WELLS_PER_GROUP,
        PAD_WELL_SPACING_M,
        PAD_WELL_GROUP_SPACING_M,
        PAD_LAYOUT_MARGIN_LEFT_M,
        PAD_LAYOUT_MARGIN_BOTTOM_M,
        PAD_LAYOUT_MARGIN_TOP_M,
        PAD_LAYOUT_MARGIN_END_M,
    }
)

PAD_PARAM_KEYS = frozenset(
    {
        PAD_LENGTH_M,
        PAD_WIDTH_M,
        PAD_HEIGHT_M,
        PAD_ROTATION_DEG,
        PAD_REFERENCE_ELEVATION_M,
        PAD_DEM_ASSET_ID,
        PAD_DEM_FETCHED_AT,
        PAD_DEM_SOURCE,
        PAD_DEM_BBOX_HASH,
        PAD_EARTHWORK_SKETCH_JSON,
        PAD_EARTHWORK_PROFILE_JSON,
        PAD_WELLS_LOCAL_JSON,
        PAD_EARTHWORK_SKETCH_SAVED_AT,
        PAD_EARTHWORK_PROFILE_SAVED_AT,
        PAD_ENVELOPE_ENABLED,
        PAD_ENVELOPE_WRAP_WIDTH_M,
        *PAD_WELL_PARAM_KEYS,
    }
)

PAD_RESULT_KEYS = frozenset(
    {
        PAD_FILL_VOLUME_M3,
        PAD_CUT_VOLUME_M3,
        PAD_EARTHWORK_COMPUTED_AT,
    }
)
