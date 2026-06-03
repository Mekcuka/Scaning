import { api, type InfraObject, type InfraObjectCreate, type POI } from './api';
import type { MapFeatureSelection } from '../components/MapView';
import { isLineSubtype } from './infraGeometry';
import { normalizeLinePathEndpoints } from './lineEndpointRules';
import {
  infraDetailUndo,
  poiDetailUndo,
  type InfraDetailUndo,
  type PoiDetailUndo,
} from './mapUndo';
import { formValuesToPoiCreatePayload, poiToFormValues } from './poiParams';

export type MapClipboardItem =
  | { kind: 'poi'; sourceId: string; snapshot: PoiDetailUndo }
  | { kind: 'infra'; sourceId: string; snapshot: InfraDetailUndo };

function linePathFromSnapshot(snap: InfraDetailUndo): [number, number][] | null {
  if (snap.coordinates && snap.coordinates.length >= 2) {
    return snap.coordinates.map((c) => [c[0], c[1]] as [number, number]);
  }
  if (snap.end_lon != null && snap.end_lat != null) {
    return [
      [snap.lon, snap.lat],
      [snap.end_lon, snap.end_lat],
    ];
  }
  return null;
}

function collectPositions(items: MapClipboardItem[]): [number, number][] {
  const out: [number, number][] = [];
  for (const item of items) {
    if (item.kind === 'poi') {
      out.push([item.snapshot.lon, item.snapshot.lat]);
      continue;
    }
    const path = linePathFromSnapshot(item.snapshot);
    if (path) {
      for (const p of path) out.push(p);
    } else {
      out.push([item.snapshot.lon, item.snapshot.lat]);
    }
  }
  return out;
}

export function clipboardCentroid(items: MapClipboardItem[]): { lon: number; lat: number } {
  const positions = collectPositions(items);
  if (positions.length === 0) return { lon: 0, lat: 0 };
  let lon = 0;
  let lat = 0;
  for (const [lo, la] of positions) {
    lon += lo;
    lat += la;
  }
  return { lon: lon / positions.length, lat: lat / positions.length };
}

export function buildClipboardFromSelection(
  pois: POI[],
  infra: InfraObject[],
  selections: MapFeatureSelection[],
): MapClipboardItem[] {
  const items: MapClipboardItem[] = [];
  for (const sel of selections) {
    if (sel.kind === 'poi') {
      const poi = pois.find((p) => p.id === sel.id);
      if (poi) items.push({ kind: 'poi', sourceId: sel.id, snapshot: poiDetailUndo(poi) });
    } else {
      const obj = infra.find((o) => o.id === sel.id);
      if (obj) items.push({ kind: 'infra', sourceId: sel.id, snapshot: infraDetailUndo(obj) });
    }
  }
  return items;
}

function shiftSnapshot(
  snap: InfraDetailUndo | PoiDetailUndo,
  dLon: number,
  dLat: number,
  isLine: boolean,
): InfraDetailUndo | PoiDetailUndo {
  if (isLine) {
    const infra = snap as InfraDetailUndo;
    const path = linePathFromSnapshot(infra);
    if (!path) {
      return {
        ...infra,
        lon: infra.lon + dLon,
        lat: infra.lat + dLat,
        ...(infra.end_lon != null && infra.end_lat != null
          ? { end_lon: infra.end_lon + dLon, end_lat: infra.end_lat + dLat }
          : {}),
      };
    }
    const shifted = path.map(([lo, la]) => [lo + dLon, la + dLat] as [number, number]);
    return {
      ...infra,
      lon: shifted[0]![0],
      lat: shifted[0]![1],
      end_lon: shifted[shifted.length - 1]![0],
      end_lat: shifted[shifted.length - 1]![1],
      coordinates: shifted,
    };
  }
  return {
    ...snap,
    lon: snap.lon + dLon,
    lat: snap.lat + dLat,
  };
}

/** Shift all clipboard geometries so centroid moves to anchorLon/anchorLat. */
export function applyOffsetToClipboard(
  items: MapClipboardItem[],
  anchorLon: number,
  anchorLat: number,
): MapClipboardItem[] {
  const center = clipboardCentroid(items);
  const dLon = anchorLon - center.lon;
  const dLat = anchorLat - center.lat;
  return items.map((item) => {
    if (item.kind === 'poi') {
      return {
        ...item,
        snapshot: shiftSnapshot(item.snapshot, dLon, dLat, false) as PoiDetailUndo,
      };
    }
    const isLine = isLineSubtype(item.snapshot.subtype);
    return {
      ...item,
      snapshot: shiftSnapshot(item.snapshot, dLon, dLat, isLine) as InfraDetailUndo,
    };
  });
}

