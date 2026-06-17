import {
  isFacilityPointSubtype,
  projectsApi,
  type FacilityInfraObjectCreate,
  type InfraObject,
  type InfraObjectCreate,
  type POI,
} from '../api';

type CreatePoiPayload = Parameters<typeof projectsApi.createPoi>[1];
import type { MapFeatureSelection } from '../../components/MapView';
import { getLineCoordinates, isLineSubtype } from '../infraGeometry';
import { WELL_BOTTOMHOLE_GS_SUBTYPE } from '../wellBottomholeProperties';
import { lineEndpointAttachmentsFromObject } from '../lineEndpointRules';
import {
  readLineFootprintAttach,
  writeLineFootprintAttach,
} from '../padFootprintLineAttach';
import {
  infraDetailUndo,
  poiDetailUndo,
  type InfraDetailUndo,
  type PoiDetailUndo,
} from './mapUndo';
import { formValuesToPoiCreatePayload, poiToFormValues } from '../poiParams';

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
  const coords = getLineCoordinates(snap as InfraObject);
  if (!coords || coords.length < 2) return null;
  return coords.map((c) => [c[0]!, c[1]!] as [number, number]);
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

function lineEndpointNodeIds(line: InfraObject, allInfra: InfraObject[]): string[] {
  const pointPool = projectPointPool(allInfra);
  const endpoints = lineEndpointAttachmentsFromObject(line, pointPool, pointPool);
  if (!endpoints) return [];
  const ids: string[] = [];
  if (endpoints.startAttach) ids.push(endpoints.startAttach.object.id);
  if (endpoints.finishAttach) ids.push(endpoints.finishAttach.object.id);
  return ids;
}

