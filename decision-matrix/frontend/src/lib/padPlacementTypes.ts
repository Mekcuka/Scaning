export type PadPlacementParams = {
  max_wells_per_pad?: number;
  well_spacing_m?: number;
  wells_per_group?: number;
  group_spacing_m?: number;
  margin_left_m?: number;
  margin_bottom_m?: number;
  margin_top_m?: number;
  margin_end_m?: number;
  rotation_deg?: number;
  min_pad_spacing_m?: number;
  step_m?: number;
  sf_check?: boolean;
  sf_threshold?: number;
  top_k?: number;
  center_optimize?: boolean;
  center_search_radius_m?: number;
  center_search_step_m?: number;
};

export type PadPlacementVariant = {
  variant_index: number;
  pad_count: number;
  sum_md_m: number;
  score_warnings: string[];
  invalid: boolean;
  min_sf: number | null;
  sf_violation_count?: number;
};

export type PadPlacementComputeResponse = {
  request_id: string;
  logical_well_count: number;
  partitions_evaluated: number;
  variants: PadPlacementVariant[];
  warnings: string[];
  computed_at: string;
};

export type PadPlacementApplyResponse = {
  created_pad_ids: string[];
  updated_bottomhole_ids: string[];
  warnings: string[];
  applied_at: string;
};

export type PadPlacementGeoJson = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: { type: string; coordinates: unknown };
    properties: Record<string, unknown>;
  }>;
};

export const DEFAULT_PAD_PLACEMENT_PARAMS: PadPlacementParams = {
  max_wells_per_pad: 12,
  well_spacing_m: 9,
  min_pad_spacing_m: 200,
  step_m: 30,
  sf_check: false,
  sf_threshold: 1,
  top_k: 5,
  center_optimize: true,
  center_search_radius_m: 400,
  center_search_step_m: 200,
};
