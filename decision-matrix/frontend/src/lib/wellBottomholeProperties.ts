import type { InfraObject } from './api';

export const WELL_BOTTOMHOLE_LINKED_PAD_ID = 'well_bottomhole_linked_pad_id';
export const WELL_BOTTOMHOLE_WELL_INDEX = 'well_bottomhole_well_index';
export const WELL_BOTTOMHOLE_TVD_M = 'well_bottomhole_tvd_m';
export const WELL_BOTTOMHOLE_HEEL_TVD_M = 'well_bottomhole_heel_tvd_m';
export const WELL_BOTTOMHOLE_TOE_TVD_M = 'well_bottomhole_toe_tvd_m';
export const WELL_BOTTOMHOLE_TARGET_INC = 'well_bottomhole_target_inc';
export const WELL_BOTTOMHOLE_TARGET_AZI = 'well_bottomhole_target_azi';
export const WELL_BOTTOMHOLE_GS_HEEL_ID = 'well_bottomhole_gs_heel_id';
export const WELL_BOTTOMHOLE_GS_ENTRY_MODE = 'well_bottomhole_gs_entry_mode';
export const WELL_BOTTOMHOLE_ROLE = 'well_bottomhole_role';
export const WELL_BOTTOMHOLE_PARENT_ID = 'well_bottomhole_parent_id';

/** UUID refs remapped on map batch-paste when twin is in the same batch. */
export const WELL_BOTTOMHOLE_PASTE_BATCH_REF_KEYS = [
  WELL_BOTTOMHOLE_PARENT_ID,
  WELL_BOTTOMHOLE_GS_HEEL_ID,
] as const;

/** All bottomhole UUID refs validated on paste (includes linked pad). */
export const WELL_BOTTOMHOLE_PASTE_REF_KEYS = [
  WELL_BOTTOMHOLE_LINKED_PAD_ID,
  ...WELL_BOTTOMHOLE_PASTE_BATCH_REF_KEYS,
] as const;

export type BottomholeRole = 'main' | 'lateral';
export const DEFAULT_BOTTOMHOLE_ROLE: BottomholeRole = 'main';
export const BOTTOMHOLE_ROLE_OPTIONS: { value: BottomholeRole; label: string }[] = [
  { value: 'main', label: 'Основной забой' },
  { value: 'lateral', label: 'Доп.ствол' },
];

export const WELL_BOTTOMHOLE_GS_SUBTYPE = 'well_bottomhole_gs';

/** Synthetic map/3D display key for lateral-role bottomholes (not an infra subtype). */
export const WELL_BOTTOMHOLE_LATERAL_DISPLAY = 'well_bottomhole_lateral';
export const BOTTOMHOLE_LATERAL_COLOR = '#7b1fa2';

export const BOTTOMHOLE_SUBTYPES = [
  'well_bottomhole_nnb',
  'well_bottomhole_gs',
  'well_bottomhole_gs_heel',
  'well_bottomhole_gs_toe',
] as const;

export type BottomholeSubtype = (typeof BOTTOMHOLE_SUBTYPES)[number];

export const BOTTOMHOLE_SUBTYPE_SET = new Set<string>(BOTTOMHOLE_SUBTYPES);

export const DEFAULT_BOTTOMHOLE_TVD_M = 1500;
export const DEFAULT_NNB_INC = 360;

export type GsEntryMode = 'any' | 'heel' | 'toe';
export const DEFAULT_GS_ENTRY_MODE: GsEntryMode = 'any';

/** User-facing labels for GS horizontal ends (Т1 = kick-off side, Т3 = toe side). */
export const GS_HEEL_LABEL = 'Т1';
export const GS_TOE_LABEL = 'Т3';

export function gsEndpointLabel(role: 'heel' | 'toe'): string {
  return role === 'heel' ? GS_HEEL_LABEL : GS_TOE_LABEL;
}

