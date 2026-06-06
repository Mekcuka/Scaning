import {
  api,
  isFacilityPointSubtype,
  type FacilityInfraObjectCreate,
  type InfraObject,
  type InfraObjectCreate,
  type MapBatchPasteRequest,
  type POI,
  type MapBatchPasteResponse,
} from './api';
import type { MapFeatureSelection } from '../components/MapView';
import type { MapBulkProgressUpdate } from './mapBulkProgress';
import { bulkOperationTimeoutMs } from './mapBulkProgress';
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

export function sanitizePoiCreateForApi(
  create: Parameters<typeof api.createPoi>[1],
): Parameters<typeof api.createPoi>[1] {
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

function infraPointBatchPastePayload(
  snap: InfraDetailUndo,
  name: string,
  mergeProperties: (
    subtype: string,
    properties?: Record<string, unknown>,
  ) => Record<string, unknown> | undefined,
): { create: InfraObjectCreate; target_subtype?: string } {
  const { createSubtype, targetSubtype, useFacilityEndpoint } = infraPasteSubtypePlan(snap.subtype);

  if (useFacilityEndpoint && isFacilityPointSubtype(targetSubtype)) {
    const payload = infraClipboardToCreatePayload({ ...snap, subtype: targetSubtype }, name);
    return {
      create: {
        ...payload,
        properties: mergeProperties(targetSubtype, payload.properties),
      },
    };
  }

  const snapForCreate =
    createSubtype === targetSubtype ? snap : { ...snap, subtype: createSubtype };
  const payload = infraClipboardToCreatePayload(snapForCreate, name);
  return {
    create: {
      ...payload,
      properties: mergeProperties(payload.subtype, payload.properties),
    },
    ...(targetSubtype !== createSubtype ? { target_subtype: targetSubtype } : {}),
  };
}

export function buildMapBatchPasteRequest(
  offsetItems: MapClipboardItem[],
  deps: {
    existingPois: POI[];
    nextPoiAutoName: (list: { name: string }[]) => string;
    nextAutoName: (subtype: string) => string;
    mergeProperties: (
      subtype: string,
      properties?: Record<string, unknown>,
    ) => Record<string, unknown> | undefined;
  },
): MapBatchPasteRequest {
  const { pois: poiItems, pointInfra, lineInfra } = partitionClipboardForPaste(offsetItems);
  const pois: MapBatchPasteRequest['pois'] = [];
  const infra_points: MapBatchPasteRequest['infra_points'] = [];
  const infra_lines: MapBatchPasteRequest['infra_lines'] = [];

  const poiNamePool: { name: string }[] = deps.existingPois.map((p) => ({ name: p.name }));
  for (const item of poiItems) {
    if (item.kind !== 'poi') continue;
    const create = sanitizePoiCreateForApi(poiClipboardToCreatePayload(item.snapshot));
    create.name = deps.nextPoiAutoName(poiNamePool);
    poiNamePool.push({ name: create.name });
    pois.push({ client_ref: item.sourceId, create });
  }

  for (const item of pointInfra) {
    if (item.kind !== 'infra') continue;
    const name = deps.nextAutoName(item.snapshot.subtype);
    const { create, target_subtype } = infraPointBatchPastePayload(
      item.snapshot,
      name,
      deps.mergeProperties,
    );
    infra_points.push({
      client_ref: item.sourceId,
      create: sanitizeInfraCreateForApi(create),
      ...(target_subtype ? { target_subtype } : {}),
    });
  }

  for (const item of lineInfra) {
    if (item.kind !== 'infra') continue;
    const name = deps.nextAutoName(item.snapshot.subtype);
    const create = sanitizeInfraCreateForApi(
      infraClipboardToCreatePayload(item.snapshot, name, {
        line_preserve_geometry: true,
      }),
    );
    infra_lines.push({
      client_ref: item.sourceId,
      create: sanitizeInfraCreateForApi({
        ...create,
        properties: deps.mergeProperties(create.subtype, create.properties),
      }),
      ...(item.endpointAttach?.startSourceId
        ? { snap_start_ref: item.endpointAttach.startSourceId }
        : {}),
      ...(item.endpointAttach?.finishSourceId
        ? { snap_finish_ref: item.endpointAttach.finishSourceId }
        : {}),
    });
  }

  return { pois, infra_points, infra_lines };
}

export const BATCH_PASTE_MAX_OBJECTS = 10_000;
export const BATCH_PASTE_CHUNK_SIZE = 9_500;

export type MapPasteProgressUpdate = MapBulkProgressUpdate;

export type MapPasteProgressCallback = (update: MapBulkProgressUpdate) => void;

type BatchPasteFn = (
  projectId: string,
  data: MapBatchPasteRequest,
) => Promise<MapBatchPasteResponse>;

function mergeBatchPasteResponses(
  a: MapBatchPasteResponse,
  b: MapBatchPasteResponse,
): MapBatchPasteResponse {
  return {
    created_pois: [...a.created_pois, ...b.created_pois],
    created_infra: [...a.created_infra, ...b.created_infra],
    network_rebuilt: a.network_rebuilt || b.network_rebuilt,
  };
}

function chunkItems<T>(items: T[], chunkSize: number): T[][] {
  if (items.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    out.push(items.slice(i, i + chunkSize));
  }
  return out;
}

function remapLineSnapRefs(
  line: MapBatchPasteRequest['infra_lines'][number],
  refToCreated: Map<string, string>,
): MapBatchPasteRequest['infra_lines'][number] {
  const snap_start_ref = line.snap_start_ref
    ? refToCreated.get(line.snap_start_ref) ?? line.snap_start_ref
    : undefined;
  const snap_finish_ref = line.snap_finish_ref
    ? refToCreated.get(line.snap_finish_ref) ?? line.snap_finish_ref
    : undefined;
  return {
    ...line,
    ...(snap_start_ref ? { snap_start_ref } : {}),
    ...(snap_finish_ref ? { snap_finish_ref } : {}),
  };
}

function countBatchItems(payload: MapBatchPasteRequest): number {
  return payload.pois.length + payload.infra_points.length + payload.infra_lines.length;
}

function buildPasteChunks(payload: MapBatchPasteRequest): MapBatchPasteRequest[] {
  const chunks: MapBatchPasteRequest[] = [];
  for (const pois of chunkItems(payload.pois, BATCH_PASTE_CHUNK_SIZE)) {
    chunks.push({ pois, infra_points: [], infra_lines: [] });
  }
  for (const infra_points of chunkItems(payload.infra_points, BATCH_PASTE_CHUNK_SIZE)) {
    chunks.push({ pois: [], infra_points, infra_lines: [] });
  }
  for (const infra_lines of chunkItems(payload.infra_lines, BATCH_PASTE_CHUNK_SIZE)) {
    chunks.push({ pois: [], infra_points: [], infra_lines });
  }
  return chunks;
}

export function countMapBatchPasteChunks(payload: MapBatchPasteRequest): number {
  const chunks = buildPasteChunks(payload);
  return Math.max(1, chunks.length);
}

/** Per-request timeout for batch-paste (heavy DB + network rebuild on large projects). */
export function batchPasteTimeoutMs(payload: MapBatchPasteRequest): number {
  return bulkOperationTimeoutMs(countBatchItems(payload));
}

function emitPasteProgress(
  onProgress: MapPasteProgressCallback | undefined,
  update: MapPasteProgressUpdate,
): void {
  onProgress?.(update);
}

function trackCreatedRefs(
  request: MapBatchPasteRequest,
  response: MapBatchPasteResponse,
  refToCreated: Map<string, string>,
): void {
  request.pois.forEach((item, index) => {
    const created = response.created_pois[index];
    if (created) refToCreated.set(item.client_ref, created.id);
  });
  let infraIndex = 0;
  request.infra_points.forEach((item) => {
    const created = response.created_infra[infraIndex++];
    if (created) refToCreated.set(item.client_ref, created.id);
  });
  request.infra_lines.forEach((item) => {
    const created = response.created_infra[infraIndex++];
    if (created) refToCreated.set(item.client_ref, created.id);
  });
}

/** Paste large clipboard payloads in ordered chunks (POI → points → lines). */
export async function executeMapBatchPaste(
  projectId: string,
  payload: MapBatchPasteRequest,
  batchPaste: BatchPasteFn,
  onProgress?: MapPasteProgressCallback,
): Promise<MapBatchPasteResponse> {
  const total = countBatchItems(payload);
  const chunks = buildPasteChunks(payload);
  const chunkTotal = Math.max(1, chunks.length);
  const indeterminate = chunkTotal === 1;

  if (chunkTotal === 1) {
    emitPasteProgress(onProgress, {
      label: 'Вставка',
      done: 0,
      total,
      chunkIndex: 0,
      chunkTotal: 1,
      indeterminate: true,
    });
    const result = await batchPaste(projectId, payload);
    emitPasteProgress(onProgress, {
      label: 'Вставка',
      done: total,
      total,
      chunkIndex: 1,
      chunkTotal: 1,
      indeterminate: false,
    });
    return result;
  }

  const refToCreated = new Map<string, string>();
  let merged: MapBatchPasteResponse = {
    created_pois: [],
    created_infra: [],
    network_rebuilt: false,
  };
  let done = 0;

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
    const rawChunk = chunks[chunkIndex]!;
    const chunk: MapBatchPasteRequest =
      rawChunk.infra_lines.length > 0
        ? {
            ...rawChunk,
            infra_lines: rawChunk.infra_lines.map((line) =>
              remapLineSnapRefs(line, refToCreated),
            ),
          }
        : rawChunk;

    emitPasteProgress(onProgress, {
      label: 'Вставка',
      done,
      total,
      chunkIndex,
      chunkTotal,
      indeterminate: false,
    });
    const result = await batchPaste(projectId, chunk);
    trackCreatedRefs(chunk, result, refToCreated);
    merged = mergeBatchPasteResponses(merged, result);
    done += countBatchItems(chunk);
    emitPasteProgress(onProgress, {
      label: 'Вставка',
      done,
      total,
      chunkIndex: chunkIndex + 1,
      chunkTotal,
      indeterminate: false,
    });
  }

  return merged;
}
