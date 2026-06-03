import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import {
  api,
  type InfraObject,
  type InfraObjectCreate,
  type POI,
} from './api';
import { formValuesToPoiCreatePayload, poiToFormValues } from './poiParams';
import { isLineSubtype } from './infraGeometry';
import { refreshMapQueries } from './mapQueries';

const MAX_UNDO_STACK = 50;
const RESTORE_BATCH_SIZE = 8;

export type InfraGeometryUndo = {
  lon: number;
  lat: number;
  end_lon?: number | null;
  end_lat?: number | null;
  coordinates?: number[][] | null;
};

export type InfraDetailUndo = InfraGeometryUndo & {
  name: string;
  subtype: string;
  layer_id: string;
  properties?: Record<string, unknown>;
};

export type PoiGeometryUndo = { lon: number; lat: number };

export type PoiDetailUndo = Partial<POI> & { lon: number; lat: number; name: string };

export type MapUndoEntry =
  | { kind: 'create_infra'; objectId: string; label: string }
  | {
      kind: 'split_line_create_point';
      pointId: string;
      secondLineId: string;
      lineId: string;
      lineBefore: InfraGeometryUndo;
      label: string;
    }
  | { kind: 'create_poi'; poiId: string; label: string }
  | { kind: 'restore_infra'; snapshot: InfraObject; label: string }
  | { kind: 'restore_poi'; snapshot: POI; label: string }
  | { kind: 'patch_infra_geometry'; objectId: string; before: InfraGeometryUndo; label: string }
  | { kind: 'patch_poi_geometry'; poiId: string; before: PoiGeometryUndo; label: string }
  | { kind: 'patch_infra_detail'; objectId: string; before: InfraDetailUndo; label: string }
  | { kind: 'patch_poi_detail'; poiId: string; before: PoiDetailUndo; label: string }
  | { kind: 'patch_infra_batch'; entries: { objectId: string; before: InfraGeometryUndo }[]; label: string }
  | {
      kind: 'patch_geometry_group';
      poiEntries: { poiId: string; before: PoiGeometryUndo }[];
      infraEntries: { objectId: string; before: InfraGeometryUndo }[];
      label: string;
    }
  | {
      kind: 'create_clipboard_group';
      poiIds: string[];
      infraIds: string[];
      label: string;
    }
  | { kind: 'restore_group'; pois: POI[]; infra: InfraObject[]; label: string };

function infraSnapshotToCreate(obj: InfraObject): InfraObjectCreate {
  const desc =
    obj.properties && typeof obj.properties.description === 'string'
      ? obj.properties.description
      : undefined;
  return {
    name: obj.name,
    subtype: obj.subtype,
    lon: obj.lon,
    lat: obj.lat,
    layer_id: obj.layer_id,
    ...(obj.end_lon != null && obj.end_lat != null
      ? { end_lon: obj.end_lon, end_lat: obj.end_lat }
      : {}),
    ...(obj.coordinates && obj.coordinates.length >= 2
      ? { coordinates: obj.coordinates }
      : {}),
    ...(obj.properties ? { properties: obj.properties } : {}),
    ...(desc ? { description: desc } : {}),
  };
}

function poiSnapshotToCreate(poi: POI): Parameters<typeof api.createPoi>[1] {
  return formValuesToPoiCreatePayload(poiToFormValues(poi)) as Parameters<typeof api.createPoi>[1];
}

export function infraGeometryUndo(obj: InfraObject): InfraGeometryUndo {
  return {
    lon: obj.lon,
    lat: obj.lat,
    end_lon: obj.end_lon,
    end_lat: obj.end_lat,
    coordinates: obj.coordinates,
  };
}

export function infraDetailUndo(obj: InfraObject): InfraDetailUndo {
  return {
    ...infraGeometryUndo(obj),
    name: obj.name,
    subtype: obj.subtype,
    layer_id: obj.layer_id,
    properties: obj.properties,
  };
}

export function poiGeometryUndo(poi: POI): PoiGeometryUndo {
  return { lon: poi.lon, lat: poi.lat };
}

export function poiDetailUndo(poi: POI): PoiDetailUndo {
  return { ...poi };
}

function infraUndoToPatch(before: InfraGeometryUndo | InfraDetailUndo): Partial<InfraObjectCreate> {
  return {
    ...before,
    end_lon: before.end_lon ?? undefined,
    end_lat: before.end_lat ?? undefined,
    coordinates: before.coordinates ?? undefined,
  };
}

/** Longer timeout for bulk restore (many sequential API calls). */
export function restoreGroupTimeoutMs(poiCount: number, infraCount: number): number {
  const total = poiCount + infraCount;
  return Math.min(300_000, Math.max(30_000, 15_000 + total * 800));
}

async function runInBatches<T>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map((item) => fn(item)));
  }
}

async function restoreGroup(
  projectId: string,
  pois: POI[],
  infra: InfraObject[],
  timeoutMs: number,
): Promise<void> {
  const pointInfra = infra.filter((o) => !isLineSubtype(o.subtype));
  const lineInfra = infra.filter((o) => isLineSubtype(o.subtype));
  const req = { timeoutMs };

  await runInBatches(pois, RESTORE_BATCH_SIZE, async (poi) => {
    await api.createPoi(projectId, poiSnapshotToCreate(poi), req);
  });
  await runInBatches(pointInfra, RESTORE_BATCH_SIZE, async (obj) => {
    await api.createInfraObject(projectId, infraSnapshotToCreate(obj), req);
  });
  await runInBatches(lineInfra, RESTORE_BATCH_SIZE, async (obj) => {
    await api.createInfraObject(projectId, infraSnapshotToCreate(obj), req);
  });
}