export function gsEndpointRangeLabel(): string {
  return `${GS_HEEL_LABEL}–${GS_TOE_LABEL}`;
}

export const GS_ENTRY_MODE_OPTIONS: { value: GsEntryMode; label: string }[] = [
  { value: 'any', label: 'Любая' },
  { value: 'heel', label: GS_HEEL_LABEL },
  { value: 'toe', label: GS_TOE_LABEL },
];

export function readGsEntryMode(props: Record<string, unknown> | undefined): GsEntryMode {
  const raw = String(props?.[WELL_BOTTOMHOLE_GS_ENTRY_MODE] ?? DEFAULT_GS_ENTRY_MODE).toLowerCase();
  if (raw === 'heel' || raw === 'toe') return raw;
  return 'any';
}

export function isGsBottomholeLine(obj: InfraObject): boolean {
  return obj.subtype === WELL_BOTTOMHOLE_GS_SUBTYPE;
}

export function readGsLineEndpoints(
  obj: InfraObject,
): { heelLon: number; heelLat: number; toeLon: number; toeLat: number } | null {
  if (!isGsBottomholeLine(obj)) return null;
  if (obj.end_lon != null && obj.end_lat != null) {
    return { heelLon: obj.lon, heelLat: obj.lat, toeLon: obj.end_lon, toeLat: obj.end_lat };
  }
  const coords = obj.coordinates;
  if (coords && coords.length >= 2) {
    const first = coords[0]!;
    const last = coords[coords.length - 1]!;
    return {
      heelLon: first[0]!,
      heelLat: first[1]!,
      toeLon: last[0]!,
      toeLat: last[1]!,
    };
  }
  return null;
}

export type GsLineEndpointPoint = {
  id: string;
  lon: number;
  lat: number;
  subtype: 'well_bottomhole_gs_heel' | 'well_bottomhole_gs_toe';
};

export const GS_LINE_HEEL_SUFFIX = ':gs-heel';
export const GS_LINE_TOE_SUFFIX = ':gs-toe';

export function parseGsLineEndpointFeatureId(
  featureId: string,
): { objectId: string; endpoint: 'heel' | 'toe' } | null {
  if (featureId.endsWith(GS_LINE_HEEL_SUFFIX)) {
    return {
      objectId: featureId.slice(0, -GS_LINE_HEEL_SUFFIX.length),
      endpoint: 'heel',
    };
  }
  if (featureId.endsWith(GS_LINE_TOE_SUFFIX)) {
    return {
      objectId: featureId.slice(0, -GS_LINE_TOE_SUFFIX.length),
      endpoint: 'toe',
    };
  }
  return null;
}

export function buildGsLineEndpointMovePayload(
  obj: InfraObject,
  endpoint: 'heel' | 'toe',
  lon: number,
  lat: number,
): {
  lon: number;
  lat: number;
  end_lon: number;
  end_lat: number;
  coordinates: [[number, number], [number, number]];
} | null {
  const endpoints = readGsLineEndpoints(obj);
  if (!endpoints) return null;
  if (endpoint === 'heel') {
    return {
      lon,
      lat,
      end_lon: endpoints.toeLon,
      end_lat: endpoints.toeLat,
      coordinates: [
        [lon, lat],
        [endpoints.toeLon, endpoints.toeLat],
      ],
    };
  }
  return {
    lon: endpoints.heelLon,
    lat: endpoints.heelLat,
    end_lon: lon,
    end_lat: lat,
    coordinates: [
      [endpoints.heelLon, endpoints.heelLat],
      [lon, lat],
    ],
  };
}

/** Map icon markers at heel and toe for unified GS line objects. */
export function gsLineEndpointPoints(obj: InfraObject): GsLineEndpointPoint[] {
  const endpoints = readGsLineEndpoints(obj);
  if (!endpoints) return [];
  return [
    {
      id: `${obj.id}:gs-heel`,
      lon: endpoints.heelLon,
      lat: endpoints.heelLat,
      subtype: 'well_bottomhole_gs_heel',
    },
    {
      id: `${obj.id}:gs-toe`,
      lon: endpoints.toeLon,
      lat: endpoints.toeLat,
      subtype: 'well_bottomhole_gs_toe',
    },
  ];
}