export function buildClipboardFromSelection(
  pois: POI[],
  infra: InfraObject[],
  selections: MapFeatureSelection[],
): MapClipboardItem[] {
  const explicitInfraIds = selectionInfraIds(selections);
  const autoEndpointNodeIds = new Set<string>();
  for (const sel of selections) {
    if (sel.kind !== 'infra') continue;
    const obj = infra.find((o) => o.id === sel.id);
    if (!obj || !isLineSubtype(obj.subtype)) continue;
    for (const nodeId of lineEndpointNodeIds(obj, infra)) {
      autoEndpointNodeIds.add(nodeId);
    }
  }
  const copiedInfraIds = new Set([...explicitInfraIds, ...autoEndpointNodeIds]);

  const items: MapClipboardItem[] = [];
  const addedInfraIds = new Set<string>();

  for (const sel of selections) {
    if (sel.kind === 'poi') {
      const poi = pois.find((p) => p.id === sel.id);
      if (poi) items.push({ kind: 'poi', sourceId: sel.id, snapshot: poiDetailUndo(poi) });
    } else {
      const obj = infra.find((o) => o.id === sel.id);
      if (!obj) continue;
      addedInfraIds.add(sel.id);
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

  for (const nodeId of autoEndpointNodeIds) {
    if (addedInfraIds.has(nodeId)) continue;
    const obj = infra.find((o) => o.id === nodeId);
    if (!obj || isLineSubtype(obj.subtype)) continue;
    addedInfraIds.add(nodeId);
    items.push({ kind: 'infra', sourceId: nodeId, snapshot: infraDetailUndo(obj) });
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

export type MapClipboardPreviewPoint = { lon: number; lat: number; subtype: string };
export type MapClipboardPreviewLine = { coordinates: [number, number][]; subtype: string };

export type MapClipboardPreview = {
  points: MapClipboardPreviewPoint[];
  lines: MapClipboardPreviewLine[];
};

/** Preview geometry at cursor without mutating stored clipboard. */
export function clipboardPreviewAt(
  items: MapClipboardItem[],
  anchorLon: number,
  anchorLat: number,
): MapClipboardPreview {
  const offset = applyOffsetToClipboard(items, anchorLon, anchorLat);
  const points: MapClipboardPreviewPoint[] = [];
  const lines: MapClipboardPreviewLine[] = [];
  for (const item of offset) {
    if (item.kind === 'poi') {
      points.push({ lon: item.snapshot.lon, lat: item.snapshot.lat, subtype: 'poi' });
      continue;
    }
    if (isLineSubtype(item.snapshot.subtype)) {
      const path = linePathFromSnapshot(item.snapshot);
      if (path && path.length >= 2) {
        lines.push({ coordinates: path, subtype: item.snapshot.subtype });
        if (item.snapshot.subtype === WELL_BOTTOMHOLE_GS_SUBTYPE) {
          points.push(
            { lon: path[0]![0], lat: path[0]![1], subtype: 'well_bottomhole_gs_heel' },
            {
              lon: path[path.length - 1]![0],
              lat: path[path.length - 1]![1],
              subtype: 'well_bottomhole_gs_toe',
            },
          );
        }
      }
      continue;
    }
    points.push({
      lon: item.snapshot.lon,
      lat: item.snapshot.lat,
      subtype: item.snapshot.subtype,
    });
  }
  return { points, lines };
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

  let snap = lineSnap;
  const attach = readLineFootprintAttach(lineSnap.properties);
  if (attach.start || attach.finish) {
    const nextAttach = { ...attach };
    let changed = false;
    for (const key of ['start', 'finish'] as const) {
      const ep = attach[key];
      if (!ep) continue;
      const twin = sourceIdToCreated.get(ep.point_id);
      if (twin && twin.id !== ep.point_id) {
        nextAttach[key] = { ...ep, point_id: twin.id };
        changed = true;
      }
    }
    if (changed) {
      snap = {
        ...lineSnap,
        properties: writeLineFootprintAttach({ ...(lineSnap.properties ?? {}) }, nextAttach),
      };
    }
  }

  return {
    snap,
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
): CreatePoiPayload {
  return formValuesToPoiCreatePayload(poiToFormValues(snap as POI)) as CreatePoiPayload;
}

/** Strip read-only / invalid API fields from infra create payloads (batch paste). */
function sanitizePropertiesForInfraCreate(
  properties: Record<string, unknown> | undefined,
  isLine: boolean,
): Record<string, unknown> | undefined {
  if (!properties || typeof properties !== 'object') return undefined;
  const next: Record<string, unknown> = { ...properties };
  delete next.render_3d_effective;
  if (!isLine) delete next.coordinates;
  for (const [key, value] of Object.entries(next)) {
    if (value === null || value === undefined) delete next[key];
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export function sanitizePoiCreateForApi(create: CreatePoiPayload): CreatePoiPayload {
  const raw = create as Record<string, unknown>;
  const lon = Number(raw.lon);
  const lat = Number(raw.lat);
  if (typeof raw.name !== 'string' || !Number.isFinite(lon) || !Number.isFinite(lat)) {
    throw new Error('Invalid POI paste payload');
  }
  return {
    name: String(raw.name).trim(),
    description:
      raw.description == null || raw.description === '' ? null : String(raw.description),
    lon,
    lat,
    planned_production_volume: Number(raw.planned_production_volume) || 0,
    production_per_well: Number(raw.production_per_well) || 10,
    wells_per_pad: Math.round(Number(raw.wells_per_pad) || 4),
    fluid_type: raw.fluid_type === 'gas' ? 'gas' : 'oil',
    water_injection_volume: Number(raw.water_injection_volume) || 0,
    gas_factor: Number(raw.gas_factor) || 120,
    eng_power: String(raw.eng_power ?? 'external'),
    eng_injection: String(raw.eng_injection ?? 'centralized'),
    eng_gas: String(raw.eng_gas ?? 'well'),
    eng_oil_preparation: String(raw.eng_oil_preparation ?? 'mkos'),
    eng_well_gathering: String(raw.eng_well_gathering ?? 'single_tube'),
    eng_transport: String(raw.eng_transport ?? 'auto'),
  };
}

export function sanitizeInfraCreateForApi(create: InfraObjectCreate): InfraObjectCreate {
  const {
    id: _id,
    category: _category,
    render_3d_effective: _render3d,
    properties,
    layer_id: layerId,
    description,
    end_lon,
    end_lat,
    coordinates,
    ...rest
  } = create as InfraObjectCreate & {
    id?: string;
    category?: string;
    render_3d_effective?: unknown;
  };
  const isLine =
    isLineSubtype(String(rest.subtype ?? '')) ||
    end_lon != null ||
    end_lat != null ||
    (Array.isArray(coordinates) && coordinates.length >= 2);
  const safeProperties = sanitizePropertiesForInfraCreate(properties, isLine);
  return {
    ...rest,
    ...(layerId ? { layer_id: layerId } : {}),
    ...(description ? { description } : {}),
    ...(end_lon != null && end_lat != null ? { end_lon, end_lat } : {}),
    ...(coordinates && coordinates.length >= 2 ? { coordinates } : {}),
    ...(safeProperties ? { properties: safeProperties } : {}),
  };
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
  const path = linePathFromSnapshot(snap);
  const lon = path?.[0]?.[0] ?? snap.lon;
  const lat = path?.[0]?.[1] ?? snap.lat;
  const endLon = path && path.length >= 2 ? path[path.length - 1]![0] : snap.end_lon;
  const endLat = path && path.length >= 2 ? path[path.length - 1]![1] : snap.end_lat;
  return {
    name,
    subtype: snap.subtype,
    lon,
    lat,
    layer_id: snap.layer_id,
    ...(endLon != null && endLat != null ? { end_lon: endLon, end_lat: endLat } : {}),
    ...(path && path.length >= 2 ? { coordinates: path } : {}),
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
  useFacilityEndpoint: boolean;
} {
  const targetSubtype = subtype;
  if (isFacilityPointSubtype(targetSubtype)) {
    return { createSubtype: targetSubtype, targetSubtype, useFacilityEndpoint: true };
  }
  const createSubtype = PASTE_INFRA_CREATE_BASE[targetSubtype] ?? targetSubtype;
  return { createSubtype, targetSubtype, useFacilityEndpoint: false };
}

export type PasteInfraCreateDeps = {
  createInfraObject: (
    projectId: string,
    data: InfraObjectCreate,
    opts?: { timeoutMs?: number },
  ) => Promise<InfraObject>;
  createFacilityInfraObject: (
    projectId: string,
    data: FacilityInfraObjectCreate,
  ) => Promise<InfraObject>;
  updateInfraObject: (
    projectId: string,
    objectId: string,
    data: Partial<InfraObjectCreate>,
  ) => Promise<InfraObject>;
  mergeProperties: (
    subtype: string,
    properties?: Record<string, unknown>,
  ) => Record<string, unknown> | undefined;
};

/** Create one pasted point infra (facility endpoint, base+patch, or direct POST /objects). */
export async function createInfraFromPasteSnapshot(
  projectId: string,
  snap: InfraDetailUndo,
  name: string,
  deps: PasteInfraCreateDeps,
): Promise<InfraObject> {
  const { createSubtype, targetSubtype, useFacilityEndpoint } = infraPasteSubtypePlan(snap.subtype);

  if (useFacilityEndpoint && isFacilityPointSubtype(targetSubtype)) {
    const payload = infraClipboardToCreatePayload(
      { ...snap, subtype: targetSubtype },
      name,
    );
    return deps.createFacilityInfraObject(projectId, {
      name: payload.name,
      subtype: targetSubtype,
      lon: payload.lon,
      lat: payload.lat,
      layer_id: payload.layer_id,
      ...(payload.description ? { description: payload.description } : {}),
      properties: deps.mergeProperties(targetSubtype, payload.properties),
    });
  }

  const snapForCreate =
    createSubtype === targetSubtype ? snap : { ...snap, subtype: createSubtype };
  const payload = infraClipboardToCreatePayload(snapForCreate, name);
  let created = await deps.createInfraObject(projectId, {
    ...payload,
    properties: deps.mergeProperties(payload.subtype, payload.properties),
  });
  if (targetSubtype !== createSubtype) {
    created = await deps.updateInfraObject(projectId, created.id, {
      subtype: targetSubtype,
    });
  }
  return created;
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

export {
  BATCH_PASTE_CHUNK_SIZE,
  BATCH_PASTE_MAX_OBJECTS,
  batchPasteTimeoutMs,
  buildMapBatchPasteRequest,
  countMapBatchPasteChunks,
  executeMapBatchPaste,
  type MapPasteProgressCallback,
  type MapPasteProgressUpdate,
} from './mapBatchPaste';
