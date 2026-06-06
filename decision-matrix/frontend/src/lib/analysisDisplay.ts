import type { AnalysisRow, InfraObject } from './api';

type MapInfraLike = Pick<
  InfraObject,
  'id' | 'subtype' | 'name' | 'lon' | 'lat' | 'end_lon' | 'end_lat' | 'coordinates'
>;
import { STATUS_LABELS, SUBTYPE_LABELS } from './specs';
import {
  ANALYSIS_EXTERNAL_POINT_SUBTYPES,
} from './api/infrastructureSubtypesManifest';

export { ANALYSIS_LINE_SUBTYPES, ANALYSIS_EXTERNAL_LINEAR_SUBTYPES as EXTERNAL_LINEAR_SUBTYPES } from './api';
export const ANALYSIS_EXTERNAL_SUBTYPES = ANALYSIS_EXTERNAL_POINT_SUBTYPES;

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

function formatKmSlot(km: number | string | null | undefined): string {
  if (km == null || km === '') return '-';
  const formatted = formatAnalysisKm(typeof km === 'number' ? km : Number(km));
  if (formatted === '—') return '-';
  return `${formatted} км`;
}

/** Матрица / карточки: «88.9 км / 50 км», при отсутствии значения — «-». */
export function formatExternalDistanceBlock(
  item: Pick<AnalysisRow, 'distance_km' | 'limit_km'> | {
    distance_km?: number | string | null;
    limit_km?: number | string | null;
  },
  extraParts: string[] = []
): string {
  const core = `${formatKmSlot(item.distance_km)} / ${formatKmSlot(item.limit_km)}`;
  const extras = extraParts.filter(Boolean);
  return extras.length ? `${core} · ${extras.join(' · ')}` : core;
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

const ORPHAN_NODE_NAME = /^Узел [0-9a-f]{8}$/i;

/** Stale graph-node refs from old analysis (not infrastructure Point objects). */
export function isExternalLikeAnalysisRow(row: AnalysisRow): boolean {
  return row.param_type === 'external' || row.param_type === 'external_linear';
}

export function isOrphanNetworkAnalysisRef(row: AnalysisRow): boolean {
  if (!isExternalLikeAnalysisRow(row)) return false;
  if (row.param_type === 'external_linear') return false;
  if (row.anchor_type === 'network_node') return true;
  if (row.nearest_node_id && !row.nearest_object_id) return true;
  const name = row.object_name?.trim() ?? '';
  return ORPHAN_NODE_NAME.test(name);
}

/** Replace stale graph-node refs with a visible infrastructure object of the same subtype. */
function healExternalNetworkOrphan(row: AnalysisRow, mapObjects: MapInfraLike[]): AnalysisRow {
  const match = mapObjects.find((o) => o.subtype === row.subtype);
  if (!match) return clearInvalidExternalRef(row);
  let anchorLon = match.lon;
  let anchorLat = match.lat;
  if (match.end_lon != null && match.end_lat != null) {
    anchorLon = (match.lon + match.end_lon) / 2;
    anchorLat = (match.lat + match.end_lat) / 2;
  }
  return {
    ...row,
    nearest_object_id: match.id,
    object_name: match.name,
    nearest_node_id: null,
    anchor_lon: anchorLon,
    anchor_lat: anchorLat,
    anchor_type: 'point_object',
  };
}

function clearInvalidExternalRef(row: AnalysisRow): AnalysisRow {
  if (row.status === 'not_required') {
    return {
      ...row,
      object_name: null,
      nearest_object_id: null,
      nearest_node_id: null,
      anchor_lon: null,
      anchor_lat: null,
      anchor_type: null,
    };
  }
  return {
    ...row,
    object_name: null,
    nearest_object_id: null,
    nearest_node_id: null,
    anchor_lon: null,
    anchor_lat: null,
    anchor_type: null,
    distance_km: null,
    status: 'construction_required',
  };
}

/** Fit map to POI and external anchors after environment analysis. */
export function buildAnalysisResultMapFocus(
  poi: { lon: number; lat: number },
  rows: AnalysisRow[]
): AnalysisRowFocus | null {
  const lons = [poi.lon];
  const lats = [poi.lat];
  for (const row of rows) {
    if (!isExternalLikeAnalysisRow(row) || row.status === 'not_required') continue;
    if (row.anchor_lon == null || row.anchor_lat == null) continue;
    lons.push(row.anchor_lon);
    lats.push(row.anchor_lat);
  }
  if (lons.length === 1) return { lon: poi.lon, lat: poi.lat };
  return {
    lon: (Math.min(...lons) + Math.max(...lons)) / 2,
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    extentLonLat: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)],
  };
}

function pushCoord(lons: number[], lats: number[], lon: number, lat: number) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
  lons.push(lon);
  lats.push(lat);
}