export function isBottomholeSubtype(subtype: string | undefined | null): boolean {
  return subtype != null && BOTTOMHOLE_SUBTYPE_SET.has(subtype);
}

export function readBottomholeLinkedPadId(props: Record<string, unknown> | undefined): string | null {
  const raw = props?.[WELL_BOTTOMHOLE_LINKED_PAD_ID];
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

export function readBottomholeRole(props: Record<string, unknown> | undefined): BottomholeRole {
  const raw = String(props?.[WELL_BOTTOMHOLE_ROLE] ?? DEFAULT_BOTTOMHOLE_ROLE).toLowerCase();
  return raw === 'lateral' ? 'lateral' : 'main';
}

export function isLateralBottomhole(obj: InfraObject): boolean {
  return readBottomholeRole(obj.properties) === 'lateral';
}

export function isMainBottomhole(obj: InfraObject): boolean {
  return readBottomholeRole(obj.properties) === 'main';
}

export function readBottomholeParentId(props: Record<string, unknown> | undefined): string | null {
  const raw = props?.[WELL_BOTTOMHOLE_PARENT_ID];
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

export function applyLateralInheritanceFromParent(
  props: Record<string, unknown>,
  parent: InfraObject | null | undefined,
): Record<string, unknown> {
  const merged = { ...props };
  if (readBottomholeRole(merged) !== 'lateral') {
    if (readBottomholeRole(merged) === 'main') delete merged[WELL_BOTTOMHOLE_PARENT_ID];
    return merged;
  }
  if (!parent) return merged;
  const parentProps = parent.properties ?? {};
  const padId = readBottomholeLinkedPadId(parentProps);
  if (padId) merged[WELL_BOTTOMHOLE_LINKED_PAD_ID] = padId;
  const parentIdx = readStoredBottomholeWellIndex(parentProps);
  if (parentIdx != null) merged[WELL_BOTTOMHOLE_WELL_INDEX] = parentIdx;
  return merged;
}

/** Bottomholes with direct `well_bottomhole_linked_pad_id` on the pad. */
export function listBottomholesLinkedToPad(infraObjects: InfraObject[], padId: string): InfraObject[] {
  return infraObjects.filter(
    (obj) => isBottomholeSubtype(obj.subtype) && readBottomholeLinkedPadId(obj.properties) === padId,
  );
}

/** Bottomholes linked to pad, including GS toes/heels paired without direct pad link. */
export function bottomholesLinkedToPad(infraObjects: InfraObject[], padId: string): InfraObject[] {
  const linked = listBottomholesLinkedToPad(infraObjects, padId);
  const linkedIds = new Set(linked.map((o) => o.id));

  const heelIdsOnPad = new Set(
    linked.filter((o) => o.subtype === 'well_bottomhole_gs_heel').map((o) => o.id),
  );
  for (const obj of infraObjects) {
    if (obj.subtype !== 'well_bottomhole_gs_toe' || linkedIds.has(obj.id)) continue;
    const heelIdRaw = obj.properties?.[WELL_BOTTOMHOLE_GS_HEEL_ID];
    if (typeof heelIdRaw === 'string' && heelIdsOnPad.has(heelIdRaw)) {
      linked.push(obj);
      linkedIds.add(obj.id);
    }
  }

  const missingHeelIds = new Set<string>();
  for (const obj of linked) {
    if (obj.subtype !== 'well_bottomhole_gs_toe') continue;
    const heelIdRaw = obj.properties?.[WELL_BOTTOMHOLE_GS_HEEL_ID];
    if (typeof heelIdRaw === 'string' && !linkedIds.has(heelIdRaw)) {
      missingHeelIds.add(heelIdRaw);
    }
  }
  for (const obj of infraObjects) {
    if (obj.subtype !== 'well_bottomhole_gs_heel' || linkedIds.has(obj.id)) continue;
    if (missingHeelIds.has(obj.id)) {
      linked.push(obj);
      linkedIds.add(obj.id);
    }
  }

  const mainIdsOnPad = new Set(
    linked.filter((o) => isMainBottomhole(o)).map((o) => o.id),
  );
  for (const obj of infraObjects) {
    if (!isBottomholeSubtype(obj.subtype) || linkedIds.has(obj.id)) continue;
    if (!isLateralBottomhole(obj)) continue;
    const parentId = readBottomholeParentId(obj.properties);
    if (typeof parentId === 'string' && mainIdsOnPad.has(parentId)) {
      linked.push(obj);
      linkedIds.add(obj.id);
    }
  }

  const missingMainIds = new Set<string>();
  for (const obj of linked) {
    if (!isLateralBottomhole(obj)) continue;
    const parentId = readBottomholeParentId(obj.properties);
    if (typeof parentId === 'string' && !linkedIds.has(parentId)) {
      missingMainIds.add(parentId);
    }
  }
  for (const obj of infraObjects) {
    if (!isBottomholeSubtype(obj.subtype) || linkedIds.has(obj.id)) continue;
    if (!isMainBottomhole(obj)) continue;
    if (missingMainIds.has(obj.id)) {
      linked.push(obj);
      linkedIds.add(obj.id);
    }
  }

  return linked;
}

/** All well bottomhole infra objects in the project. */
export function listProjectBottomholes(infraObjects: InfraObject[]): InfraObject[] {
  return infraObjects.filter((obj) => isBottomholeSubtype(obj.subtype));
}

/** Project bottomholes not linked to the given pad (by id set from bottomholesLinkedToPad). */
export function bottomholesExternalToPad(infraObjects: InfraObject[], padId: string): InfraObject[] {
  const linkedIds = new Set(bottomholesLinkedToPad(infraObjects, padId).map((o) => o.id));
  return listProjectBottomholes(infraObjects).filter((obj) => !linkedIds.has(obj.id));
}

export function readStoredBottomholeWellIndex(
  props: Record<string, unknown> | undefined,
): number | null {
  const raw = props?.[WELL_BOTTOMHOLE_WELL_INDEX];
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 63) return null;
  return Math.round(n);
}

/** Same slot rules as backend `bottomhole_sync._assign_bottomhole_well_indices`. */
export function assignBottomholeWellIndices(
  bottomholes: InfraObject[],
): Map<string, number> {
  const indexMap = new Map<string, number>();
  const occupied = new Set<number>();
  const deferred: InfraObject[] = [];

  for (const obj of bottomholes) {
    const stored = readStoredBottomholeWellIndex(obj.properties);
    if (stored != null) {
      indexMap.set(obj.id, stored);
      occupied.add(stored);
      continue;
    }
    const st = (obj.subtype ?? '').toLowerCase();
    if (st === 'well_bottomhole_gs_toe' || isLateralBottomhole(obj)) continue;
    deferred.push(obj);
  }

  deferred.sort((a, b) => `${a.name ?? ''}:${a.id}`.localeCompare(`${b.name ?? ''}:${b.id}`));
  let nextIdx = 0;
  for (const obj of deferred) {
    while (occupied.has(nextIdx)) nextIdx += 1;
    indexMap.set(obj.id, nextIdx);
    occupied.add(nextIdx);
    nextIdx += 1;
  }

  const byId = new Map(bottomholes.map((o) => [o.id, o]));
  for (const obj of bottomholes) {
    if ((obj.subtype ?? '').toLowerCase() !== 'well_bottomhole_gs_toe') continue;
    const stored = readStoredBottomholeWellIndex(obj.properties);
    if (stored != null) {
      indexMap.set(obj.id, stored);
      continue;
    }
    const heelIdRaw = obj.properties?.[WELL_BOTTOMHOLE_GS_HEEL_ID];
    if (typeof heelIdRaw !== 'string' || !heelIdRaw) continue;
    const heelIdx = indexMap.get(heelIdRaw);
    if (heelIdx != null) indexMap.set(obj.id, heelIdx);
  }

  for (const obj of bottomholes) {
    if (!isLateralBottomhole(obj)) continue;
    const stored = readStoredBottomholeWellIndex(obj.properties);
    if (stored != null) {
      indexMap.set(obj.id, stored);
      continue;
    }
    const parentId = readBottomholeParentId(obj.properties);
    if (!parentId) continue;
    const parentIdx = indexMap.get(parentId);
    if (parentIdx != null) indexMap.set(obj.id, parentIdx);
  }

  return indexMap;
}

export function readBottomholeWellIndexForObject(
  obj: InfraObject,
  bottomholes: InfraObject[],
): number | null {
  const map = assignBottomholeWellIndices(bottomholes);
  return map.get(obj.id) ?? null;
}

/**
 * Logical well slots implied by map bottomholes (NNB + GS heel; toe shares heel slot).
 * Mirrors backend `required_well_count_from_bottomholes` slot demand without pad fallback.
 */
export function logicalWellCountFromBottomholes(bottomholes: InfraObject[]): number {
  if (bottomholes.length === 0) return 0;

  let maxExplicit = -1;
  let nnbCount = 0;
  let gsHeelCount = 0;
  for (const bh of bottomholes) {
    if (isLateralBottomhole(bh)) continue;
    const stored = readStoredBottomholeWellIndex(bh.properties);
    if (stored != null) maxExplicit = Math.max(maxExplicit, stored);
    if (bh.subtype === 'well_bottomhole_nnb') nnbCount += 1;
    else if (bh.subtype === 'well_bottomhole_gs_heel' || bh.subtype === 'well_bottomhole_gs') {
      gsHeelCount += 1;
    }
  }

  const slotDemand = Math.max(
    maxExplicit >= 0 ? maxExplicit + 1 : 0,
    nnbCount + gsHeelCount,
  );
  return Math.max(slotDemand, 1);
}

export function readBottomholeTvdM(props: Record<string, unknown> | undefined): number {
  const raw = props?.[WELL_BOTTOMHOLE_TVD_M];
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_BOTTOMHOLE_TVD_M;
}

export function readGsHeelTvdM(props: Record<string, unknown> | undefined): number {
  const raw = props?.[WELL_BOTTOMHOLE_HEEL_TVD_M];
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (Number.isFinite(n) && n > 0) return n;
  return readBottomholeTvdM(props);
}

export function readGsToeTvdM(props: Record<string, unknown> | undefined): number {
  const raw = props?.[WELL_BOTTOMHOLE_TOE_TVD_M];
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (Number.isFinite(n) && n > 0) return n;
  return readBottomholeTvdM(props);
}

/** Editable bottomhole keys in the map object detail panel. */
export const BOTTOMHOLE_EDITABLE_PROP_KEYS = [
  WELL_BOTTOMHOLE_LINKED_PAD_ID,
  WELL_BOTTOMHOLE_WELL_INDEX,
  WELL_BOTTOMHOLE_ROLE,
  WELL_BOTTOMHOLE_PARENT_ID,
  WELL_BOTTOMHOLE_TVD_M,
  WELL_BOTTOMHOLE_HEEL_TVD_M,
  WELL_BOTTOMHOLE_TOE_TVD_M,
  WELL_BOTTOMHOLE_TARGET_INC,
  WELL_BOTTOMHOLE_TARGET_AZI,
  WELL_BOTTOMHOLE_GS_HEEL_ID,
  WELL_BOTTOMHOLE_GS_ENTRY_MODE,
] as const;

export function isBottomholePropCleared(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

export function bottomholePropertyValuesEqual(a: unknown, b: unknown): boolean {
  if (isBottomholePropCleared(a) && isBottomholePropCleared(b)) return true;
  const na = typeof a === 'number' ? a : Number(a);
  const nb = typeof b === 'number' ? b : Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return Math.abs(na - nb) < 1e-9;
  return String(a).trim() === String(b).trim();
}

export function pickBottomholePropsPatch(
  props: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!props) return out;
  for (const key of BOTTOMHOLE_EDITABLE_PROP_KEYS) {
    if (props[key] !== undefined) out[key] = props[key];
  }
  return out;
}

export function mergeBottomholeProperties(
  base: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const merged = { ...(base ?? {}) };
  if (!patch) return merged;
  for (const [key, value] of Object.entries(patch)) {
    if (isBottomholePropCleared(value)) delete merged[key];
    else merged[key] = value;
  }
  return merged;
}

export function applyBottomholePropsPatch(
  prev: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...prev };
  for (const [key, value] of Object.entries(incoming)) {
    if (isBottomholePropCleared(value)) delete next[key];
    else next[key] = value;
  }
  return next;
}

