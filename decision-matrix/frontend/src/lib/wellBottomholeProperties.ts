import type { InfraObject } from './api';

export const WELL_BOTTOMHOLE_LINKED_PAD_ID = 'well_bottomhole_linked_pad_id';
export const WELL_BOTTOMHOLE_WELL_INDEX = 'well_bottomhole_well_index';
export const WELL_BOTTOMHOLE_TVD_M = 'well_bottomhole_tvd_m';
export const WELL_BOTTOMHOLE_TARGET_INC = 'well_bottomhole_target_inc';
export const WELL_BOTTOMHOLE_TARGET_AZI = 'well_bottomhole_target_azi';
export const WELL_BOTTOMHOLE_GS_HEEL_ID = 'well_bottomhole_gs_heel_id';

export const BOTTOMHOLE_SUBTYPES = [
  'well_bottomhole_nnb',
  'well_bottomhole_gs_heel',
  'well_bottomhole_gs_toe',
] as const;

export type BottomholeSubtype = (typeof BOTTOMHOLE_SUBTYPES)[number];

export const BOTTOMHOLE_SUBTYPE_SET = new Set<string>(BOTTOMHOLE_SUBTYPES);

export const DEFAULT_BOTTOMHOLE_TVD_M = 1500;
export const DEFAULT_NNB_INC = 360;

export function isBottomholeSubtype(subtype: string | undefined | null): boolean {
  return subtype != null && BOTTOMHOLE_SUBTYPE_SET.has(subtype);
}

export function readBottomholeLinkedPadId(props: Record<string, unknown> | undefined): string | null {
  const raw = props?.[WELL_BOTTOMHOLE_LINKED_PAD_ID];
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

export function readBottomholeTvdM(props: Record<string, unknown> | undefined): number {
  const raw = props?.[WELL_BOTTOMHOLE_TVD_M];
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_BOTTOMHOLE_TVD_M;
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