export async function applyMapUndo(entry: MapUndoEntry, projectId: string): Promise<void> {
  switch (entry.kind) {
    case 'create_infra':
      await api.deleteInfraObject(projectId, entry.objectId);
      return;
    case 'split_line_create_point':
      await api.updateInfraObject(projectId, entry.lineId, infraUndoToPatch(entry.lineBefore));
      await api.deleteInfraObject(projectId, entry.secondLineId);
      await api.deleteInfraObject(projectId, entry.pointId);
      try {
        await api.buildNetwork(projectId);
      } catch {
        /* network rebuild best-effort on undo */
      }
      return;
    case 'create_poi':
      await api.deletePoi(projectId, entry.poiId);
      return;
    case 'restore_infra':
      await api.createInfraObject(projectId, infraSnapshotToCreate(entry.snapshot));
      return;
    case 'restore_poi':
      await api.createPoi(projectId, poiSnapshotToCreate(entry.snapshot));
      return;
    case 'patch_infra_geometry':
    case 'patch_infra_detail':
      await api.updateInfraObject(projectId, entry.objectId, infraUndoToPatch(entry.before));
      return;
    case 'patch_infra_batch':
      for (const item of entry.entries) {
        await api.updateInfraObject(projectId, item.objectId, infraUndoToPatch(item.before));
      }
      return;
    case 'patch_poi_geometry':
    case 'patch_poi_detail':
      await api.updatePoi(projectId, entry.poiId, entry.before);
      return;
    case 'patch_geometry_group':
      for (const item of entry.poiEntries) {
        await api.updatePoi(projectId, item.poiId, item.before);
      }
      for (const item of entry.infraEntries) {
        await api.updateInfraObject(projectId, item.objectId, infraUndoToPatch(item.before));
      }
      return;
    case 'create_clipboard_group':
      await Promise.all([
        ...entry.poiIds.map((id) => api.deletePoi(projectId, id)),
        ...entry.infraIds.map((id) => api.deleteInfraObject(projectId, id)),
      ]);
      try {
        if (entry.infraIds.length > 0) await api.buildNetwork(projectId);
      } catch {
        /* best-effort */
      }
      return;
    case 'restore_group':
      await restoreGroup(
        projectId,
        entry.pois,
        entry.infra,
        restoreGroupTimeoutMs(entry.pois.length, entry.infra.length),
      );
      return;
    default:
      return;
  }
}

export function useMapUndo(options: {
  projectId: string | undefined;
  enabled: boolean;
  queryClient: QueryClient;
  invalidateMap: () => void;
  onUndoError?: (message: string) => void;
}) {
  const { projectId, enabled, queryClient, invalidateMap, onUndoError } = options;
  const stackRef = useRef<MapUndoEntry[]>([]);
  const undoingRef = useRef(false);
  const [undoCount, setUndoCount] = useState(0);
  const [lastUndoMessage, setLastUndoMessage] = useState<string | null>(null);

  const syncCount = useCallback(() => {
    setUndoCount(stackRef.current.length);
  }, []);

  const pushUndo = useCallback(
    (entry: MapUndoEntry) => {
      if (undoingRef.current || !projectId) return;
      stackRef.current.push(entry);
      if (stackRef.current.length > MAX_UNDO_STACK) {
        stackRef.current.shift();
      }
      syncCount();
    },
    [projectId, syncCount],
  );

  const clearUndo = useCallback(() => {
    stackRef.current = [];
    syncCount();
  }, [syncCount]);

  useEffect(() => {
    clearUndo();
    setLastUndoMessage(null);
  }, [projectId, clearUndo]);

  const performUndo = useCallback(async () => {
    if (!projectId || !enabled || undoingRef.current || stackRef.current.length === 0) {
      return false;
    }
    const entry = stackRef.current.pop()!;
    syncCount();
    undoingRef.current = true;
    try {
      await applyMapUndo(entry, projectId);
      invalidateMap();
      await refreshMapQueries(queryClient, projectId);
      const restoredCount =
        entry.kind === 'restore_group'
          ? entry.pois.length + entry.infra.length
          : entry.kind === 'create_clipboard_group'
            ? entry.poiIds.length + entry.infraIds.length
            : undefined;
      setLastUndoMessage(
        restoredCount != null && restoredCount > 1
          ? `Отменено: восстановлено ${restoredCount} объектов`
          : `Отменено: ${entry.label}`,
      );
      return true;
    } catch (e) {
      stackRef.current.push(entry);
      syncCount();
      const msg = e instanceof Error ? e.message : 'Не удалось отменить действие';
      if (onUndoError) onUndoError(msg);
      else window.alert(msg);
      return false;
    } finally {
      undoingRef.current = false;
    }
  }, [projectId, enabled, invalidateMap, queryClient, syncCount, onUndoError]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || e.shiftKey) return;
      if (!enabled || !projectId) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      void performUndo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, projectId, performUndo]);

  return {
    pushUndo,
    performUndo,
    clearUndo,
    canUndo: undoCount > 0,
    undoCount,
    lastUndoMessage,
    setLastUndoMessage,
  };
}