/** Drop patch entries that already match persisted server properties. */
export function reconcileBottomholePropsPatch(
  serverProps: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  if (Object.keys(patch).length === 0) return patch;
  const server = serverProps ?? {};
  let changed = false;
  const next: Record<string, unknown> = { ...patch };
  for (const key of Object.keys(next)) {
    if (bottomholePropertyValuesEqual(server[key], next[key])) {
      delete next[key];
      changed = true;
    }
  }
  return changed ? next : patch;
}

export function isGsBottomholeSubtype(subtype: string | undefined | null): boolean {
  return (
    subtype === WELL_BOTTOMHOLE_GS_SUBTYPE ||
    subtype === 'well_bottomhole_gs_heel' ||
    subtype === 'well_bottomhole_gs_toe'
  );
}

function haversineKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findNearestMainBottomhole(
  infraObjects: InfraObject[],
  lon: number,
  lat: number,
  linkedPadId?: string | null,
): InfraObject | null {
  let best: InfraObject | null = null;
  let bestD = Infinity;
  for (const obj of infraObjects) {
    if (!isBottomholeSubtype(obj.subtype) || !isMainBottomhole(obj)) continue;
    if (linkedPadId && readBottomholeLinkedPadId(obj.properties) !== linkedPadId) continue;
    const d = haversineKm(lon, lat, obj.lon, obj.lat);
    if (d < bestD) {
      bestD = d;
      best = obj;
    }
  }
  return best;
}

