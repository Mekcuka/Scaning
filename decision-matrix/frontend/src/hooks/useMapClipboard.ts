import { useCallback, useMemo, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { DrawMode, MapFeatureSelection, SelectMode } from '../components/MapView';
import { api, type InfraObject, type POI } from '../lib/api';
import {
  applyOffsetToClipboard,
  buildClipboardFromSelection,
  clipboardPreviewAt,
  createInfraFromPasteSnapshot,
  infraClipboardToCreatePayload,
  partitionClipboardForPaste,
  poiClipboardToCreatePayload,
  remapLineEndpointsForPaste,
  type MapClipboardItem,
} from '../lib/mapClipboard';
import { mergeInfraPropertiesForSave } from '../lib/mergeInfraPropertiesForSave';
import type { MapUndoEntry } from '../lib/mapUndo';

export type UseMapClipboardParams = {
  projectId: string | undefined;
  pois: POI[];
  infraObjects: InfraObject[];
  canWriteProject: boolean;
  canWriteInfra: boolean;
  mapEditEnabled: boolean;
  selectMode: SelectMode;
  featureSel: MapFeatureSelection | null;
  featureGroupSel: MapFeatureSelection[];
  mapClipboard: MapClipboardItem[] | null;
  setMapClipboard: (items: MapClipboardItem[] | null) => void;
  pasteMode: boolean;
  setPasteMode: (on: boolean) => void;
  setDrawMode: (mode: DrawMode) => void;
  setSelectMode: (mode: SelectMode) => void;
  setFeatureSel: (sel: MapFeatureSelection | null) => void;
  setFeatureGroupSel: (sels: MapFeatureSelection[]) => void;
  geometrySavePending: number;
  setGeometrySavePending: Dispatch<SetStateAction<number>>;
  cursor: { lon: number; lat: number } | null;
  nextPoiAutoName: (list: POI[]) => string;
  nextAutoName: (subtype: string) => string;
  upsertInfraInCache: (created: InfraObject) => void;
  pushUndo: (entry: MapUndoEntry) => void;
  invalidateMap: () => void;
  pushToast: (kind: 'success' | 'error' | 'info', message: string) => void;
  requestDeleteSelection: () => void;
  lineHealSkipIdsRef: MutableRefObject<Set<string>>;
  canDeleteCurrentSelection: boolean;
};

export function useMapClipboard({
  projectId,
  pois,
  infraObjects,
  canWriteProject,
  canWriteInfra,
  mapEditEnabled,
  selectMode,
  featureSel,
  featureGroupSel,
  mapClipboard,
  setMapClipboard,
  pasteMode,
  setPasteMode,
  setDrawMode,
  setSelectMode,
  setFeatureSel,
  setFeatureGroupSel,
  geometrySavePending,
  setGeometrySavePending,
  cursor,
  nextPoiAutoName,
  nextAutoName,
  upsertInfraInCache,
  pushUndo,
  invalidateMap,
  pushToast,
  requestDeleteSelection,
  lineHealSkipIdsRef,
  canDeleteCurrentSelection,
}: UseMapClipboardParams) {
  const queryClient = useQueryClient();

  const getActiveMapSelections = useCallback((): MapFeatureSelection[] => {
    if (selectMode === 'box' && featureGroupSel.length > 0) return featureGroupSel;
    if (featureSel) return [featureSel];
    return [];
  }, [selectMode, featureGroupSel, featureSel]);

  const filterSelectionsForCopy = useCallback(
    (selections: MapFeatureSelection[]) => {
      const allowed: MapFeatureSelection[] = [];
      let skipped = 0;
      for (const sel of selections) {
        if (sel.kind === 'poi' && canWriteProject) allowed.push(sel);
        else if (sel.kind === 'infra' && canWriteInfra) allowed.push(sel);
        else skipped += 1;
      }
      return { allowed, skipped };
    },
    [canWriteProject, canWriteInfra],
  );

  const copyMapSelection = useCallback((): boolean => {
    const { allowed, skipped } = filterSelectionsForCopy(getActiveMapSelections());
    if (allowed.length === 0) {
      pushToast('info', 'Нет объектов для копирования');
      return false;
    }
    const items = buildClipboardFromSelection(pois, infraObjects, allowed);
    setMapClipboard(items);
    if (skipped > 0) {
      pushToast('info', `Скопировано ${items.length}; без прав: ${skipped}`);
    } else {
      pushToast('success', `Скопировано объектов: ${items.length}`);
    }
    return true;
  }, [
    filterSelectionsForCopy,
    getActiveMapSelections,
    pois,
    infraObjects,
    pushToast,
    setMapClipboard,
  ]);

  const enterPasteMode = useCallback(() => {
    if (!mapClipboard?.length) {
      pushToast('info', 'Буфер пуст — сначала скопируйте объекты (Ctrl+C)');
      return;
    }
    if (geometrySavePending > 0) {
      pushToast('info', 'Дождитесь сохранения геометрии');
      return;
    }
    setPasteMode(true);
    setDrawMode('select');
    pushToast('info', 'Кликните на карте — место вставки');
  }, [mapClipboard, geometrySavePending, pushToast, setDrawMode, setPasteMode]);

  const executePaste = useCallback(
    async (anchorLon: number, anchorLat: number) => {
      if (!projectId || !mapClipboard?.length) return;
      if (geometrySavePending > 0) {
        pushToast('info', 'Дождитесь сохранения геометрии');
        return;
      }
      setPasteMode(false);
      const offsetItems = applyOffsetToClipboard(mapClipboard, anchorLon, anchorLat);
      const { pois: poiItems, pointInfra, lineInfra } = partitionClipboardForPaste(offsetItems);
      const createdPoiIds: string[] = [];
      const createdInfraIds: string[] = [];
      const sourceIdToCreated = new Map<string, InfraObject>();

      setGeometrySavePending((p) => p + 1);
      try {
        let poiList = queryClient.getQueryData<POI[]>(['pois', projectId]) ?? pois;
        for (const item of poiItems) {
          if (!canWriteProject) continue;
          const payload = poiClipboardToCreatePayload(item.snapshot);
          payload.name = nextPoiAutoName(poiList);
          const created = await api.createPoi(projectId, payload);
          createdPoiIds.push(created.id);
          poiList = [...poiList, created];
          queryClient.setQueriesData<POI[]>({ queryKey: ['pois', projectId] }, (old) => [
            ...(old ?? []),
            created,
          ]);
        }

        for (const item of pointInfra) {
          if (!canWriteInfra || item.kind !== 'infra') continue;
          const name = nextAutoName(item.snapshot.subtype);
          const created = await createInfraFromPasteSnapshot(projectId, item.snapshot, name, {
            createInfraObject: api.createInfraObject,
            createFacilityInfraObject: api.createFacilityInfraObject,
            updateInfraObject: api.updateInfraObject,
            mergeProperties: mergeInfraPropertiesForSave,
          });
          createdInfraIds.push(created.id);
          sourceIdToCreated.set(item.sourceId, created);
          upsertInfraInCache(created);
        }

        for (const item of lineInfra) {
          if (!canWriteInfra || item.kind !== 'infra') continue;
          const { snap, line_snap_start_object_id, line_snap_finish_object_id } =
            remapLineEndpointsForPaste(item.snapshot, item.endpointAttach, sourceIdToCreated);
          const name = nextAutoName(snap.subtype);
          const payload = infraClipboardToCreatePayload(snap, name, {
            line_snap_start_object_id,
            line_snap_finish_object_id,
            line_preserve_geometry: true,
          });
          const created = await api.createInfraObject(projectId, {
            ...payload,
            properties: mergeInfraPropertiesForSave(payload.subtype, payload.properties),
          });
          createdInfraIds.push(created.id);
          lineHealSkipIdsRef.current.add(created.id);
          upsertInfraInCache(created);
        }

        const total = createdPoiIds.length + createdInfraIds.length;
        if (total === 0) {
          pushToast('error', 'Не удалось вставить объекты — проверьте права или состав буфера');
          return;
        }
        pushUndo({
          kind: 'create_clipboard_group',
          poiIds: createdPoiIds,
          infraIds: createdInfraIds,
          label: `вставка ${total} объектов`,
        });
        if (lineInfra.length > 0) {
          try {
            await api.buildNetwork(projectId);
          } catch {
            /* best-effort */
          }
        }
        invalidateMap();
        pushToast('success', `Вставлено объектов: ${total}`);
        if (createdPoiIds[0]) {
          setFeatureSel({ kind: 'poi', id: createdPoiIds[0] });
          setSelectMode('single');
          setFeatureGroupSel([]);
        } else if (createdInfraIds[0]) {
          setFeatureSel({ kind: 'infra', id: createdInfraIds[0] });
          setSelectMode('single');
          setFeatureGroupSel([]);
        }
      } catch (e) {
        pushToast('error', e instanceof Error ? e.message : 'Не удалось вставить объекты');
      } finally {
        setGeometrySavePending((p) => Math.max(0, p - 1));
      }
    },
    [
      projectId,
      mapClipboard,
      geometrySavePending,
      queryClient,
      pois,
      canWriteProject,
      canWriteInfra,
      nextPoiAutoName,
      nextAutoName,
      upsertInfraInCache,
      pushUndo,
      invalidateMap,
      pushToast,
      setPasteMode,
      setGeometrySavePending,
      setFeatureSel,
      setSelectMode,
      setFeatureGroupSel,
      lineHealSkipIdsRef,
    ],
  );

  const cutMapSelection = useCallback(() => {
    if (!copyMapSelection()) return;
    requestDeleteSelection();
  }, [copyMapSelection, requestDeleteSelection]);

  const clipboardPreviewPoints = useMemo(() => {
    if (!pasteMode || !mapClipboard?.length || !cursor) return [];
    return clipboardPreviewAt(mapClipboard, cursor.lon, cursor.lat);
  }, [pasteMode, mapClipboard, cursor]);

  const hasMapSelection = getActiveMapSelections().length > 0;
  const canCopyMapSelection =
    mapEditEnabled && hasMapSelection && (canWriteProject || canWriteInfra);
  const canPasteMapClipboard = mapEditEnabled && (mapClipboard?.length ?? 0) > 0;
  const canCutMapSelection = canCopyMapSelection && canDeleteCurrentSelection;

  return {
    copyMapSelection,
    enterPasteMode,
    executePaste,
    cutMapSelection,
    clipboardPreviewPoints,
    canCopyMapSelection,
    canPasteMapClipboard,
    canCutMapSelection,
  };
}