/** Preview positions at cursor without mutating stored clipboard. */
export function clipboardPreviewAt(
  items: MapClipboardItem[],
  anchorLon: number,
  anchorLat: number,
): { lon: number; lat: number; subtype: string }[] {
  const offset = applyOffsetToClipboard(items, anchorLon, anchorLat);
  const out: { lon: number; lat: number; subtype: string }[] = [];
  for (const item of offset) {
    if (item.kind === 'poi') {
      out.push({ lon: item.snapshot.lon, lat: item.snapshot.lat, subtype: 'poi' });
      continue;
    }
    if (isLineSubtype(item.snapshot.subtype)) continue;
    out.push({
      lon: item.snapshot.lon,
      lat: item.snapshot.lat,
      subtype: item.snapshot.subtype,
    });
  }
  return out;
}

/** Snap line endpoints to pasted point objects from the same clipboard (≤300 m). */
export function remapLineEndpointsOnPaste(
  lineSnap: InfraDetailUndo,
  pastedPoints: InfraObject[],
): InfraDetailUndo {
  const path = linePathFromSnapshot(lineSnap);
  if (!path || path.length < 2) return lineSnap;

  const pool = pastedPoints.filter((o) => !isLineSubtype(o.subtype));
  const normalized = normalizeLinePathEndpoints(
    lineSnap.subtype,
    path,
    pool,
  );

  return {
    ...lineSnap,
    lon: normalized[0]![0],
    lat: normalized[0]![1],
    end_lon: normalized[normalized.length - 1]![0],
    end_lat: normalized[normalized.length - 1]![1],
    coordinates: normalized,
  };
}

export function poiClipboardToCreatePayload(
  snap: PoiDetailUndo,
): Parameters<typeof api.createPoi>[1] {
  return formValuesToPoiCreatePayload(poiToFormValues(snap as POI)) as Parameters<
    typeof api.createPoi
  >[1];
}

export function infraClipboardToCreatePayload(
  snap: InfraDetailUndo,
  name: string,
): InfraObjectCreate {
  const desc =
    snap.properties && typeof snap.properties.description === 'string'
      ? snap.properties.description
      : undefined;
  return {
    name,
    subtype: snap.subtype,
    lon: snap.lon,
    lat: snap.lat,
    layer_id: snap.layer_id,
    ...(snap.end_lon != null && snap.end_lat != null
      ? { end_lon: snap.end_lon, end_lat: snap.end_lat }
      : {}),
    ...(snap.coordinates && snap.coordinates.length >= 2
      ? { coordinates: snap.coordinates }
      : {}),
    ...(snap.properties ? { properties: snap.properties } : {}),
    ...(desc ? { description: desc } : {}),
  };
}

/**
 * Backend rejects direct create for import-only derived subtypes.
 * Create via cluster «base» drawable subtype, then PATCH to target (see validation.py).
 */
const PASTE_INFRA_CREATE_BASE: Record<string, string> = {
  gas_pad: 'oil_pad',
  methanol_joint: 'node',
  power_line_node: 'node',
  gpes: 'gtes',
  vies: 'gtes',
  ukg: 'gas_processing',
  tsg: 'gas_processing',
};

export function infraPasteSubtypePlan(subtype: string): {
  createSubtype: string;
  targetSubtype: string;
} {
  const targetSubtype = subtype;
  const createSubtype = PASTE_INFRA_CREATE_BASE[targetSubtype] ?? targetSubtype;
  return { createSubtype, targetSubtype };
}

export function partitionClipboardForPaste(items: MapClipboardItem[]): {
  pois: MapClipboardItem[];
  pointInfra: MapClipboardItem[];
  lineInfra: MapClipboardItem[];
} {
  const pois: MapClipboardItem[] = [];
  const pointInfra: MapClipboardItem[] = [];
  const lineInfra: MapClipboardItem[] = [];
  for (const item of items) {
    if (item.kind === 'poi') pois.push(item);
    else if (isLineSubtype(item.snapshot.subtype)) lineInfra.push(item);
    else pointInfra.push(item);
  }
  return { pois, pointInfra, lineInfra };
}