export function resolveBottomholeMapSubtype(obj: InfraObject): string {
  if (isLateralBottomhole(obj)) return WELL_BOTTOMHOLE_LATERAL_DISPLAY;
  return obj.subtype ?? 'well_bottomhole_nnb';
}

export function findNearestPad(
  pads: InfraObject[],
  lon: number,
  lat: number,
): InfraObject | null {
  let best: InfraObject | null = null;
  let bestD = Infinity;
  for (const pad of pads) {
    if (pad.subtype !== 'oil_pad' && pad.subtype !== 'gas_pad') continue;
    const d = haversineKm(lon, lat, pad.lon, pad.lat);
    if (d < bestD) {
      bestD = d;
      best = pad;
    }
  }
  return best;
}

export type GsBottomholeConnector = {
  id: string;
  heelId: string;
  toeId: string;
  coordinates: [[number, number], [number, number]];
};

/** Plan-view line between paired GS heel and toe infra objects. */
export function buildGsBottomholeConnectors(infraObjects: InfraObject[]): GsBottomholeConnector[] {
  const byId = new Map(infraObjects.map((o) => [o.id, o]));
  const connectors: GsBottomholeConnector[] = [];
  for (const toe of infraObjects) {
    if (toe.subtype !== 'well_bottomhole_gs_toe') continue;
    const heelIdRaw = toe.properties?.[WELL_BOTTOMHOLE_GS_HEEL_ID];
    if (typeof heelIdRaw !== 'string' || !heelIdRaw) continue;
    const heel = byId.get(heelIdRaw);
    if (!heel || heel.subtype !== 'well_bottomhole_gs_heel') continue;
    connectors.push({
      id: `gs-bottomhole:${toe.id}`,
      heelId: heel.id,
      toeId: toe.id,
      coordinates: [
        [heel.lon, heel.lat],
        [toe.lon, toe.lat],
      ],
    });
  }
  return connectors;
}

