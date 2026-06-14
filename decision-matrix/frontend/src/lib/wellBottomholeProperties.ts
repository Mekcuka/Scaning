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

export const WELL_BOTTOMHOLE_GS_SUBTYPE = 'well_bottomhole_gs';

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

export const GS_ENTRY_MODE_OPTIONS: { value: GsEntryMode; label: string }[] = [
  { value: 'any', label: 'Любая' },
  { value: 'heel', label: 'heel (пятка)' },
  { value: 'toe', label: 'toe (сток)' },
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
  if (obj.end_lon == null || obj.end_lat == null) return null;
  return { heelLon: obj.lon, heelLat: obj.lat, toeLon: obj.end_lon, toeLat: obj.end_lat };
}

export type GsLineEndpointPoint = {
  id: string;
  lon: number;
  lat: number;
  subtype: 'well_bottomhole_gs_heel' | 'well_bottomhole_gs_toe';
};

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

  return linked;
}

function readStoredBottomholeWellIndex(props: Record<string, unknown> | undefined): number | null {
  const raw = props?.[WELL_BOTTOMHOLE_WELL_INDEX];
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 63) return null;
  return Math.round(n);
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
