import { api, type InfraObject, type InfraObjectCreate, type POI } from './api';
import type { MapFeatureSelection } from '../components/MapView';
import { isLineSubtype } from './infraGeometry';
import { lineEndpointAttachmentsFromObject } from './lineEndpointRules';
import {
  infraDetailUndo,
  poiDetailUndo,
  type InfraDetailUndo,
  type PoiDetailUndo,
} from './mapUndo';
import { formValuesToPoiCreatePayload, poiToFormValues } from './poiParams';

export type MapClipboardLineEndpointAttach = {
  startSourceId?: string;
  finishSourceId?: string;
};

export type MapClipboardItem =
  | { kind: 'poi'; sourceId: string; snapshot: PoiDetailUndo }
  | {
      kind: 'infra';
      sourceId: string;
      snapshot: InfraDetailUndo;
      endpointAttach?: MapClipboardLineEndpointAttach;
    };

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

function selectionInfraIds(selections: MapFeatureSelection[]): Set<string> {
  const ids = new Set<string>();
  for (const sel of selections) {
    if (sel.kind === 'infra') ids.add(sel.id);
  }
  return ids;
}

function projectPointPool(infra: InfraObject[]): InfraObject[] {
  return infra.filter((o) => !isLineSubtype(o.subtype));
}

/** Which line ends are tied to point objects in this copy (detect on full map; paste only twins in selection). */
function endpointAttachForLine(
  line: InfraObject,
  allInfra: InfraObject[],
  copiedInfraIds: Set<string>,
): MapClipboardLineEndpointAttach | undefined {
  const pointPool = projectPointPool(allInfra);
  const endpoints = lineEndpointAttachmentsFromObject(line, pointPool, pointPool);
  if (!endpoints) return undefined;
  const attach: MapClipboardLineEndpointAttach = {};
  if (endpoints.startAttach && copiedInfraIds.has(endpoints.startAttach.object.id)) {
    attach.startSourceId = endpoints.startAttach.object.id;
  }
  if (endpoints.finishAttach && copiedInfraIds.has(endpoints.finishAttach.object.id)) {
    attach.finishSourceId = endpoints.finishAttach.object.id;
  }
  if (!attach.startSourceId && !attach.finishSourceId) return undefined;
  return attach;
}

export function buildClipboardFromSelection(
  pois: POI[],
  infra: InfraObject[],
  selections: MapFeatureSelection[],
): MapClipboardItem[] {
  const copiedInfraIds = selectionInfraIds(selections);
  const items: MapClipboardItem[] = [];
  for (const sel of selections) {
    if (sel.kind === 'poi') {
      const poi = pois.find((p) => p.id === sel.id);
      if (poi) items.push({ kind: 'poi', sourceId: sel.id, snapshot: poiDetailUndo(poi) });
    } else {
      const obj = infra.find((o) => o.id === sel.id);
      if (!obj) continue;
      const endpointAttach = isLineSubtype(obj.subtype)
        ? endpointAttachForLine(obj, infra, copiedInfraIds)
        : undefined;
      items.push({
        kind: 'infra',
        sourceId: sel.id,
        snapshot: infraDetailUndo(obj),
        ...(endpointAttach ? { endpointAttach } : {}),
      });
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

export type LinePasteRemapResult = {
  snap: InfraDetailUndo;
  line_snap_start_object_id?: string;
  line_snap_finish_object_id?: string;
};

/**
 * After paste: map snap ids to created twins; keep shifted polyline vertices unchanged.
 * Geometry was already moved by applyOffsetToClipboard; rewriting ends to twin lon/lat
 * can bend the line when stored coordinates[0] ≠ lon/lat.
 */
export function remapLineEndpointsForPaste(
  lineSnap: InfraDetailUndo,
  endpointAttach: MapClipboardLineEndpointAttach | undefined,
  sourceIdToCreated: Map<string, InfraObject>,
): LinePasteRemapResult {
  let line_snap_start_object_id: string | undefined;
  let line_snap_finish_object_id: string | undefined;

  if (endpointAttach?.startSourceId) {
    const pt = sourceIdToCreated.get(endpointAttach.startSourceId);
    if (pt) line_snap_start_object_id = pt.id;
  }
  if (endpointAttach?.finishSourceId) {
    const pt = sourceIdToCreated.get(endpointAttach.finishSourceId);
    if (pt) line_snap_finish_object_id = pt.id;
  }

  return {
    snap: lineSnap,
    ...(line_snap_start_object_id ? { line_snap_start_object_id } : {}),
    ...(line_snap_finish_object_id ? { line_snap_finish_object_id } : {}),
  };
}

/** @deprecated Use remapLineEndpointsForPaste — nearest-neighbor snap changes line length. */
export function remapLineEndpointsOnPaste(
  lineSnap: InfraDetailUndo,
  pastedPoints: InfraObject[],
): InfraDetailUndo {
  const sourceIdToCreated = new Map(pastedPoints.map((o) => [o.id, o]));
  return remapLineEndpointsForPaste(lineSnap, undefined, sourceIdToCreated).snap;
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
  snapIds?: Pick<
    InfraObjectCreate,
    | 'line_snap_start_object_id'
    | 'line_snap_finish_object_id'
    | 'line_preserve_geometry'
  >,
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
    ...(snapIds?.line_snap_start_object_id
      ? { line_snap_start_object_id: snapIds.line_snap_start_object_id }
      : {}),
    ...(snapIds?.line_snap_finish_object_id
      ? { line_snap_finish_object_id: snapIds.line_snap_finish_object_id }
      : {}),
    ...(snapIds?.line_preserve_geometry ? { line_preserve_geometry: true } : {}),
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