export type LateralBottomholeConnector = {
  id: string;
  parentId: string;
  lateralId: string;
  coordinates: [[number, number], [number, number]];
};

/** Plan-view match tolerance: PyWellGeo lateral branch tip vs bottomhole target. */
export const LATERAL_CONNECTOR_TRAJECTORY_TOLERANCE_M = 75;

export type LateralBranchPlanEndpoint = {
  padId: string;
  wellIndex: number;
  lon: number;
  lat: number;
};

export type TrajectoryGeoJsonFeatureLike = {
  properties: { kind?: string; well_index?: number; infra_object_id?: string };
  geometry: { coordinates?: unknown };
};

function haversineM(lon1: number, lat1: number, lon2: number, lat2: number): number {
  return haversineKm(lon1, lat1, lon2, lat2) * 1000;
}

function lateralBottomholePlanTargets(lateral: InfraObject): Array<{ lon: number; lat: number }> {
  if (isGsBottomholeLine(lateral)) {
    const endpoints = readGsLineEndpoints(lateral);
    if (!endpoints) return [];
    return [
      { lon: endpoints.heelLon, lat: endpoints.heelLat },
      { lon: endpoints.toeLon, lat: endpoints.toeLat },
    ];
  }
  return [{ lon: lateral.lon, lat: lateral.lat }];
}

