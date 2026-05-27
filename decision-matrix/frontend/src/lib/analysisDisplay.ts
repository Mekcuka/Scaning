import type { AnalysisRow, InfraObject } from './api';
import { STATUS_LABELS, SUBTYPE_LABELS } from './specs';

export const ANALYSIS_LINE_SUBTYPES = [
  'autoroad',
  'oil_pipeline',
  'water_pipeline',
  'power_line',
] as const;

export const ANALYSIS_EXTERNAL_SUBTYPES = [
  'gas_processing',
  'gtes',
  'substation',
  'refinery',
] as const;

export function subtypeDisplayLabel(subtype: string): string {
  return SUBTYPE_LABELS[subtype] || subtype;
}

export function statusLabelRu(status: string): string {
  return STATUS_LABELS[status] || status;
}

export function formatAnalysisKm(km: number | null | undefined): string {
  if (km == null) return '—';
  const n = Number(km);
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** POI→external lines only for objects present on the map (FR-10). */
export type AnalysisRowFocus = {
  lon: number;
  lat: number;
  /** minLon, minLat, maxLon, maxLat — optional bbox to include POI and target */
  extentLonLat?: [number, number, number, number];
};

function infraObjectFocus(obj: InfraObject): { lon: number; lat: number } {
  if (obj.end_lon != null && obj.end_lat != null) {
    return {
      lon: (obj.lon + obj.end_lon) / 2,
      lat: (obj.lat + obj.end_lat) / 2,
    };
  }
  if (obj.coordinates && obj.coordinates.length >= 2) {
    const mid = obj.coordinates[Math.floor(obj.coordinates.length / 2)];
    return { lon: mid[0], lat: mid[1] };
  }
  return { lon: obj.lon, lat: obj.lat };
}

/** Coordinates to pan the map when user clicks an object name in the analysis table. */
export function resolveAnalysisRowFocus(
  row: AnalysisRow,
  infraObjects: InfraObject[],
  options?: {
    poi?: { lon: number; lat: number } | null;
    networkNodes?: { id: string; lon: number; lat: number }[];
  }
): AnalysisRowFocus | null {
  let lon: number | null = row.anchor_lon ?? null;
  let lat: number | null = row.anchor_lat ?? null;

  if (lon == null || lat == null) {
    const objId = row.nearest_object_id;
    if (objId) {
      const obj = infraObjects.find((o) => o.id === objId);
      if (obj) {
        const p = infraObjectFocus(obj);
        lon = p.lon;
        lat = p.lat;
      }
    }
  }

  if ((lon == null || lat == null) && row.nearest_node_id && options?.networkNodes) {
    const node = options.networkNodes.find((n) => n.id === row.nearest_node_id);
    if (node) {
      lon = node.lon;
      lat = node.lat;
    }
  }

  if (lon == null || lat == null) return null;

  const poi = options?.poi;
  if (poi) {
    const minLon = Math.min(poi.lon, lon);
    const maxLon = Math.max(poi.lon, lon);
    const minLat = Math.min(poi.lat, lat);
    const maxLat = Math.max(poi.lat, lat);
    return { lon, lat, extentLonLat: [minLon, minLat, maxLon, maxLat] };
  }

  return { lon, lat };
}

/** Keep analysis object refs in sync with objects actually drawn on the map. */
export function alignAnalysisRowsToMapObjects(
  rows: AnalysisRow[],
  mapObjects: { id: string }[]
): AnalysisRow[] {
  const onMap = new Set(mapObjects.map((o) => o.id));
  return rows.map((row) => {
    if (row.param_type !== 'external') return row;
    const id = row.nearest_object_id;
    if (!id || onMap.has(id)) return row;
    if (row.status === 'not_required') return row;
    return {
      ...row,
      object_name: null,
      nearest_object_id: null,
      anchor_lon: null,
      anchor_lat: null,
      distance_km: null,
      status: 'construction_required',
    };
  });
}

export function connectionLinesFromAnalysis(
  rows: AnalysisRow[],
  infraObjects: { id: string }[]
): AnalysisRow[] {
  const infraIds = new Set(infraObjects.map((o) => o.id));
  return rows.filter((row) => {
    if (row.param_type !== 'external') return false;
    if (row.status === 'not_required' || row.status === 'computed') return false;
    if (!row.nearest_object_id || !infraIds.has(row.nearest_object_id)) return false;
    if (row.anchor_lon == null || row.anchor_lat == null) return false;
    if (row.distance_km == null || row.distance_km <= 0) return false;
    return true;
  });
}

export function groupAnalysisRows(rows: AnalysisRow[]) {
  const internal = rows.filter(
    (r) => r.param_type === 'internal' && r.subtype !== 'pads'
  );
  const external = rows.filter((r) => r.param_type === 'external');
  const pads = rows.filter((r) => r.subtype === 'pads');
  return { internal, external, pads };
}

export function rowCostMln(
  row: AnalysisRow,
  _rawItems?: Record<string, unknown>[]
): number | null {
  if (row.cost_mln != null) return row.cost_mln;
  return null;
}

export function internalFormulaLabel(row: AnalysisRow): string | null {
  if (row.formula_label) return row.formula_label;
  if (row.km_per_pad != null && row.pads_count != null) {
    const dist = row.distance_km ?? row.km_per_pad * row.pads_count;
    return `${row.km_per_pad} км/КП × ${row.pads_count} КП = ${formatAnalysisKm(dist)} км`;
  }
  return null;
}

export function overallStatusBadgeClass(status: string): string {
  if (status === 'within_limit' || status === 'computed') return 'badge-success';
  if (status === 'exceeds_limit') return 'badge-danger';
  if (status === 'not_required') return 'badge-muted';
  return 'badge-warning';
}

export function statusRowClass(status: string): string {
  return overallStatusBadgeClass(status);
}
