import {
  isFacilityPointSubtype,
  type InfraObjectCreate,
  type MapBatchPasteInfraLineItem,
  type MapBatchPasteInfraPointItem,
  type MapBatchPastePoiItem,
  type MapBatchPasteRequest,
  type MapBatchPasteResponse,
  type POI,
} from './api';
import type { MapBulkProgressUpdate } from './mapBulkProgress';
import { bulkOperationTimeoutMs } from './mapBulkProgress';
import type { InfraDetailUndo } from './mapUndo';
import {
  infraClipboardToCreatePayload,
  infraPasteSubtypePlan,
  partitionClipboardForPaste,
  poiClipboardToCreatePayload,
  sanitizeInfraCreateForApi,
  sanitizePoiCreateForApi,
  type MapClipboardItem,
} from './mapClipboard';

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
  const poiBatchItems: MapBatchPastePoiItem[] = [];
  const pointBatchItems: MapBatchPasteInfraPointItem[] = [];
  const lineBatchItems: MapBatchPasteInfraLineItem[] = [];

  const poiNamePool: { name: string }[] = deps.existingPois.map((p) => ({ name: p.name }));
  for (const item of poiItems) {
    if (item.kind !== 'poi') continue;
    const poiCreate = sanitizePoiCreateForApi(poiClipboardToCreatePayload(item.snapshot));
    poiCreate.name = deps.nextPoiAutoName(poiNamePool);
    poiNamePool.push({ name: poiCreate.name });
    poiBatchItems.push({ client_ref: item.sourceId, create: poiCreate });
  }

  for (const item of pointInfra) {
    if (item.kind !== 'infra') continue;
    const name = deps.nextAutoName(item.snapshot.subtype);
    const pointPayload = infraPointBatchPastePayload(
      item.snapshot,
      name,
      deps.mergeProperties,
    );
    pointBatchItems.push({
      client_ref: item.sourceId,
      create: sanitizeInfraCreateForApi(pointPayload.create),
      ...(pointPayload.target_subtype ? { target_subtype: pointPayload.target_subtype } : {}),
    });
  }

  for (const item of lineInfra) {
    if (item.kind !== 'infra') continue;
    const name = deps.nextAutoName(item.snapshot.subtype);
    const lineCreate = sanitizeInfraCreateForApi(
      infraClipboardToCreatePayload(item.snapshot, name, {
        line_preserve_geometry: true,
      }),
    );
    lineBatchItems.push({
      client_ref: item.sourceId,
      create: sanitizeInfraCreateForApi({
        ...lineCreate,
        properties: deps.mergeProperties(lineCreate.subtype, lineCreate.properties),
      }),
      ...(item.endpointAttach?.startSourceId
        ? { snap_start_ref: item.endpointAttach.startSourceId }
        : {}),
      ...(item.endpointAttach?.finishSourceId
        ? { snap_finish_ref: item.endpointAttach.finishSourceId }
        : {}),
    });
  }

  return { pois: poiBatchItems, infra_points: pointBatchItems, infra_lines: lineBatchItems };
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
  line: MapBatchPasteInfraLineItem,
  refToCreated: Map<string, string>,
): MapBatchPasteInfraLineItem {
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
  const poiChunks = chunkItems(payload.pois, BATCH_PASTE_CHUNK_SIZE);
  for (let i = 0; i < poiChunks.length; i++) {
    chunks.push({ pois: poiChunks[i]!, infra_points: [], infra_lines: [] });
  }
  const pointChunks = chunkItems(payload.infra_points, BATCH_PASTE_CHUNK_SIZE);
  for (let i = 0; i < pointChunks.length; i++) {
    chunks.push({ pois: [], infra_points: pointChunks[i]!, infra_lines: [] });
  }
  const lineChunks = chunkItems(payload.infra_lines, BATCH_PASTE_CHUNK_SIZE);
  for (let i = 0; i < lineChunks.length; i++) {
    chunks.push({ pois: [], infra_points: [], infra_lines: lineChunks[i]! });
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

/** Paste large clipboard payloads in ordered chunks (POI ? points ? lines). */
export async function executeMapBatchPaste(
  projectId: string,
  payload: MapBatchPasteRequest,
  batchPaste: BatchPasteFn,
  onProgress?: MapPasteProgressCallback,
): Promise<MapBatchPasteResponse> {
  const total = countBatchItems(payload);
  const chunks = buildPasteChunks(payload);
  const chunkTotal = Math.max(1, chunks.length);

  if (chunkTotal === 1) {
    emitPasteProgress(onProgress, {
      label: '???????',
      done: 0,
      total,
      chunkIndex: 0,
      chunkTotal: 1,
      indeterminate: true,
    });
    const result = await batchPaste(projectId, payload);
    emitPasteProgress(onProgress, {
      label: '???????',
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
      label: '???????',
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
      label: '???????',
      done,
      total,
      chunkIndex: chunkIndex + 1,
      chunkTotal,
      indeterminate: false,
    });
  }

  return merged;
}
