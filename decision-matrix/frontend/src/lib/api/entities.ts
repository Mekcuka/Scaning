import { MANIFEST_FACILITY_POINT } from './infrastructureSubtypesManifest';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  visibility: string;
  poi_count: number;
  owner_user_id: string;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface POI {
  id: string;
  project_id: string;
  name: string;
  description?: string | null;
  lon: number;
  lat: number;
  planned_production_volume: number;
  production_per_well: number;
  wells_per_pad: number;
  fluid_type: string;
  water_injection_volume: number;
  gas_factor: number;
  eng_power: string;
  eng_injection: string;
  eng_gas: string;
  eng_oil_preparation: string;
  eng_well_gathering: string;
  eng_transport: string;
  pads_count: number;
  wells_total: number;
  threshold_gas_processing_km?: number | null;
  threshold_gtes_km?: number | null;
  threshold_substation_km?: number | null;
  threshold_refinery_km?: number | null;
  max_total_line_autoroad_km?: number | null;
  max_total_line_oil_pipeline_km?: number | null;
  max_total_line_gas_pipeline_km?: number | null;
  max_total_line_water_pipeline_km?: number | null;
  max_total_line_power_line_km?: number | null;
  km_per_pad_autoroad?: number | null;
  km_per_pad_oil_pipeline?: number | null;
  km_per_pad_gas_pipeline?: number | null;
  km_per_pad_water_pipeline?: number | null;
  km_per_pad_power_line?: number | null;
}

export interface DistanceDefaults {
  threshold_gas_processing_km: number;
  threshold_gtes_km: number;
  threshold_substation_km: number;
  threshold_refinery_km: number;
  threshold_ground_pumping_station_km: number;
  threshold_sand_quarry_km: number;
  max_total_line_autoroad_km: number;
  max_total_line_oil_pipeline_km: number;
  max_total_line_gas_pipeline_km: number;
  max_total_line_water_pipeline_km: number;
  max_total_line_power_line_km: number;
  max_total_line_methanol_pipeline_km: number;
  max_total_line_additional_line_km: number;
  km_per_pad_autoroad: number;
  km_per_pad_oil_pipeline: number;
  km_per_pad_gas_pipeline: number;
  km_per_pad_water_pipeline: number;
  km_per_pad_power_line: number;
}

export interface InfraLayer {
  id: string;
  project_id: string;
  name: string;
  layer_type: string;
  source_type: string;
  is_visible: boolean;
  opacity: number;
  sort_order: number;
  style_config: Record<string, unknown>;
}

export interface Map3dCustomModel {
  id: string;
  project_id: string;
  filename: string;
  target_height_m: number;
  created_at: string;
  assigned_subtypes: string[];
}

export interface InfraObject {
  id: string;
  layer_id: string;
  name: string;
  subtype: string;
  category: string;
  lon: number;
  lat: number;
  end_lon?: number | null;
  end_lat?: number | null;
  coordinates?: number[][] | null;
  properties?: Record<string, unknown>;
  render_3d_effective?: { height_m: number; base_m: number; visible: boolean; scale: number };
}

export interface InfraObjectCreate {
  name: string;
  /** Код подтипа (обязательно). */
  subtype: string;
  lon: number;
  lat: number;
  end_lon?: number;
  end_lat?: number;
  coordinates?: number[][];
  layer_id?: string;
  description?: string;
  properties?: Record<string, unknown>;
  /** Paste: snap start to this point object id (clipboard twin), not map-wide nearest. */
  line_snap_start_object_id?: string;
  line_snap_finish_object_id?: string;
  /** Clipboard paste: keep submitted path; snap only explicit line_snap_* ends. */
  line_preserve_geometry?: boolean;
}

/** НПЗ / НПС — subtype обязателен и только из этого списка. */
export type FacilityPointSubtype = (typeof MANIFEST_FACILITY_POINT)[number];

export const FACILITY_POINT_SUBTYPES: readonly FacilityPointSubtype[] = [
  ...MANIFEST_FACILITY_POINT,
] as const;

export function isFacilityPointSubtype(subtype: string): subtype is FacilityPointSubtype {
  return (FACILITY_POINT_SUBTYPES as readonly string[]).includes(subtype);
}

export interface FacilityInfraObjectCreate {
  name: string;
  subtype: FacilityPointSubtype;
  lon: number;
  lat: number;
  layer_id?: string;
  description?: string;
  properties?: Record<string, unknown>;
}
