const EXTERNAL_SUBTYPES = new Set([
  'gas_processing',
  'gtes',
  'substation',
  'refinery',
  'ground_pumping_station',
]);

export interface AnalysisRow {
  subtype: string;
  param_type: string;
  status: string;
  distance_km?: number | null;
  limit_km?: number | null;
  distance_source?: string;
  nearest_object_id?: string | null;
  nearest_node_id?: string | null;
  object_name?: string | null;
  anchor_lon?: number | null;
  anchor_lat?: number | null;
  anchor_type?: string | null;
  is_manually_overridden?: boolean;
  force_construction?: boolean;
  cost_mln?: number | null;
  km_per_pad?: number | null;
  pads_count?: number | null;
  formula_label?: string | null;
  wells_total?: number | null;
}

export interface PoiAnalysisResponse {
  poi_id: string;
  total_cost_mln: number;
  overall_status: string;
  rows: AnalysisRow[];
  analysis?: AnalysisRow[];
  engineering_status?: Record<string, string>;
}

export interface AnalysisResult {
  poi_id: string;
  total_cost_mln: number;
  overall_status: string;
  analysis: Array<Record<string, unknown>>;
  rows?: AnalysisRow[];
  engineering_status: Record<string, string>;
}

export interface ProjectAnalysisBatchResult {
  project_id: string;
  analyzed_count: number;
  results: AnalysisResult[];
}

export interface Candidate {
  object_id: string | null;
  nearest_node_id?: string | null;
  name: string;
  distance_km: number;
  anchor_lon: number;
  anchor_lat: number;
  anchor_type?: string | null;
}

export function roundKm(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}

export function mapRawToAnalysisRow(r: Record<string, unknown>): AnalysisRow {
  const subtype = String(r.subtype ?? '');
  const defaultParamType = EXTERNAL_SUBTYPES.has(subtype)
    ? 'external'
    : subtype === 'pads'
      ? 'internal'
      : 'internal';
  const nearestId =
    (r.nearest_object_id as string | null | undefined) ??
    (r.object_id as string | null | undefined) ??
    null;
  return {
    subtype,
    param_type: String(r.param_type ?? defaultParamType),
    status: String(r.status ?? ''),
    distance_km: roundKm(r.distance_km),
    limit_km: roundKm(r.limit_km),
    distance_source: r.distance_source as string | undefined,
    nearest_object_id: nearestId,
    nearest_node_id: (r.nearest_node_id as string | null) ?? null,
    object_name: (r.object_name as string | null) ?? null,
    anchor_lon: (r.anchor_lon as number | null) ?? null,
    anchor_lat: (r.anchor_lat as number | null) ?? null,
    anchor_type: (r.anchor_type as string | null) ?? null,
    is_manually_overridden: Boolean(r.is_manually_overridden),
    force_construction: Boolean(r.force_construction),
    cost_mln: (r.cost_mln as number | null | undefined) ?? null,
    km_per_pad: (r.km_per_pad as number | null) ?? null,
    pads_count: (r.pads_count as number | null) ?? null,
    formula_label: (r.formula_label as string | null) ?? null,
    wells_total: (r.wells_total as number | null) ?? null,
  };
}

/** Normalize POST /analyze or GET /analysis payload for the UI. */
export function normalizePoiAnalysisResponse(
  data: AnalysisResult | PoiAnalysisResponse
): PoiAnalysisResponse {
  const rawRows = data.rows ?? data.analysis ?? [];
  const rows = rawRows.map((r) =>
    mapRawToAnalysisRow(r as Record<string, unknown>)
  );
  return {
    poi_id: data.poi_id,
    total_cost_mln: data.total_cost_mln,
    overall_status: data.overall_status,
    rows,
    analysis: rows,
    engineering_status: data.engineering_status,
  };
}