function pushInfraExtent(lons: number[], lats: number[], obj: MapInfraLike) {
  pushCoord(lons, lats, obj.lon, obj.lat);
  if (obj.end_lon != null && obj.end_lat != null) {
    pushCoord(lons, lats, obj.end_lon, obj.end_lat);
  }
  if (obj.coordinates) {
    for (const c of obj.coordinates) pushCoord(lons, lats, c[0], c[1]);
  }
}

/** Fit map to all visible POIs and infrastructure on the main map. */
export function buildMapFitAllFocus(
  pois: { lon: number; lat: number }[],
  infraObjects: MapInfraLike[]
): AnalysisRowFocus | null {
  const lons: number[] = [];
  const lats: number[] = [];
  for (const p of pois) pushCoord(lons, lats, p.lon, p.lat);
  for (const obj of infraObjects) pushInfraExtent(lons, lats, obj);
  if (lons.length === 0) return null;
  if (lons.length === 1) return { lon: lons[0], lat: lats[0] };
  return {
    lon: (Math.min(...lons) + Math.max(...lons)) / 2,
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    extentLonLat: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)],
  };
}

/** Fit map to POI and every object used in distance connection lines. */
export function buildMapFocusForConnectionLines(
  poi: { lon: number; lat: number },
  lines: AnalysisRow[],
  infraObjects: MapInfraLike[] = []
): AnalysisRowFocus {
  const lons = [poi.lon];
  const lats = [poi.lat];

  for (const row of lines) {
    if (isValidAnalysisAnchor(row.anchor_lon, row.anchor_lat)) {
      pushCoord(lons, lats, row.anchor_lon!, row.anchor_lat!);
    }
    if (row.nearest_object_id) {
      const obj = infraObjects.find((o) => idKey(o.id) === idKey(row.nearest_object_id!));
      if (obj) pushInfraExtent(lons, lats, obj);
    }
  }

  if (lons.length === 1) return { lon: poi.lon, lat: poi.lat };
  return {
    lon: (Math.min(...lons) + Math.max(...lons)) / 2,
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    extentLonLat: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)],
  };
}

function idKey(id: string): string {
  return id.trim().toLowerCase();
}

/** Keep analysis refs for objects on visible layers (not client subtype filter). */
export function alignAnalysisRowsToMapObjects(
  rows: AnalysisRow[],
  mapObjects: MapInfraLike[]
): AnalysisRow[] {
  if (mapObjects.length === 0) {
    // Keep rows while infra/layers query is refetching (empty placeholder).
    return rows;
  }
  const onMap = new Set(mapObjects.map((o) => idKey(o.id)));
  return rows.map((row) => {
    if (!isExternalLikeAnalysisRow(row)) return row;
    if (isOrphanNetworkAnalysisRef(row)) return healExternalNetworkOrphan(row, mapObjects);
    const id = row.nearest_object_id;
    if (!id) return row;
    if (onMap.has(idKey(id))) return row;
    // Keep backend result when infra cache is briefly out of sync but analysis has a valid link.
    if (row.object_name && row.anchor_lon != null && row.anchor_lat != null) return row;
    return clearInvalidExternalRef(row);
  });
}

/** Valid WGS84 anchor for drawing a POI connection line on the map. */
export function isValidAnalysisAnchor(
  lon: number | null | undefined,
  lat: number | null | undefined
): boolean {
  if (lon == null || lat == null) return false;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return false;
  if (Math.abs(lon) > 180 || Math.abs(lat) > 90) return false;
  return true;
}

export function connectionLinesFromAnalysis(
  rows: AnalysisRow[],
  infraObjects: { id: string }[]
): AnalysisRow[] {
  const infraIds = new Set(infraObjects.map((o) => idKey(o.id)));
  return rows.filter((row) => {
    if (!isExternalLikeAnalysisRow(row)) return false;
    if (row.status === 'not_required' || row.status === 'computed') return false;
    if (!isValidAnalysisAnchor(row.anchor_lon, row.anchor_lat)) return false;
    if (row.distance_km == null || row.distance_km <= 0) return false;
    if (isOrphanNetworkAnalysisRef(row)) return false;
    if (row.nearest_object_id && infraIds.has(idKey(row.nearest_object_id))) return true;
    // POI→anchor line when analysis has a hit but infra cache is briefly out of sync.
    return Boolean(row.object_name);
  });
}

export function groupAnalysisRows(rows: AnalysisRow[]) {
  const internal = rows.filter(
    (r) => r.param_type === 'internal' && r.subtype !== 'pads'
  );
  const externalLinear = rows.filter((r) => r.param_type === 'external_linear');
  const external = rows.filter((r) => r.param_type === 'external');
  const pads = rows.filter((r) => r.subtype === 'pads');
  return { internal, externalLinear, external, pads };
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