/** PyWellGeo lateral branch tips from map/project GeoJSON (kind=pywellgeo_branch). */
export function lateralBranchPlanEndpointsFromGeoJson(
  features: TrajectoryGeoJsonFeatureLike[],
): LateralBranchPlanEndpoint[] {
  const out: LateralBranchPlanEndpoint[] = [];
  for (const feature of features) {
    if (feature.properties.kind !== 'pywellgeo_branch') continue;
    const padId = feature.properties.infra_object_id;
    const wellIndex = feature.properties.well_index;
    if (!padId || wellIndex == null) continue;
    const coords = feature.geometry.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const last = coords[coords.length - 1];
    if (!Array.isArray(last) || last.length < 2) continue;
    const lon = Number(last[0]);
    const lat = Number(last[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    out.push({ padId, wellIndex, lon, lat });
  }
  return out;
}

/**
 * Lateral bottomholes that already have a computed PyWellGeo branch to their target —
 * skip parent→lateral plan connector (trajectory line is shown instead).
 */
export function lateralBottomholeIdsWithBranchCoverage(
  infraObjects: InfraObject[],
  branchEndpoints: LateralBranchPlanEndpoint[],
  toleranceM = LATERAL_CONNECTOR_TRAJECTORY_TOLERANCE_M,
): Set<string> {
  if (branchEndpoints.length === 0) return new Set();

  const byId = new Map(infraObjects.map((o) => [o.id, o]));
  const indexMap = assignBottomholeWellIndices(infraObjects);
  const covered = new Set<string>();

  for (const lateral of infraObjects) {
    if (!isBottomholeSubtype(lateral.subtype) || !isLateralBottomhole(lateral)) continue;
    const parentId = readBottomholeParentId(lateral.properties);
    if (!parentId) continue;
    const parent = byId.get(parentId);
    if (!parent) continue;
    const padId = readBottomholeLinkedPadId(parent.properties);
    if (!padId) continue;
    const wellIndex = indexMap.get(lateral.id);
    if (wellIndex == null) continue;

    const targets = lateralBottomholePlanTargets(lateral);
    if (targets.length === 0) continue;

    for (const endpoint of branchEndpoints) {
      if (endpoint.padId !== padId || endpoint.wellIndex !== wellIndex) continue;
      for (const target of targets) {
        if (haversineM(target.lon, target.lat, endpoint.lon, endpoint.lat) <= toleranceM) {
          covered.add(lateral.id);
          break;
        }
      }
      if (covered.has(lateral.id)) break;
    }
  }

  return covered;
}

export type BuildLateralBottomholeConnectorsOptions = {
  excludeLateralIds?: ReadonlySet<string> | readonly string[];
};

function lateralConnectorEndpoint(obj: InfraObject): { lon: number; lat: number } | null {
  if (isGsBottomholeLine(obj)) {
    const endpoints = readGsLineEndpoints(obj);
    if (!endpoints) return null;
    return { lon: endpoints.heelLon, lat: endpoints.heelLat };
  }
  return { lon: obj.lon, lat: obj.lat };
}

/** Plan-view line between main bottomhole and its lateral child. */
export function buildLateralBottomholeConnectors(
  infraObjects: InfraObject[],
  options?: BuildLateralBottomholeConnectorsOptions,
): LateralBottomholeConnector[] {
  const excludeRaw = options?.excludeLateralIds;
  const excluded =
    excludeRaw instanceof Set
      ? excludeRaw
      : excludeRaw?.length
        ? new Set(excludeRaw)
        : null;
  const byId = new Map(infraObjects.map((o) => [o.id, o]));
  const connectors: LateralBottomholeConnector[] = [];
  for (const lateral of infraObjects) {
    if (!isBottomholeSubtype(lateral.subtype) || !isLateralBottomhole(lateral)) continue;
    if (excluded?.has(lateral.id)) continue;
    const parentId = readBottomholeParentId(lateral.properties);
    if (!parentId) continue;
    const parent = byId.get(parentId);
    if (!parent || !isMainBottomhole(parent)) continue;
    const parentPt = lateralConnectorEndpoint(parent);
    const lateralPt = lateralConnectorEndpoint(lateral);
    if (!parentPt || !lateralPt) continue;
    connectors.push({
      id: `lateral-bottomhole:${lateral.id}`,
      parentId: parent.id,
      lateralId: lateral.id,
      coordinates: [
        [parentPt.lon, parentPt.lat],
        [lateralPt.lon, lateralPt.lat],
      ],
    });
  }
  return connectors;
}

/** Flat list with lateral rows nested under their parent main bottomhole. */
export function orderBottomholesHierarchical(bottomholes: InfraObject[]): InfraObject[] {
  const mains = bottomholes.filter((o) => isMainBottomhole(o));
  const lateralsByParent = new Map<string, InfraObject[]>();
  for (const lateral of bottomholes) {
    if (!isLateralBottomhole(lateral)) continue;
    const parentId = readBottomholeParentId(lateral.properties);
    if (!parentId) continue;
    const list = lateralsByParent.get(parentId) ?? [];
    list.push(lateral);
    lateralsByParent.set(parentId, list);
  }
  const ordered: InfraObject[] = [];
  const placed = new Set<string>();
  for (const main of mains) {
    ordered.push(main);
    placed.add(main.id);
    const children = lateralsByParent.get(main.id) ?? [];
    children.sort((a, b) => `${a.name ?? ''}:${a.id}`.localeCompare(`${b.name ?? ''}:${b.id}`));
    for (const child of children) {
      ordered.push(child);
      placed.add(child.id);
    }
  }
  for (const bh of bottomholes) {
    if (!placed.has(bh.id)) ordered.push(bh);
  }
  return ordered;
}
